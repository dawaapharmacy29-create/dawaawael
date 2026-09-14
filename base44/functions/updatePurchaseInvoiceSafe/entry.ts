import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VALID_BRANCHES = new Set(['دواء شكري', 'دواء الشامي']);
const VALID_PAYMENT_TYPES = new Set(['كاش', 'آجل', 'انستا', 'فودافون', 'مختلط']);
const VALID_STATUSES = new Set(['انتظار المراجعة', 'يتم الحفظ', 'تعلق تحت التصريف', 'معتمدة', 'مرفوضة']);
const VALID_CATEGORIES = new Set(['medicines', 'supplies_accessories', 'unclassified']);
const VALID_TRANSACTION_TYPES = new Set(['external_purchase', 'internal_transfer']);
const VALID_NET_MODES = new Set(['inherit', 'include', 'exclude']);
const ALLOWED_FIELDS = new Set([
  'system_invoice_number', 'supplier_invoice_number', 'transfer_authorization_number',
  'supplier_name', 'supplier_id', 'branch', 'entered_by', 'entered_by_staff_id',
  'invoice_date', 'due_date', 'total_value', 'returned_value', 'paid_value', 'payment_type',
  'status', 'notes', 'purchase_category', 'purchase_category_source', 'transaction_type',
  'transaction_type_source', 'net_purchase_mode', 'exclusion_reason', 'exclusion_note',
  'excluded_by', 'excluded_at', 'source_branch', 'destination_branch', 'cash_amount',
]);

