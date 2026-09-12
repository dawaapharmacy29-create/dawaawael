import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    if (!['admin', 'manager'].includes(String(user.role || ''))) {
      return Response.json({ error: 'ليس لديك صلاحية حذف المرتجعات' }, { status: 403 });
    }

    const body: any = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const reason = clean(body?.reason) || 'حذف مرتجع من التشغيل';
    const note = clean(body?.note);
    if (!id) return Response.json({ error: 'معرف المرتجع مطلوب' }, { status: 400 });

    const record: any = await base44.asServiceRole.entities.Return.get(id);
    if (!record) return Response.json({ error: 'المرتجع غير موجود' }, { status: 404 });

    const actor = clean(user.full_name) || clean(user.email) || clean(user.id) || 'مستخدم النظام';
    const now = new Date().toISOString();

    const existing = await base44.asServiceRole.entities.FinancialArchiveLog.filter({ entity_type: 'Return', entity_id: id });
    let archiveRecord = existing?.[0];
    if (!archiveRecord) {
      archiveRecord = await base44.asServiceRole.entities.FinancialArchiveLog.create({
        entity_type: 'Return',
        entity_id: id,
        entity_label: clean(record.return_number) || clean(record.invoice_number) || id,
        branch: clean(record.branch_name),
        archived_by: actor,
        archived_at: now,
        archive_reason: reason,
        archive_note: note,
        snapshot: record,
      });
    }

    await base44.asServiceRole.entities.Return.delete(id);

    return Response.json({
      success: true,
      deleted_id: id,
      archive_log_id: archiveRecord?.id || '',
      archived_at: archiveRecord?.archived_at || now,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر حذف المرتجع بأمان' }, { status: 500 });
  }
}
