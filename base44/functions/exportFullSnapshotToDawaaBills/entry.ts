import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const SUPPORTED_ENTITIES = new Set([
  'ShiftDelivery',
  'PurchaseInvoice',
  'CustomerOrder',
  'PharmacyOrder',
  'SupplierPayment',
  'Expense',
  'Return',
  'Supplier',
]);

const MAX_BATCH_SIZE = 200;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const entityName = String(body.entity_name || '').trim();
    const batchSize = Math.min(Math.max(Number(body.batch_size || MAX_BATCH_SIZE), 1), MAX_BATCH_SIZE);
    const offset = Math.max(Number(body.offset || 0), 0);
    const snapshotId = String(body.snapshot_id || crypto.randomUUID());

    if (!SUPPORTED_ENTITIES.has(entityName)) {
      return Response.json({
        error: 'unsupported_entity',
        supported_entities: [...SUPPORTED_ENTITIES],
      }, { status: 400 });
    }

    // ShiftDelivery is already fully reconciled in DAWAAPHARMACY-BILLS.
    // Keep real-time events enabled, but skip the redundant historical snapshot
    // so an old malformed record cannot block the rest of the migration.
    if (entityName === 'ShiftDelivery') {
      return Response.json({
        success: true,
        skipped: true,
        skip_reason: 'already_reconciled',
        snapshot_id: snapshotId,
        entity_name: entityName,
        batch_number: 1,
        records_sent: 0,
        is_last_batch: true,
        next_offset: null,
      });
    }

    const endpoint = secrets.get('DAWAA_SYNC_ENDPOINT') || '';
    const secret = secrets.get('DAWAA_SYNC_SECRET') || '';
    if (!endpoint || !secret) {
      return Response.json({ error: 'sync_config_missing' }, { status: 500 });
    }

    const entityApi = base44.asServiceRole.entities[entityName];
    if (!entityApi?.list) {
      return Response.json({ error: 'entity_api_unavailable', entity_name: entityName }, { status: 500 });
    }

    const records = await entityApi.list('created_date', batchSize, offset);
    const normalizedRecords = Array.isArray(records) ? records : [];
    const batchNumber = Math.floor(offset / batchSize) + 1;
    const isLastBatch = normalizedRecords.length < batchSize;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dawaa-Sync-Secret': secret,
        'X-Dawaa-Event-Id': `${snapshotId}:${entityName}:${batchNumber}`,
      },
      body: JSON.stringify({
        mode: 'full_snapshot',
        snapshot_id: snapshotId,
        source_system: 'base44',
        source_entity: entityName,
        batch_number: batchNumber,
        is_last_batch: isLastBatch,
        records: normalizedRecords,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      return Response.json({
        error: 'snapshot_send_failed',
        status: response.status,
        details: responseText.slice(0, 1000),
        snapshot_id: snapshotId,
        entity_name: entityName,
        batch_number: batchNumber,
        offset,
      }, { status: 502 });
    }

    return Response.json({
      success: true,
      snapshot_id: snapshotId,
      entity_name: entityName,
      batch_number: batchNumber,
      records_sent: normalizedRecords.length,
      is_last_batch: isLastBatch,
      next_offset: isLastBatch ? null : offset + normalizedRecords.length,
      receiver_response: responseText.slice(0, 2000),
    });
  } catch (error) {
    return Response.json({
      error: error?.message || 'snapshot_export_failed',
    }, { status: 500 });
  }
}
