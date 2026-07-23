import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const START_DATE = "2026-07-15";
const BATCH_SIZE = 500;

const BRANCH_SHUKRI = "دواء شكري";
const BRANCH_SHAMI = "دواء الشامي";

// Inline resolve logic (same as resolveInvoiceSupplierRules)
function resolveRules(supplier, branch, currentCat, currentSource, preserveManual) {
  let resolved_transaction_type = 'external_purchase';
  let source_branch = '';
  let destination_branch = '';
  let transaction_review = false;
  let transaction_review_reason = '';
  let resolved_cat = currentCat || 'unclassified';
  let resolved_source = currentSource || 'manual';
  let requires_manual_category = false;
  let requires_review = false;
  let review_reason = '';

  // Transaction type
  if (supplier?.supplier_type === 'internal_branch') {
    const linkedBranch = supplier.linked_branch || '';
    if (!linkedBranch) {
      transaction_review = true;
      transaction_review_reason = 'internal_supplier_without_linked_branch';
    } else if (linkedBranch === branch) {
      transaction_review = true;
      transaction_review_reason = 'source_equals_destination';
    } else {
      resolved_transaction_type = 'internal_transfer';
      source_branch = linkedBranch;
      destination_branch = branch;
    }
  }

  // Category
  const isManual = currentSource === 'manual';
  if (isManual && preserveManual) {
    // keep current
  } else {
    const sc = supplier?.default_purchase_category || 'none';
    if (sc === 'medicines') {
      resolved_cat = 'medicines';
      resolved_source = 'supplier_backfill';
    } else if (sc === 'supplies_accessories') {
      resolved_cat = 'supplies_accessories';
      resolved_source = 'supplier_backfill';
    } else if (sc === 'mixed') {
      requires_manual_category = true;
      if (!currentCat || currentCat === 'unclassified') {
        resolved_cat = 'unclassified';
        resolved_source = 'manual';
      }
    } else {
      resolved_cat = 'unclassified';
      resolved_source = currentSource || 'manual';
    }
  }

  if (transaction_review) {
    requires_review = true;
    review_reason = transaction_review_reason;
  }

  return {
    resolved_cat, resolved_source, resolved_transaction_type,
    source_branch, destination_branch,
    requires_manual_category, requires_review, review_reason,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      start_date = START_DATE,
      manual_policy = "skip_manual", // skip_manual | override_all
      confirmed = false,
      apply_category = true,
      apply_transaction_type = true,
    } = body;

    // Only admin can run backfill
    if (user.role !== 'admin') {
      // Log rejected attempt
      try {
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'bulk_update',
          entity_type: 'invoice',
          user_email: user.email || '',
          user_name: user.full_name || '',
          user_role: user.role || '',
          status: 'failed',
          reason: 'permission_denied',
          details: `محاولة رجعية لتطبيق قواعد الموردين من ${start_date} — مرفوضة (ليس مدير)`,
        });
      } catch (e) {}
      return Response.json({ error: 'Forbidden: requires admin role' }, { status: 403 });
    }

    const effectiveStart = start_date < START_DATE ? START_DATE : start_date;

    // Fetch all suppliers into a map
    let allSuppliers = [];
    let sPage = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Supplier.list("-created_date", 500, sPage * 500);
      allSuppliers = [...allSuppliers, ...batch];
      if (batch.length < 500) break;
      sPage++;
    }
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));

    // Fetch all invoices >= start_date
    let allInvoices = [];
    let iPage = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.PurchaseInvoice.list("-invoice_date", BATCH_SIZE, iPage * BATCH_SIZE);
      allInvoices = [...allInvoices, ...batch];
      if (batch.length < BATCH_SIZE) break;
      iPage++;
    }

    const eligible = allInvoices.filter(inv => (inv.invoice_date || '') >= effectiveStart);

    // Process each invoice through resolve logic
    const results = eligible.map(inv => {
      const supplier = inv.supplier_id ? supplierMap.get(inv.supplier_id) : null;
      const preserveManual = manual_policy === 'skip_manual';

      const resolved = resolveRules(
        supplier, inv.branch, inv.purchase_category, inv.purchase_category_source, preserveManual
      );

      const catWillChange = apply_category &&
        resolved.resolved_cat !== (inv.purchase_category || 'unclassified');
      const typeWillChange = apply_transaction_type &&
        resolved.resolved_transaction_type !== (inv.transaction_type || 'external_purchase');
      const sourceWillChange = apply_transaction_type &&
        resolved.source_branch !== (inv.source_branch || '');
      const destWillChange = apply_transaction_type &&
        resolved.destination_branch !== (inv.destination_branch || '');

      const willChange = catWillChange || typeWillChange || sourceWillChange || destWillChange;
      const isManualPreserved = inv.purchase_category_source === 'manual' && preserveManual && catWillChange;

      return {
        id: inv.id,
        invoice_number: inv.system_invoice_number,
        supplier_id: inv.supplier_id,
        supplier_name: inv.supplier_name || (supplier?.name || ''),
        branch: inv.branch,
        invoice_date: inv.invoice_date,
        total_value: inv.total_value || 0,
        current_category: inv.purchase_category || 'unclassified',
        current_source: inv.purchase_category_source || '',
        current_transaction_type: inv.transaction_type || 'external_purchase',
        resolved_category: resolved.resolved_cat,
        resolved_source: resolved.resolved_source,
        resolved_transaction_type: resolved.resolved_transaction_type,
        source_branch: resolved.source_branch,
        destination_branch: resolved.destination_branch,
        requires_review: resolved.requires_review,
        review_reason: resolved.review_reason,
        requires_manual_category: resolved.requires_manual_category,
        cat_will_change: catWillChange,
        type_will_change: typeWillChange,
        will_change: willChange,
        manual_preserved: isManualPreserved,
      };
    });

    // Build preview stats
    const toChange = results.filter(r => r.will_change);
    const manualPreserved = results.filter(r => r.manual_preserved);
    const requiresReview = results.filter(r => r.requires_review);
    const requiresManualCat = results.filter(r => r.requires_manual_category);

    const catChanges = toChange.filter(r => r.cat_will_change);
    const typeChanges = toChange.filter(r => r.type_will_change);

    const medicinesChanged = catChanges.filter(r => r.resolved_category === 'medicines').length;
    const suppliesChanged = catChanges.filter(r => r.resolved_category === 'supplies_accessories').length;
    const internalTransfers = results.filter(r => r.resolved_transaction_type === 'internal_transfer').length;
    const newInternalTransfers = typeChanges.filter(r => r.resolved_transaction_type === 'internal_transfer').length;

    const shukriToShami = results.filter(r => r.source_branch === BRANCH_SHUKRI && r.destination_branch === BRANCH_SHAMI).length;
    const shamiToShukri = results.filter(r => r.source_branch === BRANCH_SHAMI && r.destination_branch === BRANCH_SHUKRI).length;

    const totalValue = toChange.reduce((s, r) => s + r.total_value, 0);

    // Branch distribution
    const branchDist = {};
    toChange.forEach(r => {
      const b = r.branch || 'غير محدد';
      branchDist[b] = (branchDist[b] || 0) + 1;
    });

    // Supplier distribution
    const supplierDist = {};
    toChange.forEach(r => {
      const s = r.supplier_name || 'غير محدد';
      supplierDist[s] = (supplierDist[s] || 0) + 1;
    });

    const dates = toChange.map(r => r.invoice_date).filter(Boolean).sort();
    const oldestDate = dates[0] || null;
    const newestDate = dates[dates.length - 1] || null;

    const preview = {
      start_date: effectiveStart,
      total_invoices_reviewed: eligible.length,
      total_will_change: toChange.length,
      category_changes: catChanges.length,
      medicines_changed: medicinesChanged,
      supplies_changed: suppliesChanged,
      transaction_type_changes: typeChanges.length,
      new_internal_transfers: newInternalTransfers,
      total_internal_transfers: internalTransfers,
      shukri_to_shami: shukriToShami,
      shami_to_shukri: shamiToShukri,
      manual_preserved_count: manualPreserved.length,
      requires_review_count: requiresReview.length,
      requires_manual_category_count: requiresManualCat.length,
      total_value_affected: totalValue,
      branch_distribution: branchDist,
      supplier_distribution: supplierDist,
      oldest_invoice_date: oldestDate,
      newest_invoice_date: newestDate,
      manual_policy: manual_policy,
      apply_category: apply_category,
      apply_transaction_type: apply_transaction_type,
    };

    // Log preview activity
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'bulk_update',
        entity_type: 'invoice',
        user_email: user.email || '',
        user_name: user.full_name || '',
        user_role: user.role || '',
        status: 'success',
        reason: 'preview_backfill',
        details: `معاينة التطبيق الرجعي من ${effectiveStart}: ${toChange.length} فاتورة ستتغير من أصل ${eligible.length} | قيمة: ${totalValue} | تحويلات داخلية جديدة: ${newInternalTransfers} | تحتاج مراجعة: ${requiresReview.length}`,
      });
    } catch (e) {}

    if (!confirmed) {
      return Response.json({ preview, applied: false, sample_changes: toChange.slice(0, 10) });
    }

    // === APPLY ===
    const batchId = `backfill-rules-${Date.now()}`;
    let updatedCount = 0;
    let failedCount = 0;

    const updateData = toChange.map(r => {
      const update = { id: r.id };
      if (r.cat_will_change) {
        update.purchase_category = r.resolved_category;
        update.purchase_category_source = r.resolved_source;
      }
      if (r.type_will_change) {
        update.transaction_type = r.resolved_transaction_type;
        update.transaction_type_source = 'legacy_backfill';
      }
      if (r.source_branch !== undefined && apply_transaction_type) {
        update.source_branch = r.source_branch;
      }
      if (r.destination_branch !== undefined && apply_transaction_type) {
        update.destination_branch = r.destination_branch;
      }
      return update;
    });

    for (let start = 0; start < updateData.length; start += BATCH_SIZE) {
      const batch = updateData.slice(start, start + BATCH_SIZE);
      try {
        await base44.asServiceRole.entities.PurchaseInvoice.bulkUpdate(batch);
        updatedCount += batch.length;
      } catch (e) {
        failedCount += batch.length;
      }
    }

    // Log applied activity
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'bulk_update',
        entity_type: 'invoice',
        user_email: user.email || '',
        user_name: user.full_name || '',
        user_role: user.role || '',
        status: 'success',
        batch_id: batchId,
        reason: 'apply_backfill_rules',
        details: `تطبيق رجعي لقواعد الموردين والتحويلات من ${effectiveStart} | تم تحديث: ${updatedCount} | فشل: ${failedCount} | قيمة: ${totalValue} | تحويلات داخلية جديدة: ${newInternalTransfers} | Batch: ${batchId}`,
      });
    } catch (e) {}

    return Response.json({
      applied: true,
      batch_id: batchId,
      updated_count: updatedCount,
      failed_count: failedCount,
      total_value: totalValue,
      new_internal_transfers: newInternalTransfers,
      manual_preserved: manualPreserved.length,
      requires_review: requiresReview.length,
      start_date: effectiveStart,
      performed_by: user.full_name || user.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});