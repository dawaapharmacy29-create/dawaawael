import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(v: unknown) { return String(v ?? '').trim(); }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const actor: any = await base44.auth.me();
    if (!actor || String(actor.role || '') !== 'admin') {
      return Response.json({ success: false, error: 'غير مصرح' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action) || 'list';

    if (action === 'list') {
      const [directory, users] = await Promise.all([
        base44.asServiceRole.entities.ManagementLoginDirectory.filter({ is_active: true }, 'display_name', 100),
        base44.asServiceRole.entities.User.list('full_name', 100),
      ]);
      return Response.json({
        success: true,
        directory: directory.map((r: any) => ({
          id: r.id,
          login_username: r.login_username,
          admin_staff_id: r.admin_staff_id,
          display_name: r.display_name,
          branch: r.branch,
          management_role: r.management_role,
          financial_access_level: r.financial_access_level,
          base44_user_id: r.base44_user_id || '',
          base44_email: r.base44_email || '',
        })),
        users: users.map((u: any) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role })),
      });
    }

    if (action === 'link') {
      const directoryId = clean(body?.directory_id);
      const base44UserId = clean(body?.base44_user_id);
      if (!directoryId || !base44UserId) return Response.json({ success: false, error: 'بيانات الربط ناقصة' }, { status: 400 });

      const [directoryRow, user, activeDirectory] = await Promise.all([
        base44.asServiceRole.entities.ManagementLoginDirectory.get(directoryId).catch(() => null),
        base44.asServiceRole.entities.User.get(base44UserId).catch(() => null),
        base44.asServiceRole.entities.ManagementLoginDirectory.filter({ is_active: true }, 'display_name', 100),
      ]);
      if (!directoryRow || directoryRow.is_active === false) return Response.json({ success: false, error: 'سجل موظف الإدارة غير موجود أو غير نشط' }, { status: 404 });
      if (!user) return Response.json({ success: false, error: 'حساب Base44 غير موجود' }, { status: 404 });

      const alreadyLinked = activeDirectory.find((row: any) => row.id !== directoryId && clean(row.base44_user_id) === base44UserId);
      if (alreadyLinked) {
        return Response.json({
          success: false,
          error: `حساب Base44 ده مربوط بالفعل بـ ${clean(alreadyLinked.display_name) || 'موظف آخر'}. لازم تفك الربط القديم أولًا.`,
        }, { status: 409 });
      }

      await base44.asServiceRole.entities.ManagementLoginDirectory.update(directoryId, {
        base44_user_id: user.id,
        base44_email: clean(user.email),
        notes: `تم الربط من صفحة المستخدمين بواسطة ${clean(actor.full_name) || clean(actor.email)}`,
      });
      return Response.json({ success: true, linked_user: { id: user.id, email: user.email, full_name: user.full_name } });
    }

    if (action === 'unlink') {
      const directoryId = clean(body?.directory_id);
      if (!directoryId) return Response.json({ success: false, error: 'معرف الربط مطلوب' }, { status: 400 });
      await base44.asServiceRole.entities.ManagementLoginDirectory.update(directoryId, {
        base44_user_id: '',
        base44_email: '',
        notes: `تم إلغاء الربط بواسطة ${clean(actor.full_name) || clean(actor.email)}`,
      });
      return Response.json({ success: true });
    }

    if (action === 'set_financial_level') {
      const directoryId = clean(body?.directory_id);
      const level = clean(body?.financial_access_level);
      if (!directoryId || !['none', 'limited', 'full'].includes(level)) {
        return Response.json({ success: false, error: 'مستوى الصلاحية غير صالح' }, { status: 400 });
      }
      await base44.asServiceRole.entities.ManagementLoginDirectory.update(directoryId, { financial_access_level: level });
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: 'عملية غير مدعومة' }, { status: 400 });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'حدث خطأ' }, { status: 500 });
  }
}
