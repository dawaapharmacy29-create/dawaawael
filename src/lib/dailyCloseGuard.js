import { base44 } from "@/api/base44Client";
import { getInvoiceEffectiveDate } from "@/lib/invoiceIdentity";
import { cairoTodayKey } from "@/lib/smart-commerce-analytics";

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

export function currentShiftBusinessDate(shiftType) {
  const today = cairoTodayKey();
  if (shiftType !== "مسائي") return today;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  // المسائي قد يستمر فعليًا حتى 2–4 صباحًا؛ في هذه الساعات يُنسب لليوم التشغيلي السابق.
  if (hour >= 4) return today;
  const [y, m, d] = today.split("-").map(Number);
  const prev = new Date(y, m - 1, d);
  prev.setDate(prev.getDate() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
}
