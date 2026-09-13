function toDateKey(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function addDays(dateKey, days) {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + Number(days || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getInvoiceDueDate(invoice, supplier) {
  if (invoice?.due_date) return toDateKey(invoice.due_date);
  const invoiceDate = toDateKey(invoice?.invoice_date || invoice?.created_date);
  if (!invoiceDate) return "";
  const terms = Number(supplier?.payment_terms_days ?? 30);
  return addDays(invoiceDate, Number.isFinite(terms) ? terms : 30);
}

export function daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export function getAgingBucket(dueDate, todayKey) {
  if (!dueDate) return "unknown";
  const daysToDue = daysBetween(todayKey, dueDate);
  if (daysToDue < 0) return "overdue";
  if (daysToDue <= 7) return "due7";
  if (daysToDue <= 30) return "due30";
  return "later";
}

export function summarizeSupplierAging(invoices, supplier, todayKey) {
  const summary = { overdue: 0, due7: 0, due30: 0, later: 0, unknown: 0, overdueCount: 0, due7Count: 0, due30Count: 0, laterCount: 0, unknownCount: 0 };
  const rows = (invoices || []).map((invoice) => {
    const remaining = Math.max(0, Number(invoice.remaining ?? ((invoice.total_value || 0) - (invoice.returned_value || 0) - (invoice.paid_value || 0))) || 0);
    const dueDate = getInvoiceDueDate(invoice, supplier);
    const bucket = getAgingBucket(dueDate, todayKey);
    if (remaining > 0.009) {
      summary[bucket] += remaining;
      summary[`${bucket}Count`] += 1;
    }
    return { ...invoice, dueDate, agingBucket: bucket, remaining };
  });
  return { summary, rows };
}
