import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const VERIFY_ENDPOINT = 'https://jkjqeqkshllustwlzzbf.supabase.co/functions/v1/dawaawael-verify-staff';
const VALID_BRANCHES = new Set(['دواء شكري', 'دواء الشامي']);
const VALID_SHIFTS = new Set(['صباحي', 'مسائي', 'ليلي']);
const normalizeEmployeeName = (value: unknown) => String(value ?? '').trim().replace(/[\\/]/g, ' ').replace(/\s+/g, ' ');
const SHIFT_DELIVERY_EXCLUDED_EMPLOYEES = new Set([
  'احمد وجيه',
  'محمود الغباري',
  'محمود',
  'يوسف ماهر',
  'احمد السيد',
  'محمد الالفي',
  'محمد الديب',
  'محمد حافظ',
  'عبد الرحمن',
  'حسين',
  'مصطفي',
  'عم محمد سالم',
  'يوسف عيد',
  'اسلام السبع',
].map(normalizeEmployeeName));

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function cairoDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function cairoHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
}

function previousDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  x.setUTCDate(x.getUTCDate() - 1);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

function businessDateForShift(shiftType: string, now = new Date()) {
  const today = cairoDate(now);
  // المسائي قد يُقفل بعد منتصف الليل وحتى قبل 4 صباحًا، ويظل تابعًا لليوم التشغيلي السابق.
  if (shiftType === 'مسائي' && cairoHour(now) < 4) return previousDate(today);
  return today;
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

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const adminStaffId = clean(body?.admin_staff_id);
    const credential = String(body?.credential ?? '');
    const delivery = body?.delivery || {};
    const branch = clean(delivery.branch);
    const shiftType = clean(delivery.shift_type);
    const requestedBusinessDate = clean(delivery.business_date);
    const totalSales = Number(delivery.total_sales || 0);
    const cashSales = Math.max(0, Number(delivery.cash_sales || 0));
    const visaSales = Math.max(0, Number(delivery.visa_sales || 0));
    const instaSales = Math.max(0, Number(delivery.insta_sales || 0));
    const vodafoneSales = Math.max(0, Number(delivery.vodafone_sales || 0));
    const otherSales = Math.max(0, Number(delivery.other_sales || 0));
    const paymentBreakdownTotal = cashSales + visaSales + instaSales + vodafoneSales + otherSales;
    const idempotencyKey = clean(delivery.idempotency_key);

    if (!adminStaffId || !credential) return Response.json({ error: 'بيانات التحقق مطلوبة' }, { status: 400 });
    if (!VALID_BRANCHES.has(branch)) return Response.json({ error: 'الفرع غير صالح' }, { status: 400 });
    if (!VALID_SHIFTS.has(shiftType)) return Response.json({ error: 'نوع الشيفت غير صالح' }, { status: 400 });
    if (!Number.isFinite(totalSales) || totalSales <= 0) return Response.json({ error: 'إجمالي المبيعات غير صالح' }, { status: 400 });
    if (paymentBreakdownTotal <= 0 || Math.abs(paymentBreakdownTotal - totalSales) > 0.01) {
      return Response.json({ error: 'تفصيل وسائل التحصيل لا يساوي إجمالي المبيعات' }, { status: 400 });
    }

    const mappings = await base44.asServiceRole.entities.EmployeeNameMap.filter({ admin_staff_id: adminStaffId, is_active: true });
    const mapping = mappings.find((m: any) => m.branch === 'كل الفروع' || clean(m.branch) === branch);
    if (!mapping) return Response.json({ error: 'الموظف غير مربوط بهذا الفرع في سجل الأسماء الرسمي' }, { status: 403 });
    const canonicalName = normalizeEmployeeName(mapping.canonical_name);
    const aliases = Array.isArray(mapping.aliases) ? mapping.aliases.map(normalizeEmployeeName) : [];
    if (SHIFT_DELIVERY_EXCLUDED_EMPLOYEES.has(canonicalName) || aliases.some((name: string) => SHIFT_DELIVERY_EXCLUDED_EMPLOYEES.has(name))) {
      return Response.json({ error: 'هذا الموظف من فريق الدليفري وغير مسموح له بتسليم شيفت الصيدلية' }, { status: 403 });
    }

    const verification: any = await verifyStaff(adminStaffId, credential);
    if (!verification.ok) return Response.json({ error: verification.error }, { status: verification.status });

    const staff = verification.result?.staff || {};
    const now = new Date();
    const recordedAt = now.toISOString();
    // عند استكمال مسودة قديمة نلتزم بتاريخها التشغيلي بدل إجبارها على تاريخ اليوم الحالي.
    // لو لم يأتِ تاريخ صالح من الواجهة نرجع للسلوك المعتاد ونحسبه من وقت التنفيذ.
    const shiftDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedBusinessDate)
      ? requestedBusinessDate
      : businessDateForShift(shiftType, now);
    const expenses = Array.isArray(delivery.expenses)
      ? delivery.expenses
          .map((e: any) => ({
            description: clean(e?.description),
            amount: Math.max(0, Number(e?.amount || 0)),
            category: clean(e?.category) || 'أخرى',
            payment_source: ['cash', 'insta', 'vodafone', 'bank', 'other'].includes(clean(e?.payment_source)) ? clean(e?.payment_source) : 'cash',
          }))
          .filter((e: any) => Number.isFinite(e.amount) && (e.amount > 0 || e.description || e.category))
      : [];
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const cashExpenses = expenses.filter((e: any) => e.payment_source === 'cash').reduce((sum: number, e: any) => sum + e.amount, 0);
    const expectedCash = Math.max(0, cashSales - cashExpenses);
    const cashHandover = Math.max(0, Number(delivery.cash_handover || 0));
    const cashVariance = cashHandover - expectedCash;
    const workflowStatus = Math.abs(cashVariance) > 1 || clean(delivery.workflow_status) === 'under_review' ? 'under_review' : 'submitted';

    if (idempotencyKey) {
      const prior = await base44.asServiceRole.entities.ShiftDelivery.filter({ idempotency_key: idempotencyKey });
      const existingAttempt = prior.find((item: any) => item?.is_archived !== true);
      if (existingAttempt) return Response.json({ success: true, record: existingAttempt, idempotent_replay: true });
    }

    // منع تكرار نفس تسليم الشيفت. السجل المؤرشف لا يمنع إعادة التسجيل،
    // أما أي سجل تشغيلي موجود لنفس الفرع + التاريخ + نوع الشيفت فيوقف الإنشاء.
    const existingShifts = await base44.asServiceRole.entities.ShiftDelivery.filter({
      branch,
      shift_type: shiftType,
      shift_date: shiftDate,
    });
    const existingActive = existingShifts.find((item: any) => item?.is_archived !== true);
    if (existingActive) {
      return Response.json({
        error: `تم تسجيل الشيفت ${shiftType} بالفعل لفرع ${branch} بتاريخ ${shiftDate}`,
        code: 'duplicate_shift_delivery',
        existing_id: existingActive.id,
      }, { status: 409 });
    }

    const created = await base44.asServiceRole.entities.ShiftDelivery.create({
      branch,
      shift_type: shiftType,
      shift_date: shiftDate,
      recorded_at: recordedAt,
      calculation_date: shiftDate,
      submitted_by: clean(staff.name) || clean(mapping.canonical_name),
      submitted_by_staff_id: clean(staff.staff_id) || adminStaffId,
      submitted_by_admin_staff_id: adminStaffId,
      identity_verified_at: clean(verification.result?.verified_at) || recordedAt,
      identity_verification_source: clean(verification.result?.source) || 'DawaaManagement',
      total_sales: totalSales,
      cash_sales: cashSales,
      visa_sales: visaSales,
      insta_sales: instaSales,
      vodafone_sales: vodafoneSales,
      other_sales: otherSales,
      payment_breakdown_total: paymentBreakdownTotal,
      cash_handover: cashHandover,
      cash_variance: cashVariance,
      expenses,
      total_expenses: totalExpenses,
      net_amount: totalSales - totalExpenses,
      status: 'مؤكد',
      workflow_status: workflowStatus,
      idempotency_key: idempotencyKey,
      notes: clean(delivery.notes),
    });

    return Response.json({ success: true, record: created });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ التسليم' }, { status: 500 });
  }
}
