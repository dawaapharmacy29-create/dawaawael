import { getInvoiceNetAmount } from "@/lib/purchaseCalculations";

export const ANALYTICS_BRANCHES = ["دواء شكري", "دواء الشامي"];
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) { return String(n).padStart(2, "0"); }
export function formatDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function cairoTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function parseKey(key) { const [y,m,d] = key.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(key, days) { const d = parseKey(key); d.setDate(d.getDate() + days); return formatDateKey(d); }
function addMonths(key, months) {
  const d = parseKey(key);
  const targetFirst = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  return formatDateKey(new Date(targetFirst.getFullYear(), targetFirst.getMonth(), Math.min(d.getDate(), lastDay)));
}
export function daysInclusive(from, to) { return Math.max(Math.round((parseKey(to) - parseKey(from)) / DAY_MS) + 1, 1); }

export function cycleRangeFor(dateKey = cairoTodayKey()) {
  const d = parseKey(dateKey);
  let start;
  if (d.getDate() >= 26) start = new Date(d.getFullYear(), d.getMonth(), 26);
  else start = new Date(d.getFullYear(), d.getMonth() - 1, 26);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
  return { from: formatDateKey(start), to: formatDateKey(end) };
}

export function calendarMonthRange(dateKey = cairoTodayKey()) {
  const d = parseKey(dateKey);
  return {
    from: formatDateKey(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: formatDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

export function previousComparableRange(range, index = 1) {
  const duration = daysInclusive(range.from, range.to);
  const prevFrom = addMonths(range.from, -index);
  return { from: prevFrom, to: addDays(prevFrom, duration - 1) };
}

export function clampRangeToToday(range, today = cairoTodayKey()) {
  return { ...range, to: range.to > today ? today : range.to };
}

export function inRange(dateKey, from, to) {
  if (!dateKey) return false;
  const d = dateKey.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

export function getSalesRows(handovers = [], { from, to, branch = "all", includeReview = false } = {}) {
  return handovers.filter((h) => h.is_archived !== true)
    .filter((h) => includeReview || h.status !== "مراجعة")
    .filter((h) => inRange(h.shift_date, from, to))
    .filter((h) => branch === "all" || h.branch === branch);
}

export function getPurchaseRows(invoices = [], { from, to, branch = "all" } = {}) {
  return invoices.filter((i) => inRange(i.invoice_date, from, to))
    .filter((i) => branch === "all" || i.branch === branch);
}

export function summarizePeriod({ handovers = [], invoices = [], suppliers = [], from, to, branch = "all" }) {
  const salesRows = getSalesRows(handovers, { from, to, branch });
  const reviewRows = getSalesRows(handovers, { from, to, branch, includeReview: true }).filter((h) => h.status === "مراجعة");
  const purchaseRows = getPurchaseRows(invoices, { from, to, branch });
  const sales = salesRows.reduce((s, h) => s + (Number(h.total_sales) || 0), 0);
  const purchases = purchaseRows.reduce((s, i) => s + getInvoiceNetAmount(i, suppliers), 0);
  const salesDays = new Set(salesRows.map((h) => (h.shift_date || "").slice(0, 10)).filter(Boolean)).size;
  const purchaseDays = new Set(purchaseRows.map((i) => (i.invoice_date || "").slice(0, 10)).filter(Boolean)).size;
  const reviewSales = reviewRows.reduce((s, h) => s + (Number(h.total_sales) || 0), 0);
  return {
    sales, purchases, ratio: sales > 0 ? (purchases / sales) * 100 : null,
    salesDays, purchaseDays,
    avgSales: salesDays ? sales / salesDays : 0,
    avgPurchases: purchaseDays ? purchases / purchaseDays : 0,
    purchaseInvoices: purchaseRows.length,
    shiftRecords: salesRows.length,
    reviewRecords: reviewRows.length,
    reviewSales,
  };
}

export function growth(current, previous) { return previous > 0 ? ((current - previous) / previous) * 100 : null; }
export function average(values = []) { const valid = values.filter((v) => Number.isFinite(v)); return valid.length ? valid.reduce((a,b) => a+b, 0) / valid.length : 0; }

export function buildDailyComparison({ handovers = [], invoices = [], suppliers = [], currentRange, previousRange, branch = "all" }) {
  const currentDays = daysInclusive(currentRange.from, currentRange.to);
  const currentSales = getSalesRows(handovers, { ...currentRange, branch });
  const previousSales = getSalesRows(handovers, { ...previousRange, branch });
  const currentPurchases = getPurchaseRows(invoices, { ...currentRange, branch });
  const previousPurchases = getPurchaseRows(invoices, { ...previousRange, branch });
  const map = (rows, field, amountFn) => {
    const out = {};
    rows.forEach((r) => { const d = (r[field] || "").slice(0,10); if (d) out[d] = (out[d] || 0) + amountFn(r); });
    return out;
  };
  const cs = map(currentSales, "shift_date", (h) => Number(h.total_sales) || 0);
  const ps = map(previousSales, "shift_date", (h) => Number(h.total_sales) || 0);
  const cp = map(currentPurchases, "invoice_date", (i) => getInvoiceNetAmount(i, suppliers));
  const pp = map(previousPurchases, "invoice_date", (i) => getInvoiceNetAmount(i, suppliers));
  return Array.from({ length: currentDays }, (_, idx) => {
    const curDate = addDays(currentRange.from, idx);
    const prevDate = addDays(previousRange.from, idx);
    return { day: idx + 1, curDate, prevDate, sales: cs[curDate] || 0, prevSales: ps[prevDate] || 0, purchases: cp[curDate] || 0, prevPurchases: pp[prevDate] || 0 };
  });
}

export function targetForRange(targets = [], branch, range) {
  // TargetGoal is monthly by YYYY-MM; cycle may span two months, so use the month containing the cycle end as the management month.
  const month = (range.to || range.from || "").slice(0, 7);
  return targets.find((t) => t.branch === branch && t.month === month)?.target_amount || 0;
}
