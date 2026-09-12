import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VALID_BRANCHES = new Set(['دواء شكري', 'دواء الشامي']);
const VALID_STATUSES = new Set(['نشطة', 'مكتملة', 'ملغاة']);

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function positiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const role = clean(user.role);
    if (!['admin', 'manager'].includes(role)) {
      return Response.json({ error: 'ليس لديك صلاحية إضافة سلفة' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const loan = body?.loan || {};
    const employeeName = clean(loan.employee_name);
    const branch = clean(loan.branch);
    const date = clean(loan.date);
    const amount = positiveNumber(loan.amount);
    const installmentsCount = Math.max(1, Math.floor(Number(loan.installments_count || 1)));
    const paidAmountRaw = Number(loan.paid_amount || 0);
    const paidAmount = Number.isFinite(paidAmountRaw) ? Math.max(0, paidAmountRaw) : 0;
    const status = clean(loan.status) || 'نشطة';

    if (!employeeName) return Response.json({ error: 'يجب تحديد الموظف' }, { status: 400 });
    if (!VALID_BRANCHES.has(branch)) return Response.json({ error: 'الفرع غير صالح' }, { status: 400 });
    if (!date) return Response.json({ error: 'تاريخ السلفة مطلوب' }, { status: 400 });
    if (amount <= 0) return Response.json({ error: 'مبلغ السلفة يجب أن يكون أكبر من صفر' }, { status: 400 });
    if (!VALID_STATUSES.has(status)) return Response.json({ error: 'حالة السلفة غير صالحة' }, { status: 400 });
    if (paidAmount > amount) return Response.json({ error: 'المبلغ المسدد لا يمكن أن يتجاوز مبلغ السلفة' }, { status: 400 });

    const employees: any[] = await base44.asServiceRole.entities.TeamMember.filter({ name: employeeName });
    const employee = employees.find((item: any) => item?.is_active !== false);
    if (!employee) {
      return Response.json({ error: 'الموظف غير موجود ضمن فريق العمل النشط' }, { status: 400 });
    }
    const branches = Array.isArray(employee.branches) ? employee.branches.map(clean) : [];
    if (!branches.includes(branch)) {
      return Response.json({ error: `لا يمكن تسجيل السلفة على ${branch} لأن الموظف غير مرتبط بهذا الفرع` }, { status: 400 });
    }

    const monthlyDeduction = Math.ceil(amount / installmentsCount);
    const created = await base44.asServiceRole.entities.EmployeeLoan.create({
      employee_name: employeeName,
      branch,
      amount,
      date,
      installments_count: installmentsCount,
      monthly_deduction: monthlyDeduction,
      paid_amount: paidAmount,
      status,
      notes: clean(loan.notes),
      is_archived: false,
    });

    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'create',
        entity_type: 'employee_loan',
        entity_id: created?.id || '',
        record_id: created?.id || '',
        entity_label: employeeName,
        user_email: clean(user.email),
        user_name: clean(user.full_name) || clean(user.email),
        user_role: role,
        status: 'success',
        details: `إضافة سلفة للموظف ${employeeName} | ${branch} | ${amount}`,
      });
    } catch (_) {}

    return Response.json({ success: true, record: created });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر حفظ السلفة' }, { status: 500 });
  }
}
