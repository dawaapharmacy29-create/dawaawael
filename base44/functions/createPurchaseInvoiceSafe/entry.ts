import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VALID_BRANCHES = new Set(['دواء شكري', 'دواء الشامي']);
const VALID_PAYMENT_TYPES = new Set(['كاش', 'آجل', 'انستا', 'فودافون', 'مختلط']);
const VALID_STATUSES = new Set(['انتظار المراجعة', 'يتم الحفظ', 'تعلق تحت التصريف']);
const VALID_CATEGORIES = new Set(['medicines', 'supplies_accessories', 'unclassified']);
const VALID_TRANSACTION_TYPES = new Set(['external_purchase', 'internal_transfer']);
const VALID_NET_MODES = new Set(['inherit', 'include', 'exclude']);

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeInvoiceNumber(value: unknown) {
  return clean(value)
    .replace(/\s+/g, '')
    .replace(/[.،,*-]+$/g, '');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const role = String(user.role || '');
    const canSaveInvoice = user.can_save_invoice === true || user?.data?.can_save_invoice === true;
    if (!['admin', 'manager'].includes(role) && !canSaveInvoice) {
      return Response.json({ error: 'ليس لديك صلاحية إضافة فواتير شراء' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const invoice = body?.invoice || {};
    const branch = clean(invoice.branch);
    const systemInvoiceNumber = clean(invoice.system_invoice_number);
    const enteredBy = clean(invoice.entered_by);
    const paymentType = clean(invoice.payment_type);
    const status = clean(invoice.status) || 'انتظار المراجعة';
    const purchaseCategory = clean(invoice.purchase_category) || 'unclassified';
    const transactionType = clean(invoice.transaction_type) || 'external_purchase';
    const netPurchaseMode = clean(invoice.net_purchase_mode) || 'inherit';

    if (!VALID_BRANCHES.has(branch)) return Response.json({ error: 'الفرع غير صالح' }, { status: 400 });
    if (!systemInvoiceNumber) return Response.json({ error: 'رقم الفاتورة على البرنامج مطلوب' }, { status: 400 });
    if (!enteredBy) return Response.json({ error: 'يجب تحديد مدخل الفاتورة' }, { status: 400 });
    if (!VALID_PAYMENT_TYPES.has(paymentType)) return Response.json({ error: 'طريقة الدفع غير صالحة' }, { status: 400 });
    if (!VALID_STATUSES.has(status)) return Response.json({ error: 'حالة الفاتورة غير صالحة' }, { status: 400 });
    if (!VALID_CATEGORIES.has(purchaseCategory)) return Response.json({ error: 'تصنيف الفاتورة غير صالح' }, { status: 400 });
    if (!VALID_TRANSACTION_TYPES.has(transactionType)) return Response.json({ error: 'نوع العملية غير صالح' }, { status: 400 });
    if (!VALID_NET_MODES.has(netPurchaseMode)) return Response.json({ error: 'طريقة احتساب صافي المشتريات غير صالحة' }, { status: 400 });

    const employeeMappings: any[] = await base44.asServiceRole.entities.EmployeeNameMap.filter({
      canonical_name: enteredBy,
      is_active: true,
    });
    const employee = employeeMappings.find((m: any) => m.branch === 'كل الفروع' || clean(m.branch) === branch);
    if (!employee) {
      return Response.json({ error: 'مدخل الفاتورة غير موجود ضمن العاملين المعتمدين لهذا الفرع' }, { status: 400 });
    }

    const supplierId = clean(invoice.supplier_id);
    const supplierName = clean(invoice.supplier_name);
    let supplier: any = null;
    if (supplierId) {
      supplier = await base44.asServiceRole.entities.Supplier.get(supplierId).catch(() => null);
    } else if (supplierName) {
      const matches = await base44.asServiceRole.entities.Supplier.filter({ name: supplierName });
      supplier = matches.find((s: any) => s.is_active !== false) || matches[0] || null;
    }
    if (supplier?.is_active === false) {
      return Response.json({ error: 'هذا المورد مؤرشف ولا يمكن استخدامه في فاتورة جديدة. استعد المورد أولًا من صفحة الموردين.' }, { status: 400 });
    }

    const now = new Date();
    const invoiceDate = clean(invoice.invoice_date) || now.toISOString().slice(0, 10);
    const sameDayInvoices: any[] = await base44.asServiceRole.entities.PurchaseInvoice.filter({
      branch,
      invoice_date: invoiceDate,
    });
    const exactDuplicate = sameDayInvoices.find((item: any) => clean(item.system_invoice_number) === systemInvoiceNumber);
    if (exactDuplicate) {
      return Response.json({
        error: `رقم الفاتورة ${systemInvoiceNumber} موجود بالفعل في ${branch} بتاريخ ${invoiceDate}`,
        code: 'duplicate_invoice',
        existing_id: exactDuplicate.id,
      }, { status: 409 });
    }
    const normalizedNumber = normalizeInvoiceNumber(systemInvoiceNumber);
    const nearDuplicate = normalizedNumber
      ? sameDayInvoices.find((item: any) => normalizeInvoiceNumber(item.system_invoice_number) === normalizedNumber)
      : null;
    if (nearDuplicate) {
      return Response.json({
        error: `يوجد رقم فاتورة مشابه جدًا (${nearDuplicate.system_invoice_number}) في ${branch} بتاريخ ${invoiceDate}. راجع الرقم قبل الحفظ لمنع التكرار.`,
        code: 'near_duplicate_invoice',
        existing_id: nearDuplicate.id,
      }, { status: 409 });
    }

    const totalValue = numberOrZero(invoice.total_value);
    const returnedValue = numberOrZero(invoice.returned_value);
    const cashAmount = numberOrZero(invoice.cash_amount);
    if (totalValue <= 0) return Response.json({ error: 'إجمالي الفاتورة يجب أن يكون أكبر من صفر' }, { status: 400 });
    if (returnedValue > totalValue) return Response.json({ error: 'قيمة المرتجع لا يمكن أن تتجاوز إجمالي الفاتورة' }, { status: 400 });
    if (paymentType === 'مختلط' && cashAmount > totalValue - returnedValue) {
      return Response.json({ error: 'المبلغ المدفوع كاش لا يمكن أن يتجاوز صافي الفاتورة' }, { status: 400 });
    }

    const sourceBranch = clean(invoice.source_branch);
    const destinationBranch = clean(invoice.destination_branch);
    if (transactionType === 'internal_transfer') {
      if (!VALID_BRANCHES.has(sourceBranch) || !VALID_BRANCHES.has(destinationBranch)) {
        return Response.json({ error: 'يجب تحديد الفرع المصدر والفرع المستلم للتحويل الداخلي' }, { status: 400 });
      }
      if (sourceBranch === destinationBranch) {
        return Response.json({ error: 'لا يمكن أن يكون الفرع المصدر هو نفسه الفرع المستلم' }, { status: 400 });
      }
    }

    const exclusionReason = clean(invoice.exclusion_reason);
    const exclusionNote = clean(invoice.exclusion_note);
    if (netPurchaseMode === 'exclude' && !exclusionReason) {
      return Response.json({ error: 'يجب تحديد سبب الاستثناء' }, { status: 400 });
    }
    if (netPurchaseMode === 'exclude' && exclusionReason === 'other' && !exclusionNote) {
      return Response.json({ error: 'يجب كتابة ملاحظة لسبب الاستثناء الآخر' }, { status: 400 });
    }

    const isCash = ['كاش', 'انستا', 'فودافون'].includes(paymentType);
    const paidValue = isCash ? totalValue - returnedValue : (paymentType === 'مختلط' ? cashAmount : 0);

    const created = await base44.asServiceRole.entities.PurchaseInvoice.create({
      system_invoice_number: systemInvoiceNumber,
      supplier_invoice_number: clean(invoice.supplier_invoice_number),
      transfer_authorization_number: clean(invoice.transfer_authorization_number),
      supplier_name: supplierName,
      supplier_id: supplierId,
      branch,
      entered_by: clean(employee.canonical_name),
      entered_by_staff_id: clean(employee.admin_staff_id),
      invoice_date: invoiceDate,
      total_value: totalValue,
      returned_value: returnedValue,
      paid_value: paidValue,
      payment_type: paymentType,
      status,
      notes: clean(invoice.notes),
      purchase_category: purchaseCategory,
      purchase_category_source: clean(invoice.purchase_category_source) || 'manual',
      transaction_type: transactionType,
      transaction_type_source: clean(invoice.transaction_type_source) || 'manual',
      net_purchase_mode: netPurchaseMode,
      exclusion_reason: netPurchaseMode === 'exclude' ? exclusionReason : '',
      exclusion_note: netPurchaseMode === 'exclude' ? exclusionNote : '',
      excluded_by: netPurchaseMode === 'exclude' ? (clean(user.full_name) || clean(user.email)) : '',
      excluded_at: netPurchaseMode === 'exclude' ? now.toISOString() : '',
      source_branch: transactionType === 'internal_transfer' ? sourceBranch : '',
      destination_branch: transactionType === 'internal_transfer' ? destinationBranch : '',
      cash_amount: paymentType === 'مختلط' ? cashAmount : 0,
      added_at: new Date().toLocaleString('ar-EG', {
        timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }),
    });

    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'create',
        entity_type: 'invoice',
        entity_id: created?.id || '',
        record_id: created?.id || '',
        entity_label: systemInvoiceNumber,
        user_email: clean(user.email),
        user_name: clean(user.full_name),
        user_role: role,
        status: 'success',
        details: `إنشاء فاتورة ${systemInvoiceNumber} | الفرع: ${branch} | مدخل الفاتورة: ${clean(employee.canonical_name)}`,
      });
    } catch (_) {}

    return Response.json({ success: true, record: created });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء الفاتورة' }, { status: 500 });
  }
}