function clean(value: unknown) { return String(value ?? '').trim(); }
function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function normalizeInvoiceNumber(value: unknown) {
  return clean(value).replace(/\s+/g, '').replace(/[.،,*-]+$/g, '');
}
function effectiveDate(inv: any) {
  return clean(inv?.invoice_date) || clean(inv?.created_date).slice(0, 10);
}
async function assertDayOpen(base44: any, branch: string, date: string) {
  if (!branch || !date) return;
  const rows = await base44.asServiceRole.entities.DailyClose.filter({ branch, business_date: date }, '-updated_date', 5);
  const closed = rows.find((row: any) => row?.status === 'closed');
  if (closed) throw new Error(`اليوم ${date} لفرع ${branch} مقفول نهائيًا. يجب إعادة فتح الإقفال قبل تعديل الفاتورة.`);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    if (!id) return Response.json({ success: false, error: 'معرف الفاتورة مطلوب' }, { status: 400 });

    const current: any = await base44.asServiceRole.entities.PurchaseInvoice.get(id).catch(() => null);
    if (!current) return Response.json({ success: false, error: 'الفاتورة غير موجودة' }, { status: 404 });

    const requested = body?.updates || {};
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(requested)) {
      if (ALLOWED_FIELDS.has(key)) updates[key] = value;
    }
    if (!Object.keys(updates).length) return Response.json({ success: true, record: current, unchanged: true });

    const next = { ...current, ...updates };
    const branch = clean(next.branch);
    const invoiceDate = effectiveDate(next);
    const oldDate = effectiveDate(current);
    const oldBranch = clean(current.branch);

    if (!VALID_BRANCHES.has(branch)) return Response.json({ success: false, error: 'الفرع غير صالح' }, { status: 400 });
    // تعديل/مراجعة الفاتورة جزء من التشغيل اليومي المتاح للحسابات المسجلة.
    // صلاحيات الفرع تخص عرض البيانات المالية والتقارير، لا تنفيذ المراجعة التشغيلية.

    const updateKeys = Object.keys(updates);
    const projectionOnly = updateKeys.length === 1 && updateKeys[0] === 'paid_value';
    // paid_value هو Projection لدفتر SupplierPayment ويمكن أن يتغير بعد إقفال يوم الفاتورة.
    // أي تعديل آخر في هوية/قيمة/حالة الفاتورة يظل محميًا بالإقفال اليومي.
    if (!projectionOnly) {
      await assertDayOpen(base44, oldBranch, oldDate);
      if (branch !== oldBranch || invoiceDate !== oldDate) await assertDayOpen(base44, branch, invoiceDate);
    }

    const systemInvoiceNumber = clean(next.system_invoice_number);
    const enteredBy = clean(next.entered_by);
    const paymentType = clean(next.payment_type);
    const status = clean(next.status) || 'انتظار المراجعة';
    const purchaseCategory = clean(next.purchase_category) || 'unclassified';
    const transactionType = clean(next.transaction_type) || 'external_purchase';
    const netPurchaseMode = clean(next.net_purchase_mode) || 'inherit';
    if (!systemInvoiceNumber) return Response.json({ success: false, error: 'رقم الفاتورة على البرنامج مطلوب' }, { status: 400 });
    if (!enteredBy) return Response.json({ success: false, error: 'مدخل الفاتورة مطلوب' }, { status: 400 });
    if (!VALID_PAYMENT_TYPES.has(paymentType)) return Response.json({ success: false, error: 'طريقة الدفع غير صالحة' }, { status: 400 });
    if (!VALID_STATUSES.has(status)) return Response.json({ success: false, error: 'حالة الفاتورة غير صالحة' }, { status: 400 });
    if (!VALID_CATEGORIES.has(purchaseCategory)) return Response.json({ success: false, error: 'تصنيف الفاتورة غير صالح' }, { status: 400 });
    if (!VALID_TRANSACTION_TYPES.has(transactionType)) return Response.json({ success: false, error: 'نوع العملية غير صالح' }, { status: 400 });
    if (!VALID_NET_MODES.has(netPurchaseMode)) return Response.json({ success: false, error: 'طريقة احتساب صافي المشتريات غير صالحة' }, { status: 400 });

    const totalValue = numberOrZero(next.total_value);
    const returnedValue = numberOrZero(next.returned_value);
    const paidValue = numberOrZero(next.paid_value);
    const cashAmount = numberOrZero(next.cash_amount);
    if (totalValue <= 0) return Response.json({ success: false, error: 'إجمالي الفاتورة يجب أن يكون أكبر من صفر' }, { status: 400 });
    if (returnedValue > totalValue) return Response.json({ success: false, error: 'قيمة المرتجع لا يمكن أن تتجاوز إجمالي الفاتورة' }, { status: 400 });
    if (paidValue > totalValue - returnedValue + 0.01) return Response.json({ success: false, error: 'المدفوع لا يمكن أن يتجاوز صافي الفاتورة' }, { status: 400 });
    if (paymentType === 'مختلط' && cashAmount > totalValue - returnedValue + 0.01) return Response.json({ success: false, error: 'المبلغ الكاش لا يمكن أن يتجاوز صافي الفاتورة' }, { status: 400 });

    if (transactionType === 'internal_transfer') {
      const sourceBranch = clean(next.source_branch);
      const destinationBranch = clean(next.destination_branch);
      if (!VALID_BRANCHES.has(sourceBranch) || !VALID_BRANCHES.has(destinationBranch) || sourceBranch === destinationBranch) {
        return Response.json({ success: false, error: 'بيانات التحويل الداخلي غير صالحة' }, { status: 400 });
      }
    }
    if (netPurchaseMode === 'exclude' && !clean(next.exclusion_reason)) {
      return Response.json({ success: false, error: 'يجب تحديد سبب الاستثناء' }, { status: 400 });
    }

    const normalizedNumber = normalizeInvoiceNumber(systemInvoiceNumber);
    const sameDay: any[] = await base44.asServiceRole.entities.PurchaseInvoice.filter({ branch, invoice_date: invoiceDate }, '-created_date', 1000);
    const duplicate = sameDay.find((item: any) => item.id !== id && normalizeInvoiceNumber(item.system_invoice_number) === normalizedNumber);
    if (duplicate) {
      return Response.json({ success: false, error: `الفاتورة ${systemInvoiceNumber} موجودة بالفعل في ${branch} بتاريخ ${invoiceDate}`, code: 'duplicate_invoice', existing_id: duplicate.id }, { status: 409 });
    }

    if (updates.entered_by !== undefined || updates.branch !== undefined) {
      const mappings: any[] = await base44.asServiceRole.entities.EmployeeNameMap.filter({ canonical_name: enteredBy, is_active: true });
      const employee = mappings.find((m: any) => m.branch === 'كل الفروع' || clean(m.branch) === branch);
      if (!employee) return Response.json({ success: false, error: 'مدخل الفاتورة غير موجود ضمن العاملين المعتمدين لهذا الفرع' }, { status: 400 });
      updates.entered_by = clean(employee.canonical_name);
      updates.entered_by_staff_id = clean(employee.admin_staff_id);
    }

    for (const numeric of ['total_value', 'returned_value', 'paid_value', 'cash_amount']) {
      if (numeric in updates) updates[numeric] = numberOrZero(updates[numeric]);
    }

    const updated = await base44.asServiceRole.entities.PurchaseInvoice.update(id, updates);
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'update', entity_type: 'invoice', entity_id: id, record_id: id,
        entity_label: systemInvoiceNumber, user_email: clean(user.email), user_name: clean(user.full_name),
        user_role: clean(user.role), status: 'success',
        details: `تعديل آمن للفاتورة ${systemInvoiceNumber}: ${Object.keys(updates).join(', ')}`,
      });
    } catch (_) {}
    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'تعذر تعديل الفاتورة' }, { status: 500 });
  }
}
