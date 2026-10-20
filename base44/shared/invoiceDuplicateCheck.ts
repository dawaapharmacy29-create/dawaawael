// فحص تكرار أرقام الفواتير داخل نفس الفرع (رقم البرنامج أو رقم فاتورة المورد).
// بحث مستهدف على الرقم نفسه بدل تحميل كل فواتير الفرع — تحميل آلاف السجلات في كل تعديل يسبب 503.
export function normalizeInvoiceNumber(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').replace(/[.،,*-]+$/g, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// نمط مثبّت الطرفين يسمح فقط بمسافات/علامات ختامية قديمة حول الرقم، فلا يلتقط أرقامًا أطول (20191 لا يطابق 201912).
function anchoredPattern(normalized: string): string {
  return `^\\s*${escapeRegex(normalized)}\\s*[.،,*-]*\\s*$`;
}

export async function findInvoiceDuplicate(
  base44: any,
  branch: string,
  options: { systemInvoiceNumber?: unknown; supplierInvoiceNumber?: unknown; excludeId?: string },
): Promise<any | null> {
  const normalizedNumber = normalizeInvoiceNumber(options.systemInvoiceNumber);
  const canonicalSupplierNumber = normalizeInvoiceNumber(options.supplierInvoiceNumber);
  if (!branch || (!normalizedNumber && !canonicalSupplierNumber)) return null;

  const checks: Array<Promise<any[]>> = [];
  if (normalizedNumber) {
    checks.push(base44.asServiceRole.entities.PurchaseInvoice.filter(
      { branch, system_invoice_number: { $regex: anchoredPattern(normalizedNumber) } },
      '-created_date', 5,
    ));
  }
  if (canonicalSupplierNumber) {
    checks.push(base44.asServiceRole.entities.PurchaseInvoice.filter(
      { branch, supplier_invoice_number: { $regex: anchoredPattern(canonicalSupplierNumber) } },
      '-created_date', 5,
    ));
  }

  const results = await Promise.all(checks);
  for (const rows of results) {
    const list = Array.isArray(rows) ? rows : rows?.items || [];
    const hit = list.find((item: any) => item?.id && item.id !== options.excludeId);
    if (hit) return hit;
  }
  return null;
}

export function duplicateInvoiceError(duplicate: any): string {
  return `الرقم "${duplicate.system_invoice_number}" (فاتورة المورد: ${String(duplicate.supplier_invoice_number ?? '').trim() || duplicate.system_invoice_number}) مسجل بالفعل في فواتير هذا الفرع. لا يمكن تكرار نفس الرقم في نفس الفرع.`;
}