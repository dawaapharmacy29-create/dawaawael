import { base44 } from "@/api/base44Client";
import { getInvoiceEffectiveDate } from "@/lib/invoiceIdentity";

export async function findClosedDailyClose(branch, businessDate) {
  if (!branch || !businessDate) return null;
  const rows = await base44.entities.DailyClose.filter({ branch, business_date: businessDate, status: "closed" }, "-updated_date", 1);
  return rows[0] || null;
}

export async function assertDailyCloseOpen(branch, businessDate, actionLabel = "تعديل البيانات") {
  const closed = await findClosedDailyClose(branch, businessDate);
  if (!closed) return true;
  const who = closed.closed_by ? ` بواسطة ${closed.closed_by}` : "";
  throw new Error(`اليوم ${businessDate} في ${branch} مقفول${who}. يجب إعادة فتح الإقفال اليومي قبل ${actionLabel}.`);
}

export async function assertInvoiceDayOpen(invoice, actionLabel = "تعديل الفاتورة") {
  if (!invoice) return true;
  return assertDailyCloseOpen(invoice.branch, getInvoiceEffectiveDate(invoice), actionLabel);
}
