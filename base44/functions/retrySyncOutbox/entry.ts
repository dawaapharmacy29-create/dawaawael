import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { sendToSupabase, isConfigured, shouldFail } from '../../shared/dawaaSync.ts';

const MANAGEMENT_SYNC_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-customer-order-sync';
const MANAGEMENT_WATERMARK_KEY = 'dawaawael:CustomerOrder:dawaa-pharmacy';

async function sendCustomerOrderRecords(records, mode = 'reconcile_recent') {
  const endpoint = secrets.get('DAWAA_PHARMACY_SYNC_ENDPOINT') || MANAGEMENT_SYNC_ENDPOINT;
  const secret = secrets.get('DAWAA_PHARMACY_SYNC_SECRET') || '';
  if (!secret) {
    return { success: false, skipped: true, status: 0, error: 'DAWAA_PHARMACY_SYNC_SECRET missing' };
  }
  if (!Array.isArray(records) || records.length === 0) {
    return { success: true, records_sent: 0 };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dawaa-Sync-Secret': secret,
      'X-Dawaa-Event-Id': `dawaawael:CustomerOrder:${mode}:${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      mode,
      source_system: 'dawaawael',
      source_entity: 'CustomerOrder',
      records,
    }),
  });

  const raw = await response.text();
  let receiver = null;
  try { receiver = JSON.parse(raw); } catch { receiver = { raw: raw.slice(0, 1000) }; }
  return {
    success: response.ok,
    status: response.status,
    records_sent: records.length,
    receiver,
    error: response.ok ? '' : `HTTP ${response.status}: ${raw.slice(0, 300)}`,
  };
}

async function syncCustomerOrderEventToManagement(record) {
  if (record.entity_name !== 'CustomerOrder' || !['create', 'update'].includes(String(record.event_type))) {
    return { success: true, skipped: true };
  }

  let payload = {};
  try { payload = JSON.parse(record.payload || '{}'); } catch { payload = {}; }
  const item = { ...payload, id: payload.id || record.record_id };
  return sendCustomerOrderRecords([item], 'incremental_retry');
}

async function reconcileCustomerOrdersToManagement(base44) {
  const watermarkRows = await base44.asServiceRole.entities.SyncWatermark.filter({ key: MANAGEMENT_WATERMARK_KEY });
  const watermarkRow = watermarkRows[0] || null;
  const watermark = watermarkRow?.last_source_updated_at || '';

  const collected = [];
  let offset = 0;
  let reachedWatermark = false;
  const pageSize = 200;
  const maxPages = 10;

  for (let page = 0; page < maxPages && !reachedWatermark; page += 1) {
    const rows = await base44.asServiceRole.entities.CustomerOrder.list('-updated_date', pageSize, offset);
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const row of rows) {
      const updated = String(row.updated_date || row.created_date || '');
      if (watermark && updated && updated <= watermark) {
        reachedWatermark = true;
        break;
      }
      collected.push(row);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  if (collected.length === 0) {
    if (watermarkRow) {
      await base44.asServiceRole.entities.SyncWatermark.update(watermarkRow.id, {
        last_success_at: new Date().toISOString(),
        last_error: '',
        metadata: JSON.stringify({ scanned_pages: Math.ceil(offset / pageSize) || 1, records_sent: 0 }),
      });
    }
    return { success: true, records_sent: 0, watermark };
  }

  // Send oldest-to-newest so the destination never observes time going backwards.
  collected.sort((a, b) => String(a.updated_date || '').localeCompare(String(b.updated_date || '')));

  let sent = 0;
  for (let i = 0; i < collected.length; i += 200) {
    const batch = collected.slice(i, i + 200);
    const result = await sendCustomerOrderRecords(batch, 'reconcile_watermark');
    if (!result.success) {
      const now = new Date().toISOString();
      if (watermarkRow) {
        await base44.asServiceRole.entities.SyncWatermark.update(watermarkRow.id, {
          last_error: result.error || 'management reconcile failed',
          metadata: JSON.stringify({ records_sent_before_failure: sent, pending: collected.length - sent }),
        });
      }
      return { ...result, records_sent: sent };
    }
    sent += batch.length;
  }

  const newest = collected[collected.length - 1];
  const nextWatermark = String(newest.updated_date || newest.created_date || watermark || '');
  const nextRecordId = String(newest.id || '');
  const now = new Date().toISOString();

  if (watermarkRow) {
    await base44.asServiceRole.entities.SyncWatermark.update(watermarkRow.id, {
      last_source_updated_at: nextWatermark,
      last_source_record_id: nextRecordId,
      last_success_at: now,
      last_error: '',
      metadata: JSON.stringify({ records_sent: sent, previous_watermark: watermark || null }),
    });
  } else {
    await base44.asServiceRole.entities.SyncWatermark.create({
      key: MANAGEMENT_WATERMARK_KEY,
      source_system: 'dawaawael',
      source_entity: 'CustomerOrder',
      destination: 'dawaa-pharmacy',
      last_source_updated_at: nextWatermark,
      last_source_record_id: nextRecordId,
      last_success_at: now,
      last_error: '',
      metadata: JSON.stringify({ records_sent: sent, bootstrap: true }),
    });
  }

  return { success: true, records_sent: sent, watermark_before: watermark || null, watermark_after: nextWatermark };
}

async function deliverOutboxRecord(base44, record, endpoint, secret) {
  let payload = {};
  try { payload = JSON.parse(record.payload || '{}'); } catch { payload = {}; }

  const primaryResult = await sendToSupabase(endpoint, secret, {
    event_id: record.event_id,
    entity_name: record.entity_name,
    record_id: record.record_id,
    event_type: record.event_type,
    payload,
    source_created_at: record.source_created_at,
    source_updated_at: record.source_updated_at
  });

  const managementResult = await syncCustomerOrderEventToManagement(record);
  const ok = primaryResult.success && managementResult.success;
  const error = [
    primaryResult.success ? '' : `DawaaBills: ${primaryResult.error || 'sync failed'}`,
    managementResult.success ? '' : `Dawaa Pharmacy: ${managementResult.error || 'sync failed'}`,
  ].filter(Boolean).join(' | ');

  const now = new Date().toISOString();
  const attempts = Number(record.attempts || 0) + 1;
  const newStatus = ok ? 'synced' : (shouldFail(attempts) ? 'failed' : 'pending_retry');

  await base44.asServiceRole.entities.SyncOutbox.update(record.id, {
    status: newStatus,
    synced_at: ok ? now : (record.synced_at || ''),
    response_data: JSON.stringify({ primary_success: primaryResult.success, management_success: managementResult.success }),
    attempts,
    last_attempt_at: now,
    last_error: ok ? '' : error.slice(0, 500),
  });

  return { status: newStatus, event_id: record.event_id, error, primaryResult, managementResult };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const mode = body.mode || "retry_pending";
    const limit = Math.min(body.limit || 50, 50);

    const endpoint = secrets.get("DAWAA_SYNC_ENDPOINT") || "";
    const secret = secrets.get("DAWAA_SYNC_SECRET") || "";

    if (mode === "test_connection") {
      if (!isConfigured(endpoint, secret)) {
        return Response.json({ success: false, error: "إعدادات المزامنة غير مكتملة" });
      }
      const result = await sendToSupabase(endpoint, secret, {
        event_id: crypto.randomUUID(),
        entity_name: "__connection_test__",
        record_id: "test",
        event_type: "create",
        payload: { test: true, timestamp: new Date().toISOString() },
        source_created_at: new Date().toISOString(),
        source_updated_at: new Date().toISOString()
      });
      return Response.json({ success: result.success, status: result.status, error: result.error });
    }

    if (mode === 'reconcile_management') {
      const management_reconciliation = await reconcileCustomerOrdersToManagement(base44);
      return Response.json({ management_reconciliation });
    }

    if (!isConfigured(endpoint, secret)) {
      return Response.json({ success: false, error: "إعدادات مزامنة DawaaBills غير مكتملة" }, { status: 503 });
    }

    if (mode === "retry_specific") {
      const { event_id } = body;
      if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });
      const records = await base44.asServiceRole.entities.SyncOutbox.filter({ event_id });
      if (records.length === 0) return Response.json({ error: "not found" }, { status: 404 });
      const result = await deliverOutboxRecord(base44, records[0], endpoint, secret);
      return Response.json(result);
    }

    const pendingRecords = await base44.asServiceRole.entities.SyncOutbox.filter(
      { status: "pending_retry" },
      "created_date",
      limit
    );

    let synced = 0, failed = 0, retried = 0;
    for (const record of pendingRecords) {
      const result = await deliverOutboxRecord(base44, record, endpoint, secret);
      if (result.status === 'synced') synced += 1;
      else if (result.status === 'failed') failed += 1;
      else retried += 1;
    }

    let management_reconciliation;
    try {
      management_reconciliation = await reconcileCustomerOrdersToManagement(base44);
    } catch (error) {
      management_reconciliation = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return Response.json({ processed: pendingRecords.length, synced, failed, retried, management_reconciliation });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
