import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VALID_SHIFTS = new Set(['صباحي','مسائي','ليلي']);
const VALID_WORKFLOW = new Set(['submitted','under_review','approved','closed']);
const VALID_EXPENSE_SOURCES = new Set(['cash','insta','vodafone','bank','other']);

function clean(value: unknown) { return String(value ?? '').trim(); }
function money(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? Math.max(0, n) : 0; }

function previousDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

async function assertDayOpen(base44: any, branch: string, date: string) {
  if (!branch || !date) return;
  const rows = await base44.asServiceRole.entities.DailyClose.filter({ branch, business_date: date }, '-updated_date', 5);
  if (rows.some((r: any) => r?.status === 'closed')) {
    throw new Error(`اليوم ${date} لفرع ${branch} مقفول نهائيًا. يجب إعادة فتح الإقفال قبل تعديل الشيفت.`);
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ success:false, error:'يجب تسجيل الدخول أولًا' }, { status:401 });
    if (!['admin','manager'].includes(clean(user.role))) {
      return Response.json({ success:false, error:'هذه العملية متاحة للإدارة فقط' }, { status:403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const action = clean(body?.action) || 'update';
    if (!id) return Response.json({ success:false, error:'معرف التسليم مطلوب' }, { status:400 });

    const item: any = await base44.asServiceRole.entities.ShiftDelivery.get(id).catch(() => null);
    if (!item) return Response.json({ success:false, error:'سجل التسليم غير موجود' }, { status:404 });

    const actor = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
    const branch = clean(item.branch);
    const shiftDate = clean(item.shift_date);
    let updates: Record<string, any> = {};

    if (action === 'archive') {
      const reason = clean(body?.archive_reason) || 'أرشفة إدارية';
      const note = clean(body?.archive_note);
      updates = { is_archived:true, archived_at:new Date().toISOString(), archived_by:actor, archive_reason:reason, archive_note:note };
    } else if (action === 'restore_archive') {
      updates = { is_archived:false, archived_at:'', archived_by:'', archive_reason:'', archive_note:'' };
    } else if (action === 'previous_calculation_day') {
      if (item.is_archived === true) return Response.json({ success:false, error:'لا يمكن تعديل تسليم مؤرشف قبل استعادته' }, { status:409 });
      if (clean(user.role) !== 'admin') return Response.json({ success:false, error:'ترحيل تاريخ الاحتساب متاح للمدير العام فقط' }, { status:403 });
      const base = clean(item.calculation_date || item.shift_date);
      const prev = previousDate(base);
      if (!prev) return Response.json({ success:false, error:'تاريخ التسليم غير صالح' }, { status:400 });
      await assertDayOpen(base44, branch, shiftDate);
      await assertDayOpen(base44, branch, prev);
      updates = { calculation_date:prev };
    } else if (action === 'update') {
      if (item.is_archived === true) return Response.json({ success:false, error:'لا يمكن تعديل تسليم مؤرشف قبل استعادته' }, { status:409 });
      const patch = body?.updates || {};
      await assertDayOpen(base44, branch, shiftDate);

      const nextShiftType = clean(patch.shift_type ?? item.shift_type);
      if (!VALID_SHIFTS.has(nextShiftType)) return Response.json({ success:false, error:'نوع الشيفت غير صالح' }, { status:400 });

      const calculationDate = clean(patch.calculation_date ?? item.calculation_date ?? shiftDate);
      if (calculationDate && calculationDate !== shiftDate) await assertDayOpen(base44, branch, calculationDate);

      if (nextShiftType !== clean(item.shift_type)) {
        const same = await base44.asServiceRole.entities.ShiftDelivery.filter({ branch, shift_type:nextShiftType, shift_date:shiftDate });
        const duplicate = same.find((r: any) => r.id !== id && r.is_archived !== true);
        if (duplicate) return Response.json({ success:false, error:`يوجد بالفعل شيفت ${nextShiftType} لفرع ${branch} بتاريخ ${shiftDate}`, code:'duplicate_shift_delivery' }, { status:409 });
      }

      const hasPaymentPatch = ['cash_sales','visa_sales','insta_sales','vodafone_sales','other_sales','payment_breakdown_total'].some((k) => k in patch);
      const cashSales = money(patch.cash_sales ?? item.cash_sales);
      const visaSales = money(patch.visa_sales ?? item.visa_sales);
      const instaSales = money(patch.insta_sales ?? item.insta_sales);
      const vodafoneSales = money(patch.vodafone_sales ?? item.vodafone_sales);
      const otherSales = money(patch.other_sales ?? item.other_sales);
      const breakdown = cashSales + visaSales + instaSales + vodafoneSales + otherSales;
      const totalSales = hasPaymentPatch ? breakdown : money(patch.total_sales ?? item.total_sales);
      if (totalSales <= 0) return Response.json({ success:false, error:'إجمالي المبيعات غير صالح' }, { status:400 });
      if (hasPaymentPatch && Math.abs(breakdown - totalSales) > 0.01) return Response.json({ success:false, error:'تفصيل وسائل التحصيل لا يساوي إجمالي المبيعات' }, { status:400 });

      const expenses = Array.isArray(patch.expenses)
        ? patch.expenses.map((e: any) => ({
            description:clean(e?.description),
            amount:money(e?.amount),
            category:clean(e?.category) || 'أخرى',
            payment_source:VALID_EXPENSE_SOURCES.has(clean(e?.payment_source)) ? clean(e?.payment_source) : 'cash',
          })).filter((e: any) => e.amount > 0 || e.description || e.category)
        : (Array.isArray(item.expenses) ? item.expenses : []);
      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + money(e.amount), 0);
      const cashExpenses = expenses.filter((e: any) => clean(e.payment_source || 'cash') === 'cash').reduce((sum: number, e: any) => sum + money(e.amount), 0);
      const expectedCash = Math.max(0, cashSales - cashExpenses);
      const cashHandover = money(patch.cash_handover ?? item.cash_handover);
      const cashVariance = cashHandover - expectedCash;

      let workflowStatus = clean(patch.workflow_status ?? item.workflow_status) || 'submitted';
      if (!VALID_WORKFLOW.has(workflowStatus)) return Response.json({ success:false, error:'مرحلة الشيفت غير صالحة' }, { status:400 });
      // لا نسمح باعتبار شيفت بفارق كاش كبير "معتمد" أو "مقفول" بدون سبب موثق.
      const notes = clean(patch.notes ?? item.notes);
      if (['approved','closed'].includes(workflowStatus) && Math.abs(cashVariance) > 1 && !notes) {
        return Response.json({ success:false, error:'لا يمكن اعتماد أو إقفال شيفت به فرق كاش بدون سبب موثق' }, { status:400 });
      }
      if (!('workflow_status' in patch) && Math.abs(cashVariance) > 1) workflowStatus = 'under_review';

      updates = {
        shift_type:nextShiftType,
        calculation_date:calculationDate,
        total_sales:totalSales,
        cash_sales:cashSales,
        visa_sales:visaSales,
        insta_sales:instaSales,
        vodafone_sales:vodafoneSales,
        other_sales:otherSales,
        payment_breakdown_total:breakdown,
        cash_handover:cashHandover,
        cash_variance:cashVariance,
        expenses,
        total_expenses:totalExpenses,
        net_amount:totalSales - totalExpenses,
        workflow_status:workflowStatus,
        notes,
      };
    } else {
      return Response.json({ success:false, error:'نوع التعديل غير مدعوم' }, { status:400 });
    }

    // branch / shift_date / recorded_at / submitted_by* / identity_* غير موجودة نهائيًا في قائمة الحقول القابلة للتعديل.
    const updated = await base44.asServiceRole.entities.ShiftDelivery.update(id, updates);
    return Response.json({ success:true, record:updated });
  } catch (error) {
    return Response.json({ success:false, error:error instanceof Error ? error.message : 'حدث خطأ أثناء تعديل التسليم' }, { status:500 });
  }
}
