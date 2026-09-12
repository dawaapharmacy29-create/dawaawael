import { getInvoiceNetAmount } from "@/lib/purchaseCalculations";

export const BRANCHES = ["دواء شكري", "دواء الشامي"]; 

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export function computeDateRange(periodType, customFrom, customTo) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  switch (periodType) {
    case "today":
      return { dateFrom: fmt(today), dateTo: fmt(today) };
    case "week": {
      const day = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - day);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      return { dateFrom: fmt(sunday), dateTo: fmt(saturday) };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { dateFrom: fmt(first), dateTo: fmt(last) };
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: fmt(first), dateTo: fmt(last) };
    }
    case "custom":
      return { dateFrom: customFrom || "", dateTo: customTo || "" };
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

export function inDateRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function fmtCurrency(n) {
  return (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 }) + " ج";
}

export function fmtNumber(n) {
  return (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

export function buildChartData(handovers, invoices, dateFrom, dateTo, suppliers = []) {
  if (!dateFrom || !dateTo) return [];
  const diffDays = (new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24);
  const isDaily = diffDays <= 45;

  const map = {};
  const ensure = (key) => {
    if (!map[key]) {
      const label = isDaily
        ? `${key.slice(8,10)}/${key.slice(5,7)}`
        : `${MONTHS_AR[parseInt(key.slice(5,7))-1]} ${key.slice(0,4)}`;
      map[key] = { label, totalSales: 0, purchases: 0 };
    }
    return map[key];
  };

  handovers.forEach(h => {
    if (!h.shift_date) return;
    const key = isDaily ? h.shift_date.slice(0,10) : h.shift_date.slice(0,7);
    ensure(key).totalSales += h.total_sales || 0;
  });
  invoices.forEach(i => {
    if (!i.invoice_date) return;
    const key = isDaily ? i.invoice_date.slice(0,10) : i.invoice_date.slice(0,7);
    ensure(key).purchases += getInvoiceNetAmount(i, suppliers);
  });

  return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
}

export function buildBranchComparison(handovers, invoices, suppliers = []) {
  return BRANCHES.map(branch => {
    const bHandovers = handovers.filter(h => h.branch === branch);
    const bInvoices = invoices.filter(i => i.branch === branch);
    const totalSales = bHandovers.reduce((s,h) => s + (h.total_sales || 0), 0);
    const netSales = bHandovers.reduce((s,h) => s + (h.net_amount || 0), 0);
    const totalPurchases = bInvoices.reduce((s,i) => s + getInvoiceNetAmount(i, suppliers), 0);
    const diff = netSales - totalPurchases;
    const ratio = netSales > 0 ? (totalPurchases / netSales) * 100 : 0;
    return { branch, totalSales, netSales, totalPurchases, diff, ratio, invoiceCount: bInvoices.length, handoverCount: bHandovers.length };
  });
}

export function computeSupplierBalance(invoices, payments, debts, name) {
  const creditInvoices = invoices.filter(inv => inv.payment_type === "آجل" && inv.supplier_name === name);
  const totalCreditPurchases = creditInvoices.reduce((s, inv) => s + (inv.total_value || 0) - (inv.returned_value || 0), 0);
  const initialDebt = debts.filter(d => d.supplier_name === name).reduce((s, d) => s + (d.initial_debt || 0), 0);
  const totalPaid = payments.filter(p => p.supplier_name === name).reduce((s, p) => s + (p.amount || 0), 0);
  return { totalCreditPurchases, initialDebt, totalPaid, totalNet: totalCreditPurchases + initialDebt - totalPaid };
}

export function computeTotalRemaining(invoices, payments, debts, supplierFilter) {
  const names = new Set();
  invoices.forEach(i => { if (i.payment_type === "آجل" && i.supplier_name) names.add(i.supplier_name); });
  debts.forEach(d => { if (d.supplier_name) names.add(d.supplier_name); });
  payments.forEach(p => { if (p.supplier_name) names.add(p.supplier_name); });

  const filtered = supplierFilter && supplierFilter !== "all"
    ? Array.from(names).filter(n => n === supplierFilter)
    : Array.from(names);

  return filtered.reduce((sum, name) => sum + computeSupplierBalance(invoices, payments, debts, name).totalNet, 0);
}

// بنود ليست مصروفات حقيقية بل طرق دفع تُضاف لصافي المبيعات (فودافون كاش/انستا باي/فيزا)
const PAYMENT_METHOD_KEYWORDS = ["فودافون كاش", "انستا", "فيزا"];
const expenseLabel = (e) => `${e.category || ""} ${e.description || ""}`.trim();
const paymentMethodTotal = (expenses) =>
  (expenses || []).reduce((sum, e) => {
    const label = expenseLabel(e);
    return PAYMENT_METHOD_KEYWORDS.some(k => label.includes(k)) ? sum + (e.amount || 0) : sum;
  }, 0);
const realExpensesTotal = (expenses) =>
  (expenses || []).reduce((sum, e) => {
    const label = expenseLabel(e);
    return PAYMENT_METHOD_KEYWORDS.some(k => label.includes(k)) ? sum : sum + (e.amount || 0);
  }, 0);

export function buildFinancialSummary(handovers, invoices, dateFrom, dateTo, branch, suppliers = []) {
  const days = dateFrom && dateTo
    ? Math.max(Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1, 1)
    : 1;
  const h = handovers.filter(x => inDateRange(x.shift_date, dateFrom, dateTo) && (branch === "all" || x.branch === branch));
  const inv = invoices.filter(x => inDateRange(x.invoice_date, dateFrom, dateTo) && (branch === "all" || x.branch === branch));

  const totalSales = h.reduce((s, x) => s + (x.total_sales || 0), 0);
  const netSales = h.reduce((s, x) => s + (x.net_amount || 0) + paymentMethodTotal(x.expenses), 0);
  const totalPurchases = inv.reduce((s, x) => s + getInvoiceNetAmount(x, suppliers), 0);
  const totalExpenses = h.reduce((s, x) => s + realExpensesTotal(x.expenses), 0);

  return {
    branch,
    totalSales,
    netSales,
    totalPurchases,
    totalExpenses,
    avgSales: totalSales / days,
    avgPurchases: totalPurchases / days,
    avgExpenses: totalExpenses / days,
    days,
  };
}

export function buildSupplierAnalysis(invoices, payments, debts) {
  const names = new Set();
  invoices.forEach(i => i.supplier_name && names.add(i.supplier_name));
  payments.forEach(p => p.supplier_name && names.add(p.supplier_name));
  debts.forEach(d => d.supplier_name && names.add(d.supplier_name));

  return Array.from(names).map(name => {
    const totalPurchases = invoices.filter(i => i.supplier_name === name).reduce((s,i) => s + (i.total_value || 0), 0);
    const bal = computeSupplierBalance(invoices, payments, debts, name);
    return { name, totalPurchases, totalPayments: bal.totalPaid, currentDebt: bal.totalNet };
  }).sort((a,b) => b.totalPurchases - a.totalPurchases);
}
