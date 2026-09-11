import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import bcrypt from 'npm:bcryptjs@2.4.3';

const PROJECT_NAME = 'dawaapharmacy-bills';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ valid: false, error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });
    }

    const { pin } = await req.json();
    if (!pin || String(pin).trim().length < 3) {
      return Response.json({ valid: false, error: 'الرقم السري غير صحيح' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('supabase');

    // تحديد مشروع تطبيق الإدارة تلقائيًا
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const projects = await projectsRes.json();
    const projectList = Array.isArray(projects) ? projects : [];
    const project = projectList.find((p) => p.name === PROJECT_NAME) || projectList[0];
    if (!project) {
      return Response.json({ valid: false, error: 'تعذر الوصول إلى مشروع تطبيق الإدارة' });
    }

    // سحب حسابات الموظفين المفعّل فيها الرقم السري
    const sqlRes = await fetch(`https://api.supabase.com/v1/projects/${project.ref}/database/query/read-only`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'SELECT id, username, display_name, role, status, pin_enabled, pin_hash, locked_until FROM staff_accounts WHERE pin_enabled = true',
      }),
    });
    if (!sqlRes.ok) {
      return Response.json({ valid: false, error: 'تعذر الوصول إلى حسابات الموظفين في تطبيق الإدارة' });
    }
    const accounts = await sqlRes.json();
    const now = new Date();

    for (const acc of (Array.isArray(accounts) ? accounts : [])) {
      if (acc.status !== 'active') continue;
      if (acc.locked_until && new Date(acc.locked_until) > now) continue;
      let matched = false;
      try {
        matched = bcrypt.compareSync(String(pin).trim(), acc.pin_hash || '');
      } catch (e) {
        matched = false;
      }
      if (matched) {
        return Response.json({
          valid: true,
          display_name: acc.display_name,
          username: acc.username,
          role: acc.role,
        });
      }
    }

    return Response.json({ valid: false, error: 'الرقم السري غير صحيح' });
  } catch (error) {
    return Response.json({ valid: false, error: error.message || 'حدث خطأ أثناء التحقق' }, { status: 500 });
  }
}