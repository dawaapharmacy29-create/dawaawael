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
      return Response.json({ error: 'ليس لديك صلاحية إدارة الموردين' }, { status: 403 });
    }

    const body: any = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const action = clean(body?.action) || 'archive';
    if (!id) return Response.json({ error: 'معرف المورد مطلوب' }, { status: 400 });
    if (!['archive', 'restore'].includes(action)) return Response.json({ error: 'الإجراء غير مدعوم' }, { status: 400 });

    const supplier: any = await base44.asServiceRole.entities.Supplier.get(id);
    if (!supplier) return Response.json({ error: 'المورد غير موجود' }, { status: 404 });
    const actor = clean(user.full_name) || clean(user.email) || clean(user.id) || 'مستخدم النظام';

    if (action === 'archive') {
      if (supplier.is_active === false) return Response.json({ success: true, record: supplier, idempotent: true });
      const updated = await base44.asServiceRole.entities.Supplier.update(id, {
        is_active: false,
        archived_at: new Date().toISOString(),
        archived_by: actor,
        archive_reason: clean(body?.archive_reason) || 'أرشفة مورد',
        archive_note: clean(body?.archive_note) || 'تمت الأرشفة بدل الحذف النهائي للحفاظ على تاريخ الفواتير والقواعد',
      });
      return Response.json({ success: true, record: updated, action: 'archive' });
    }

    if (supplier.is_active !== false) return Response.json({ success: true, record: supplier, idempotent: true });
    const restored = await base44.asServiceRole.entities.Supplier.update(id, {
      is_active: true,
      archived_at: null,
      archived_by: '',
      archive_reason: '',
      archive_note: '',
    });
    return Response.json({ success: true, record: restored, action: 'restore' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر تحديث حالة المورد' }, { status: 500 });
  }
}
