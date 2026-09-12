import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function stripBase44Meta(snapshot: any) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const {
    id,
    created_date,
    updated_date,
    created_by_id,
    ...data
  } = snapshot;
  return data;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });
    if (String(user.role || '') !== 'admin') {
      return Response.json({ error: 'استعادة السجلات المالية متاحة للمدير العام فقط' }, { status: 403 });
    }

    const body: any = await req.json().catch(() => ({}));
    const archiveId = clean(body?.archive_log_id);
    const restoreNote = clean(body?.restore_note);
    if (!archiveId) return Response.json({ error: 'معرف سجل الأرشيف مطلوب' }, { status: 400 });

    const archive: any = await base44.asServiceRole.entities.FinancialArchiveLog.get(archiveId);
    if (!archive) return Response.json({ error: 'سجل الأرشيف غير موجود' }, { status: 404 });
    if (archive.restored_entity_id) {
      return Response.json({
        success: true,
        already_restored: true,
        restored_entity_id: archive.restored_entity_id,
        restored_at: archive.restored_at,
      });
    }

    const snapshot = stripBase44Meta(archive.snapshot);
    const entityType = clean(archive.entity_type);
    let restored: any;

    if (entityType === 'PurchaseInvoice') {
      const invoiceNumber = clean(snapshot.system_invoice_number);
      const branch = clean(snapshot.branch);
      if (!invoiceNumber || !branch) {
        return Response.json({ error: 'Snapshot الفاتورة ناقص رقم الفاتورة أو الفرع' }, { status: 400 });
      }
      const existing = await base44.asServiceRole.entities.PurchaseInvoice.filter({
        system_invoice_number: invoiceNumber,
        branch,
      });
      if (existing?.[0]) {
        return Response.json({
          error: `يوجد بالفعل فاتورة رقم ${invoiceNumber} في ${branch}. تم منع الاستعادة لتجنب التكرار.`,
          duplicate_id: existing[0].id,
        }, { status: 409 });
      }
      restored = await base44.asServiceRole.entities.PurchaseInvoice.create(snapshot);
    } else if (entityType === 'Return') {
      const returnNumber = clean(snapshot.return_number);
      if (returnNumber) {
        const existing = await base44.asServiceRole.entities.Return.filter({ return_number: returnNumber });
        if (existing?.[0]) {
          return Response.json({
            error: `يوجد بالفعل مرتجع رقم ${returnNumber}. تم منع الاستعادة لتجنب التكرار.`,
            duplicate_id: existing[0].id,
          }, { status: 409 });
        }
      } else {
        const invoiceNumber = clean(snapshot.invoice_number);
        const branchName = clean(snapshot.branch_name);
        if (invoiceNumber && branchName) {
          const candidates = await base44.asServiceRole.entities.Return.filter({ invoice_number: invoiceNumber, branch_name: branchName });
          const same = candidates.find((r: any) => clean(r.supplier_name) === clean(snapshot.supplier_name));
          if (same) {
            return Response.json({
              error: 'يوجد بالفعل مرتجع مطابق لنفس الفاتورة والفرع والمورد. تم منع الاستعادة لتجنب التكرار.',
              duplicate_id: same.id,
            }, { status: 409 });
          }
        }
      }
      restored = await base44.asServiceRole.entities.Return.create(snapshot);
    } else {
      return Response.json({ error: 'نوع السجل المؤرشف غير مدعوم للاستعادة' }, { status: 400 });
    }

    const actor = clean(user.full_name) || clean(user.email) || clean(user.id) || 'مدير النظام';
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.FinancialArchiveLog.update(archiveId, {
      restored_at: now,
      restored_by: actor,
      restored_entity_id: restored.id,
      restore_note: restoreNote || 'تمت الاستعادة من النسخة المحفوظة',
    });

    return Response.json({
      success: true,
      entity_type: entityType,
      restored_entity_id: restored.id,
      restored_at: now,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر استعادة السجل المالي' }, { status: 500 });
  }
}
