import { base44 } from '@/api/base44Client';

/**
 * Best-effort one-way sync from dawaawael CustomerOrder to Dawaa Pharmacy.
 * IMPORTANT: syncing must never block the operational Base44 workflow.
 */
export async function syncCustomerOrderToManagement(recordId) {
  const id = String(recordId || '').trim();
  if (!id) return { skipped: true, reason: 'missing_record_id' };

  try {
    const result = await base44.functions.invoke('syncCustomerOrdersToDawaaPharmacy', {
      record_id: id,
    });
    return result?.data || result || { success: true };
  } catch (error) {
    console.warn('[customer-order-sync] management sync deferred', {
      recordId: id,
      message: error?.message || String(error),
    });
    return {
      success: false,
      deferred: true,
      message: error?.message || String(error),
    };
  }
}

export async function syncCustomerOrdersSnapshot({ offset = 0, batchSize = 200, snapshotId } = {}) {
  try {
    const result = await base44.functions.invoke('syncCustomerOrdersToDawaaPharmacy', {
      offset,
      batch_size: batchSize,
      ...(snapshotId ? { snapshot_id: snapshotId } : {}),
    });
    return result?.data || result;
  } catch (error) {
    return {
      success: false,
      message: error?.message || String(error),
      offset,
    };
  }
}
