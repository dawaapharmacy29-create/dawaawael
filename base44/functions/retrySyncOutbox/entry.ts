import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { sendToSupabase, isConfigured, shouldFail } from '../../shared/dawaaSync.ts';

const MANAGEMENT_SYNC_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-customer-order-sync';

async function reconcileCustomerOrdersToManagement(base44) {
  const endpoint = secrets.get('DAWAA_PHARMACY_SYNC_ENDPOINT') || MANAGEMENT_SYNC_ENDPOINT;
  const secret = secrets.get('DAWAA_PHARMACY_SYNC_SECRET') || '';
  if (!secret) {
    return { success: false, skipped: true, error: 'DAWAA_PHARMACY_SYNC_SECRET missing' };
  }

  const records = await base44.asServiceRole.entities.CustomerOrder.list('-updated_date', 200, 0);
  if (!Array.isArray(records) || records.length === 0) {
    return { success: true, records_sent: 0 };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dawaa-Sync-Secret': secret,
      'X-Dawaa-Event-Id': `dawaawael:CustomerOrder:reconcile:${new Date().toISOString().slice(0, 16)}`,
    },
    body: JSON.stringify({
      mode: 'reconcile_recent',
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

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const mode = body.mode || "retry_pending";
    const limit = Math.min(body.limit || 50, 50);

    const endpoint = secrets.get("DAWAA_SYNC_ENDPOINT") || "";
    const secret = secrets.get("DAWAA_SYNC_SECRET") || "";

    // Test connection mode
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

    // Retry a specific event
    if (mode === "retry_specific") {
      const { event_id } = body;
      if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });
      const records = await base44.asServiceRole.entities.SyncOutbox.filter({ event_id });
      if (records.length === 0) return Response.json({ error: "not found" }, { status: 404 });
      const record = records[0];

      const result = await sendToSupabase(endpoint, secret, {
        event_id: record.event_id,
        entity_name: record.entity_name,
        record_id: record.record_id,
        event_type: record.event_type,
        payload: JSON.parse(record.payload || "{}"),
        source_created_at: record.source_created_at,
        source_updated_at: record.source_updated_at
      });

      const now = new Date().toISOString();
      const newAttempts = (record.attempts || 0) + 1;

      if (result.success) {
        await base44.asServiceRole.entities.SyncOutbox.update(record.id, {
          status: "synced",
          synced_at: now,
          response_data: result.data,
          attempts: newAttempts,
          last_attempt_at: now,
          last_error: ""
        });
        return Response.json({ status: "synced", event_id });
      } else {
        const newStatus = shouldFail(newAttempts) ? "failed" : "pending_retry";
        await base44.asServiceRole.entities.SyncOutbox.update(record.id, {
          status: newStatus,
          attempts: newAttempts,
          last_attempt_at: now,
          last_error: result.error
        });
        return Response.json({ status: newStatus, event_id, error: result.error });
      }
    }

    // Default: retry pending_retry batch
    const pendingRecords = await base44.asServiceRole.entities.SyncOutbox.filter(
      { status: "pending_retry" },
      "-created_date",
      limit
    );

    let synced = 0, failed = 0, retried = 0;

    for (const record of pendingRecords) {
      const result = await sendToSupabase(endpoint, secret, {
        event_id: record.event_id,
        entity_name: record.entity_name,
        record_id: record.record_id,
        event_type: record.event_type,
        payload: JSON.parse(record.payload || "{}"),
        source_created_at: record.source_created_at,
        source_updated_at: record.source_updated_at
      });

      const now = new Date().toISOString();
      const newAttempts = (record.attempts || 0) + 1;

      if (result.success) {
        await base44.asServiceRole.entities.SyncOutbox.update(record.id, {
          status: "synced",
          synced_at: now,
          response_data: result.data,
          attempts: newAttempts,
          last_attempt_at: now,
          last_error: ""
        });
        synced++;
      } else {
        const newStatus = shouldFail(newAttempts) ? "failed" : "pending_retry";
        await base44.asServiceRole.entities.SyncOutbox.update(record.id, {
          status: newStatus,
          attempts: newAttempts,
          last_attempt_at: now,
          last_error: result.error
        });
        if (newStatus === "failed") failed++;
        else retried++;
      }
    }

    // Independent catch-up for the management app. The scheduled workflow runs this function every 5 minutes,
    // so a missed/failed live event is repaired without waiting for a manual full snapshot.
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}