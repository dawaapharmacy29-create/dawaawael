import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const DEFAULT_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-customer-order-sync';
const MAX_BATCH_SIZE = 200;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Require a real app user. The destination also validates the private sync secret.
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'authentication_required' }, { status: 401 });
    }

    const endpoint = secrets.get('DAWAA_PHARMACY_SYNC_ENDPOINT') || secrets.get('DAWAA_SYNC_ENDPOINT') || DEFAULT_ENDPOINT;
    const secret = secrets.get('DAWAA_PHARMACY_SYNC_SECRET') || secrets.get('DAWAA_SYNC_SECRET') || '';
    if (!secret) {
      return Response.json({
        error: 'sync_secret_missing',
        message: 'أضف DAWAA_PHARMACY_SYNC_SECRET في Secrets الخاصة بتطبيق dawaawael.',
      }, { status: 503 });
    }

    const recordId = String(body?.record_id || '').trim();
    const batchSize = Math.min(Math.max(Number(body?.batch_size || MAX_BATCH_SIZE), 1), MAX_BATCH_SIZE);
    const offset = Math.max(Number(body?.offset || 0), 0);
    const snapshotId = String(body?.snapshot_id || crypto.randomUUID());

    const entityApi = base44.asServiceRole.entities.CustomerOrder;
    let records: any[] = [];
    let isLastBatch = true;
    let batchNumber = 1;

    if (recordId) {
      const row = await entityApi.get(recordId);
      if (!row) {
        return Response.json({ error: 'customer_order_not_found', record_id: recordId }, { status: 404 });
      }
      records = [row];
    } else {
      const listed = await entityApi.list('-updated_date', batchSize, offset);
      records = Array.isArray(listed) ? listed : [];
      isLastBatch = records.length < batchSize;
      batchNumber = Math.floor(offset / batchSize) + 1;
    }

    if (!records.length) {
      return Response.json({
        success: true,
        snapshot_id: snapshotId,
        records_sent: 0,
        is_last_batch: true,
        next_offset: null,
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dawaa-Sync-Secret': secret,
        'X-Dawaa-Event-Id': recordId
          ? `dawaawael:CustomerOrder:${recordId}:${String(records[0]?.updated_date || Date.now())}`
          : `${snapshotId}:CustomerOrder:${batchNumber}`,
      },
      body: JSON.stringify({
        mode: recordId ? 'incremental' : 'full_snapshot',
        snapshot_id: snapshotId,
        source_system: 'dawaawael',
        source_entity: 'CustomerOrder',
        batch_number: batchNumber,
        is_last_batch: isLastBatch,
        records,
      }),
    });

    const responseText = await response.text();
    let receiverResponse: any = null;
    try {
      receiverResponse = JSON.parse(responseText);
    } catch {
      receiverResponse = { raw: responseText.slice(0, 2000) };
    }

    if (!response.ok) {
      return Response.json({
        error: 'management_sync_failed',
        status: response.status,
        receiver_response: receiverResponse,
        snapshot_id: snapshotId,
        batch_number: batchNumber,
      }, { status: 502 });
    }

    return Response.json({
      success: true,
      mode: recordId ? 'incremental' : 'full_snapshot',
      snapshot_id: snapshotId,
      batch_number: batchNumber,
      records_sent: records.length,
      is_last_batch: isLastBatch,
      next_offset: recordId || isLastBatch ? null : offset + records.length,
      receiver_response: receiverResponse,
    });
  } catch (error) {
    return Response.json({
      error: 'customer_order_sync_failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
