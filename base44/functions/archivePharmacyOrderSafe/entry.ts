import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });
    if (!['admin', 'manager'].includes(String(user.role || ''))) {
      return Response.json({ error: 'الأرشفة متاحة للإدارة فقط' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const action = clean(body?.action) || 'archive';
    if (!id) return Response.json({ error: 'معرف طلب الصيدلية مطلوب' }, { status: 400 });

    const item = await base44.asServiceRole.entities.PharmacyOrder.get(id);
    if (!item) return Response.json({ error: 'طلب الصيدلية غير موجود' }, { status: 404 });

    const actor = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
    const now = new Date().toISOString();

    if (action === 'archive') {
      const reason = clean(body?.archive_reason) || 'أرشفة طلب صيدلية';
      const note = clean(body?.archive_note);
      const timeline = [...(Array.isArray(item.timeline) ? item.timeline : []), {
        status: clean(item.status) || 'طلب جديد',
        by: actor,
        at: now,
        note: `أرشفة: ${reason}${note ? ` — ${note}` : ''}`,
      }];
      const updated = await base44.asServiceRole.entities.PharmacyOrder.update(id, {
        is_archived: true,
        archived_at: now,
        archived_by: actor,
        archive_reason: reason,
        archive_note: note,
        timeline,
      });
      return Response.json({ success: true, archived: true, record: updated });
    }

    if (action === 'restore_archive') {
      const note = clean(body?.archive_note);
      const timeline = [...(Array.isArray(item.timeline) ? item.timeline : []), {
        status: clean(item.status) || 'طلب جديد',
        by: actor,
        at: now,
        note: `استعادة من الأرشيف${note ? ` — ${note}` : ''}`,
      }];
      const updated = await base44.asServiceRole.entities.PharmacyOrder.update(id, {
        is_archived: false,
        archived_at: '',
        archived_by: '',
        archive_reason: '',
        archive_note: '',
        timeline,
      });
      return Response.json({ success: true, restored: true, record: updated });
    }

    return Response.json({ error: 'نوع العملية غير مدعوم' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر تنفيذ عملية الأرشفة' }, { status: 500 });
  }
}
