import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function previousDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });
    if (!['admin', 'manager'].includes(String(user.role || ''))) {
      return Response.json({ error: 'هذه العملية متاحة للإدارة فقط' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const action = clean(body?.action) || 'update';
    if (!id) return Response.json({ error: 'معرف التسليم مطلوب' }, { status: 400 });

    const item = await base44.asServiceRole.entities.ShiftDelivery.get(id);
    if (!item) return Response.json({ error: 'سجل التسليم غير موجود' }, { status: 404 });

    const actor = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
    let updates: Record<string, unknown> = {};

    if (action === 'archive') {
      const reason = clean(body?.archive_reason) || 'أرشفة إدارية';
      const note = clean(body?.archive_note);
      updates = {
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: actor,
        archive_reason: reason,
        archive_note: note,
      };
    } else if (action === 'restore_archive') {
      updates = {
        is_archived: false,
        archived_at: '',
        archived_by: '',
        archive_reason: '',
        archive_note: '',
      };
    } else if (action === 'previous_calculation_day') {
      if (item.is_archived === true) return Response.json({ error: 'لا يمكن تعديل تسليم مؤرشف قبل استعادته' }, { status: 409 });
      if (String(user.role || '') !== 'admin') {
        return Response.json({ error: 'ترحيل تاريخ الاحتساب متاح للمدير العام فقط' }, { status: 403 });
      }
      const base = clean(item.calculation_date || item.shift_date);
      const prev = previousDate(base);
      if (!prev) return Response.json({ error: 'تاريخ التسليم غير صالح' }, { status: 400 });
      updates = { calculation_date: prev };
    } else if (action === 'update') {
      if (item.is_archived === true) return Response.json({ error: 'لا يمكن تعديل تسليم مؤرشف قبل استعادته' }, { status: 409 });
      const patch = body?.updates || {};
      const shiftType = clean(patch.shift_type || item.shift_type);
      if (!['صباحي', 'مسائي', 'ليلي'].includes(shiftType)) {
        return Response.json({ error: 'نوع الشيفت غير صالح' }, { status: 400 });
      }
      const totalSales = Number(patch.total_sales ?? item.total_sales ?? 0);
      if (!Number.isFinite(totalSales) || totalSales <= 0) {
        return Response.json({ error: 'إجمالي المبيعات غير صالح' }, { status: 400 });
      }
      const expenses = Array.isArray(patch.expenses)
        ? patch.expenses.map((e: any) => ({
            description: clean(e?.description),
            amount: Math.max(0, Number(e?.amount || 0)),
            category: clean(e?.category) || 'أخرى',
          })).filter((e: any) => Number.isFinite(e.amount) && (e.amount > 0 || e.description))
        : (item.expenses || []);
      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const calculationDate = clean(patch.calculation_date || item.calculation_date || item.shift_date);
      updates = {
        shift_type: shiftType,
        calculation_date: calculationDate,
        total_sales: totalSales,
        expenses,
        total_expenses: totalExpenses,
        net_amount: totalSales - totalExpenses,
        notes: clean(patch.notes ?? item.notes),
      };
    } else {
      return Response.json({ error: 'نوع التعديل غير مدعوم' }, { status: 400 });
    }

    // لا توجد أي حقول هوية أو فرع ضمن قائمة التعديل المسموحة.
    const updated = await base44.asServiceRole.entities.ShiftDelivery.update(id, updates);
    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'حدث خطأ أثناء تعديل التسليم' }, { status: 500 });
  }
}
