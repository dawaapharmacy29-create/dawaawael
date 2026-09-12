import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const VERIFY_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-verify-staff';
const VALID_BRANCHES = new Set(['دواء شكري', 'دواء الشامي']);

function clean(value: unknown) {
  return String(value ?? '').trim();
}

async function verifyStaff(adminStaffId: string, credential: string) {
  const secret = secrets.get('DAWAA_PHARMACY_SYNC_SECRET') || '';
  if (!secret) return { ok: false, status: 503, error: 'إعداد التحقق مع تطبيق الإدارة غير مكتمل' };

  const response = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dawaa-Sync-Secret': secret,
    },
    body: JSON.stringify({ admin_staff_id: adminStaffId, credential }),
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
    return { ok: false, status: response.status >= 500 ? 503 : 400, error: messages[code] || 'تعذر التحقق من هوية الموظف' };
  }
  return { ok: true, result };
}

function sanitizeDirectOrder(order: any) {
  return {
    customer_name: clean(order.customer_name),
    phone: clean(order.phone),
    customer_code: clean(order.customer_code),
    branch: clean(order.branch),
    request_source: clean(order.request_source),
    product_name: clean(order.product_name),
    product_image: clean(order.product_image),
    notes: clean(order.notes),
    priority: clean(order.priority) || 'عادي',
    assigned_employee: clean(order.assigned_employee),
    request_date: clean(order.request_date),
    quantity: Math.max(1, Number(order.quantity || 1)),
    customer_type: clean(order.customer_type) || 'عادي',
    request_type: clean(order.request_type) || 'عادي',
    promised_at: clean(order.promised_at),
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = clean(body?.mode) || 'direct_verified';

    if (mode === 'pharmacy_order_transfer') {
      if (!['admin', 'manager'].includes(String(user.role || ''))) {
        return Response.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
      }
      const sourceId = clean(body?.source_order_id);
      if (!sourceId) return Response.json({ error: 'معرف طلب الصيدلية مطلوب' }, { status: 400 });

      const existing = await base44.asServiceRole.entities.CustomerOrder.filter({ source_pharmacy_order_id: sourceId });
      if (existing?.[0]) {
        try { await base44.asServiceRole.entities.PharmacyOrder.delete(sourceId); } catch { /* already removed or not accessible */ }
        return Response.json({ success: true, record: existing[0], idempotent: true });
      }

      const source = await base44.asServiceRole.entities.PharmacyOrder.get(sourceId);
      if (!source) return Response.json({ error: 'طلب الصيدلية غير موجود' }, { status: 404 });

      const now = new Date().toISOString();
      const convertedBy = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
      const {
        id, created_date, updated_date, created_by_id,
        recorded_by_staff_id, recorded_by_admin_staff_id,
        identity_verified_at, identity_verification_source,
        creation_source, source_pharmacy_order_id, converted_by, converted_at,
        ...sourceData
      } = source;

      const created = await base44.asServiceRole.entities.CustomerOrder.create({
        ...sourceData,
        creation_source: 'pharmacy_order_transfer',
        source_pharmacy_order_id: sourceId,
        converted_by: convertedBy,
        converted_at: now,
        timeline: [...(source.timeline || []), {
          status: source.status || 'طلب جديد',
          by: convertedBy,
          at: now,
          note: 'تم النقل إداريًا من طلبات الصيدليات',
        }],
      });

      await base44.asServiceRole.entities.PharmacyOrder.delete(sourceId);
      return Response.json({ success: true, record: created });
    }

    if (mode !== 'direct_verified') return Response.json({ error: 'نوع العملية غير مدعوم' }, { status: 400 });

    const order = sanitizeDirectOrder(body?.order || {});
    const adminStaffId = clean(body?.admin_staff_id);
    const credential = String(body?.credential ?? '');

    if (!order.customer_name || !order.phone || !order.product_name || !order.branch) {
      return Response.json({ error: 'بيانات العميل والفرع والصنف مطلوبة' }, { status: 400 });
    }
    if (!VALID_BRANCHES.has(order.branch)) return Response.json({ error: 'الفرع غير صالح' }, { status: 400 });
    if (!adminStaffId || !credential) return Response.json({ error: 'بيانات التحقق من مُسجِّل الطلب مطلوبة' }, { status: 400 });

    const mappings = await base44.asServiceRole.entities.EmployeeNameMap.filter({ admin_staff_id: adminStaffId, is_active: true });
    const mapping = mappings.find((m: any) => m.branch === 'كل الفروع' || clean(m.branch) === order.branch);
    if (!mapping) return Response.json({ error: 'الموظف غير مربوط بهذا الفرع في سجل الأسماء الرسمي' }, { status: 403 });

    const verification: any = await verifyStaff(adminStaffId, credential);
    if (!verification.ok) return Response.json({ error: verification.error }, { status: verification.status });

    const staff = verification.result?.staff || {};
    const now = new Date().toISOString();
    const recordedBy = clean(mapping.canonical_name) || clean(staff.name);
    const year = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', year: 'numeric' }).format(new Date());
    const orderNumber = `ORD-${year}-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const created = await base44.asServiceRole.entities.CustomerOrder.create({
      ...order,
      status: 'طلب جديد',
      order_number: orderNumber,
      recorded_by: recordedBy,
      registered_by_user_id: clean(user.id),
      recorded_by_staff_id: clean(staff.staff_id) || adminStaffId,
      recorded_by_admin_staff_id: adminStaffId,
      identity_verified_at: clean(verification.result?.verified_at) || now,
      identity_verification_source: clean(verification.result?.source) || 'DawaaManagement',
      creation_source: 'direct_customer_order',
      requested_at: now,
      added_at: new Date().toLocaleString('ar-EG', {
        timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }),
      timeline: [{ status: 'طلب جديد', by: recordedBy, at: now, note: 'تم إنشاء الطلب بعد التحقق من الهوية' }],
    });

    return Response.json({ success: true, record: created });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الطلب' }, { status: 500 });
  }
}
