import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeUsername(value: unknown) {
  return clean(value).toLocaleLowerCase('ar-EG').replace(/\s+/g, ' ');
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);
    if (!username || username.length > 80) {
      return Response.json({ success: false, error: 'invalid_username' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const rows = await base44.asServiceRole.entities.ManagementLoginDirectory.filter({ is_active: true });
    const match = rows.find((row: any) => normalizeUsername(row.login_username) === username);

    // لا نميز بين اسم مستخدم غير موجود وحساب غير مربوط لتقليل كشف دليل الحسابات.
    if (!match || !clean(match.base44_email)) {
      return Response.json({ success: false, error: 'account_not_ready' }, { status: 200 });
    }

    return Response.json({
      success: true,
      email: clean(match.base44_email),
      display_name: clean(match.display_name),
      financial_access_level: clean(match.financial_access_level) || 'none',
    });
  } catch {
    return Response.json({ success: false, error: 'resolver_unavailable' }, { status: 503 });
  }
}
