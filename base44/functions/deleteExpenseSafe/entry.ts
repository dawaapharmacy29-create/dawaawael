import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const body: any = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const entityType = clean(body?.entity_type);
    const reason = clean(body?.reason) || 'حذف مصروف من التشغيل';
    const note = clean(body?.note);
    if (!id) return Response.json({ error: 'معرف المصروف مطلوب' }, { status: 400 });
    if (!['Expense', 'AdminOneTimeExpense'].includes(entityType)) {
      return Response.json({ error: 'نوع المصروف غير مدعوم' }, { status: 400 });
    }

    const isAdmin = String(user.role || '') === 'admin';
    const isManager = String(user.role || '') === 'manager';
    if (entityType === 'AdminOneTimeExpense' && !isAdmin) {
      return Response.json({ error: 'حذف المصروفات الإدارية متاح للمدير العام فقط' }, { status: 403 });
    }
    if (entityType === 'Expense' && !isAdmin && !isManager) {
      return Response.json({ error: 'ليس لديك صلاحية حذف المصروفات' }, { status: 403 });
    }

    const entity: any = entityType === 'Expense'
      ? base44.asServiceRole.entities.Expense
      : base44.asServiceRole.entities.AdminOneTimeExpense;
    const record: any = await entity.get(id);
    if (!record) return Response.json({ error: 'المصروف غير موجود' }, { status: 404 });

    const actor = clean(user.full_name) || clean(user.email) || clean(user.id) || 'مستخدم النظام';
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.FinancialArchiveLog.filter({ entity_type: entityType, entity_id: id });
    let archiveRecord = existing?.[0];
    if (!archiveRecord) {
      archiveRecord = await base44.asServiceRole.entities.FinancialArchiveLog.create({
        entity_type: entityType,
        entity_id: id,
        entity_label: entityType === 'Expense' ? clean(record.description) || id : clean(record.name) || id,
        branch: clean(record.branch),
        archived_by: actor,
        archived_at: now,
        archive_reason: reason,
        archive_note: note,
        snapshot: record,
      });
    }

    await entity.delete(id);
    return Response.json({
      success: true,
      deleted_id: id,
      archive_log_id: archiveRecord?.id || '',
      archived_at: archiveRecord?.archived_at || now,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر حذف المصروف بأمان' }, { status: 500 });
  }
}
