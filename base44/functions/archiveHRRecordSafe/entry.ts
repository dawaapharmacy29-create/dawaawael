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
      return Response.json({ error: 'ليس لديك صلاحية أرشفة سجلات شؤون الموظفين' }, { status: 403 });
    }

    const body: any = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const entityType = clean(body?.entity_type);
    const action = clean(body?.action) || 'archive';
    const reason = clean(body?.archive_reason) || 'أرشفة سجل شؤون موظفين';
    const note = clean(body?.archive_note);

    if (!id) return Response.json({ error: 'معرف السجل مطلوب' }, { status: 400 });
    if (!['EmployeeLoan', 'EmployeePermission', 'EmployeeLeave'].includes(entityType)) {
      return Response.json({ error: 'نوع سجل HR غير مدعوم' }, { status: 400 });
    }
    if (!['archive', 'restore'].includes(action)) {
      return Response.json({ error: 'الإجراء غير مدعوم' }, { status: 400 });
    }

    const entities: Record<string, any> = {
      EmployeeLoan: base44.asServiceRole.entities.EmployeeLoan,
      EmployeePermission: base44.asServiceRole.entities.EmployeePermission,
      EmployeeLeave: base44.asServiceRole.entities.EmployeeLeave,
    };
    const entity = entities[entityType];
    const record: any = await entity.get(id);
    if (!record) return Response.json({ error: 'السجل غير موجود' }, { status: 404 });

    const actor = clean(user.full_name) || clean(user.email) || clean(user.id) || 'مستخدم النظام';
    const now = new Date().toISOString();

    if (action === 'archive') {
      if (record.is_archived === true) return Response.json({ success: true, record, idempotent: true });
      const updates: any = {
        is_archived: true,
        archived_at: now,
        archived_by: actor,
        archive_reason: reason,
        archive_note: note,
      };
      if (entityType === 'EmployeeLoan') {
        updates.status_before_archive = clean(record.status) || 'نشطة';
        updates.status = 'ملغاة';
      }
      const updated = await entity.update(id, updates);
      return Response.json({ success: true, record: updated, action: 'archive' });
    }

    if (record.is_archived !== true) return Response.json({ success: true, record, idempotent: true });
    const restoreUpdates: any = {
      is_archived: false,
      archived_at: null,
      archived_by: '',
      archive_reason: '',
      archive_note: '',
    };
    if (entityType === 'EmployeeLoan') {
      restoreUpdates.status = clean(record.status_before_archive) || 'نشطة';
      restoreUpdates.status_before_archive = '';
    }
    const restored = await entity.update(id, restoreUpdates);
    return Response.json({ success: true, record: restored, action: 'restore' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر تنفيذ أرشفة سجل HR' }, { status: 500 });
  }
}
