import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const VERIFY_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-verify-staff';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ valid: false, error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });
    }

    const body = await req.json();
    const adminStaffId = clean(body?.admin_staff_id || body?.staff_id);
    const credential = String(body?.credential ?? body?.pin ?? '');

    if (!adminStaffId || !credential) {
      return Response.json({ valid: false, error: 'يجب اختيار الموظف وإدخال الرقم السري' }, { status: 400 });
    }
    if (credential.length > 256) {
      return Response.json({ valid: false, error: 'بيانات التحقق غير صالحة' }, { status: 400 });
    }

    // نفس سر المزامنة المستخدم بالفعل بين DawaaWael وتطبيق الإدارة.
    // لا يتم إرساله للواجهة ولا حفظ الرقم السري داخل Base44.
    const secret = secrets.get('DAWAA_PHARMACY_SYNC_SECRET') || '';
    if (!secret) {
      return Response.json({ valid: false, error: 'إعداد التحقق مع تطبيق الإدارة غير مكتمل' }, { status: 503 });
    }

    const response = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dawaa-Sync-Secret': secret,
      },
      body: JSON.stringify({
        admin_staff_id: adminStaffId,
        credential,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.verified !== true) {
      const messages: Record<string, string> = {
        staff_not_linked: 'الموظف غير مربوط بحساب في تطبيق الإدارة',
        account_inactive: 'حساب الموظف غير نشط في تطبيق الإدارة',
        account_locked: 'حساب الموظف مقفول مؤقتًا',
        invalid_credential: 'الرقم السري غير صحيح',
        verification_disabled: 'خدمة التحقق متوقفة مؤقتًا',
        unauthorized: 'تعذر المصادقة مع تطبيق الإدارة',
      };
      const code = clean(result?.error);
      return Response.json({
        valid: false,
        error: messages[code] || 'تعذر التحقق من هوية الموظف',
        code: code || `http_${response.status}`,
      }, { status: response.status >= 500 ? 503 : 200 });
    }

    const staff = result?.staff || {};
    return Response.json({
      valid: true,
      staff_id: clean(staff.staff_id) || adminStaffId,
      admin_staff_id: adminStaffId,
      display_name: clean(staff.name),
      branch: clean(staff.branch),
      job_title: clean(staff.job_title),
      verified_at: clean(result?.verified_at) || new Date().toISOString(),
      source: clean(result?.source) || 'DawaaManagement',
    });
  } catch (error) {
    return Response.json({ valid: false, error: error instanceof Error ? error.message : 'حدث خطأ أثناء التحقق' }, { status: 500 });
  }
}
