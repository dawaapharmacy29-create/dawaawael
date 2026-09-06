import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { sendToSupabase, isConfigured } from '../../shared/dawaaSync.ts';

const MANAGEMENT_SYNC_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-customer-order-sync';

async function syncCustomerOrderToManagement({ record_id, event_type, payload, source_created_at, source_updated_at }) {
  if (!["create", "update"].includes(String(event_type))) {
    return { success: true, skipped: true, reason: 'event_type_not_mirrored' };
  }

  const endpoint = secrets.get("DAWAA_PHARMACY_SYNC_ENDPOINT") || MANAGEMENT_SYNC_ENDPOINT;
  const secret = secrets.get("DAWAA_PHARMACY_SYNC_SECRET") || "";
  if (!secret) {
    return { success: false, status: 0, error: 'DAWAA_PHARMACY_SYNC_SECRET missing' };
  }
  if (!payload || typeof payload !== 'object') {
    return { success: false, status: 0, error: 'CustomerOrder payload missing' };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dawaa-Sync-Secret": secret,
        "X-Dawaa-Event-Id": `dawaawael:CustomerOrder:${record_id}:${source_updated_at || source_created_at || event_type}`,
      },
      body: JSON.stringify({
        mode: "incremental",
        source_system: "dawaawael",
        source_entity: "CustomerOrder",
        records: [{ ...payload, id: payload.id || record_id }],
      }),
    });

    const raw = await response.text();
    return {
      success: response.ok,
      status: response.status,
      data: raw.slice(0, 1000),
      error: response.ok ? '' : `Management HTTP ${response.status}: ${raw.slice(0, 300)}`,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { entity_name, record_id, event_type, payload, source_created_at, source_updated_at } = body;

    if (!entity_name || !record_id || !event_type) {
      return Response.json({ error: "entity_name, record_id, event_type are required" }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.SyncOutbox.filter({
      entity_name,
      record_id,
      event_type,
      source_updated_at: source_updated_at || ""
    });

    let outbox = existing[0] || null;
    if (outbox?.status === 'synced') {
      return Response.json({ skipped: true, reason: "duplicate_synced", event_id: outbox.event_id });
    }

    if (!outbox) {
      const event_id = crypto.randomUUID();
      const payloadStr = payload ? JSON.stringify(payload) : "{}";
      outbox = await base44.asServiceRole.entities.SyncOutbox.create({
        event_id,
        entity_name,
        record_id,
        event_type,
        payload: payloadStr,
        source_created_at: source_created_at || "",
        source_updated_at: source_updated_at || "",
        status: "pending",
        attempts: 0
      });
    }

    const endpoint = secrets.get("DAWAA_SYNC_ENDPOINT") || "";
    const secret = secrets.get("DAWAA_SYNC_SECRET") || "";
    const now = new Date().toISOString();
    const attemptNo = Number(outbox.attempts || 0) + 1;

    if (!isConfigured(endpoint, secret)) {
      await base44.asServiceRole.entities.SyncOutbox.update(outbox.id, {
        status: "pending_retry",
        attempts: attemptNo,
        last_attempt_at: now,
        last_error: "إعدادات مزامنة DawaaBills غير مكتملة"
      });
      return Response.json({ status: "pending_retry", event_id: outbox.event_id, error: "config missing" });
    }

    const primaryResult = await sendToSupabase(endpoint, secret, {
      event_id: outbox.event_id,
      entity_name,
      record_id,
      event_type,
      payload: payload || {},
      source_created_at: source_created_at || "",
      source_updated_at: source_updated_at || ""
    });

    let managementResult = { success: true, skipped: true };
    if (entity_name === 'CustomerOrder') {
      managementResult = await syncCustomerOrderToManagement({
        record_id,
        event_type,
        payload,
        source_created_at,
        source_updated_at,
      });
    }

    const fullySynced = primaryResult.success && managementResult.success;
    const errors = [
      primaryResult.success ? '' : `DawaaBills: ${primaryResult.error || 'sync failed'}`,
      managementResult.success ? '' : `Dawaa Pharmacy: ${managementResult.error || 'sync failed'}`,
    ].filter(Boolean).join(' | ');

    if (fullySynced) {
      await base44.asServiceRole.entities.SyncOutbox.update(outbox.id, {
        status: "synced",
        synced_at: now,
        response_data: JSON.stringify({ primary: primaryResult.data || '', management: managementResult.data || '', management_skipped: managementResult.skipped || false }),
        attempts: attemptNo,
        last_attempt_at: now,
        last_error: ""
      });
      return Response.json({ status: "synced", event_id: outbox.event_id, primary: primaryResult.status, management: managementResult.status || null });
    }

    await base44.asServiceRole.entities.SyncOutbox.update(outbox.id, {
      status: "pending_retry",
      attempts: attemptNo,
      last_attempt_at: now,
      last_error: errors.slice(0, 500),
      response_data: JSON.stringify({ primary_success: primaryResult.success, management_success: managementResult.success })
    });
    return Response.json({ status: "pending_retry", event_id: outbox.event_id, error: errors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
