import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  BRANCHES, computeDateRange, buildChartData, buildBranchComparison,
  buildSupplierAnalysis, computeTotalRemaining,
} from "@/lib/financial-report-utils";
import { getInvoiceNetAmount, isInvoiceFinanciallyApproved } from "@/lib/purchaseCalculations";
import { getInvoiceCanonicalKey, isInvoiceInRange } from "@/lib/invoiceIdentity";
import { loadInvoicesByFinancialDate } from "@/lib/invoiceRangeLoader";
import FinancialKpiCards from "@/components/financial-reports/FinancialKpiCards";
import FinancialAverageCards from "@/components/financial-reports/FinancialAverageCards";
import FinancialTargetCard from "@/components/financial-reports/FinancialTargetCard";
import FinancialBranchComparisonTable from "@/components/financial-reports/FinancialBranchComparisonTable";
import FinancialSupplierAnalysisTable from "@/components/financial-reports/FinancialSupplierAnalysisTable";
import FinancialReportExport from "@/components/financial-reports/FinancialReportExport";
import FinancialAdminExpensesCard from "@/components/financial-reports/FinancialAdminExpensesCard";
import { Calendar, Building2, Truck, AlertTriangle } from "lucide-react";

const FinancialSalesVsPurchasesChart = lazy(() => import("@/components/financial-reports/FinancialSalesVsPurchasesChart"));
const FinancialSupplierBalanceTrendChart = lazy(() => import("@/components/financial-reports/FinancialSupplierBalanceTrendChart"));

// بنود ليست مصروفات حقيقية بل طرق دفع تُضاف لصافي المبيعات
const PAYMENT_METHOD_KEYWORDS = ["فودافون كاش", "انستا", "فيزا"];
const expenseLabel = (e) => `${e.category || ""} ${e.description || ""}`.trim();
const paymentMethodTotal = (expenses) =>
  (expenses || []).reduce((sum, e) => {
    const label = expenseLabel(e);
    return PAYMENT_METHOD_KEYWORDS.some(k => label.includes(k)) ? sum + (e.amount || 0) : sum;
  }, 0);

const PERIOD_OPTIONS = [
  { value: "cycle", label: "الدورة 26→25" },
  { value: "previous_cycle", label: "الدورة السابقة" },
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "الشهر الميلادي" },
  { value: "last_month", label: "الشهر الميلادي السابق" },
  { value: "custom", label: "فترة مخصصة" },
];

async function loadAllFiltered(entity, query, sort, maxRows = 10000) {
  const PAGE = 500;
  const rows = [];
  const hasFilter = query && Object.keys(query).length > 0;
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = hasFilter
      ? await entity.filter(query, sort, PAGE, offset)
      : await entity.list(sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

export default function FinancialReports() {
  const [periodType, setPeriodType] = useState("cycle");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [branch, setBranch] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [loadSupplierDepth, setLoadSupplierDepth] = useState(false);
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);

  const { dateFrom, dateTo } = useMemo(
    () => computeDateRange(periodType, customFrom, customTo),
    [periodType, customFrom, customTo]
  );

  const periodEnabled = Boolean(dateFrom && dateTo);
  useEffect(() => {
    setSecondaryEnabled(false);
    const timer = setTimeout(() => setSecondaryEnabled(true), 700);
    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, branch, supplier]);
  const periodBranchFilter = branch === "all" ? {} : { branch };
  const periodInvoiceFilter = {
    ...periodBranchFilter,
    ...(supplier === "all" ? {} : { supplier_name: supplier }),
  };
  const periodPaymentFilter = {
    payment_date: { $gte: dateFrom, $lte: dateTo },
    ...(supplier === "all" ? {} : { supplier_name: supplier }),
  };
  const { data: handovers = [] } = useQuery({
    queryKey: ["shift-deliveries-fr", dateFrom, dateTo, branch],
    queryFn: () => loadAllFiltered(base44.entities.ShiftDelivery, { ...periodBranchFilter, shift_date: { $gte: dateFrom, $lte: dateTo } }, "-shift_date"),
    enabled: periodEnabled,
    staleTime: 120000,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["purchase-invoices-fr", dateFrom, dateTo, branch, supplier],
    queryFn: () => loadInvoicesByFinancialDate(base44.entities.PurchaseInvoice, {
      from: dateFrom,
      to: dateTo,
      extraFilter: periodInvoiceFilter,
      sort: "-invoice_date",
      maxRows: 20000,
    }),
    enabled: periodEnabled,
    staleTime: 120000,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["supplier-payments-fr", dateFrom, dateTo, supplier],
    queryFn: () => loadAllFiltered(base44.entities.SupplierPayment, periodPaymentFilter, "-payment_date"),
    enabled: periodEnabled && secondaryEnabled,
    staleTime: 120000,
  });
  const supplierDepthEnabled = loadSupplierDepth || supplier !== "all";
  const balanceInvoiceQuery = {
    payment_type: "آجل",
    ...(supplier === "all" ? {} : { supplier_name: supplier }),
    ...(branch === "all" ? {} : { branch }),
  };
  const balancePaymentQuery = supplier === "all" ? {} : { supplier_name: supplier }; 
  const { data: balanceInvoices = [] } = useQuery({
    queryKey: ["purchase-credit-balance-fr", supplier, branch],
    queryFn: () => loadAllFiltered(base44.entities.PurchaseInvoice, balanceInvoiceQuery, "-invoice_date"),
    enabled: supplierDepthEnabled,
    staleTime: 300000,
  });
  const { data: balancePayments = [] } = useQuery({
    queryKey: ["supplier-balance-payments-fr", supplier],
    queryFn: () => loadAllFiltered(base44.entities.SupplierPayment, balancePaymentQuery, "-payment_date"),
    enabled: supplierDepthEnabled,
    staleTime: 300000,
  });
  const { data: debts = [] } = useQuery({ queryKey: ["supplier-debts-fr"], queryFn: () => base44.entities.SupplierDebt.list(), enabled: supplierDepthEnabled, staleTime: 300000 });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list-fr"], queryFn: () => base44.entities.Supplier.list() });
  const targetMonth = (dateTo || dateFrom || "").slice(0, 7);
  const { data: branchTargets = [] } = useQuery({
    queryKey: ["target-goals-fr", targetMonth],
    queryFn: () => base44.entities.TargetGoal.filter({ month: targetMonth }, "branch"),
    enabled: Boolean(targetMonth),
    staleTime: 300000,
  });
  const { data: adminExpenseItems = [] } = useQuery({
    queryKey: ["admin-expense-items-fr"],
    queryFn: () => base44.entities.AdminExpenseItem.list("sort_order"),
    select: (data) => data.filter((i) => i.is_active !== false),
    enabled: secondaryEnabled,
    staleTime: 300000,
  });
  const { data: adminExpenseRecords = [] } = useQuery({
    queryKey: ["admin-expense-records-fr", dateFrom?.slice(0, 7), dateTo?.slice(0, 7)],
    queryFn: () => base44.entities.AdminExpenseRecord.filter({ month: { $gte: dateFrom.slice(0, 7), $lte: dateTo.slice(0, 7) } }, "month"),
    enabled: periodEnabled && secondaryEnabled,
    staleTime: 300000,
  });

  const reviewableHandovers = useMemo(() => handovers.filter(h => h.is_archived !== true), [handovers]);
  const activeHandovers = useMemo(() => reviewableHandovers.filter(h => h.status !== "مراجعة"), [reviewableHandovers]);
  const fHandovers = useMemo(() => activeHandovers.filter(h => branch === "all" || h.branch === branch), [activeHandovers, branch]);
  const periodInvoices = useMemo(() => invoices.filter((i) => isInvoiceInRange(i, dateFrom, dateTo)), [invoices, dateFrom, dateTo]);
  const qualityInvoices = useMemo(() => periodInvoices.filter((i) => (branch === "all" || i.branch === branch) && (supplier === "all" || i.supplier_name === supplier)), [periodInvoices, branch, supplier]);
  const fInvoices = useMemo(() => qualityInvoices.filter(isInvoiceFinanciallyApproved), [qualityInvoices]);
  const approvedBalanceInvoices = useMemo(() => balanceInvoices.filter(isInvoiceFinanciallyApproved), [balanceInvoices]);
  const approvedBalancePayments = useMemo(() => balancePayments.filter((p) => branch === "all" || !p.branch || p.branch === branch), [balancePayments, branch]);
  const fPayments = useMemo(() => payments.filter((p) => (supplier === "all" || p.supplier_name === supplier) && (branch === "all" || !p.branch || p.branch === branch)), [payments, supplier, branch]);
  const fDebts = useMemo(() => debts.filter(d => supplier === "all" || d.supplier_name === supplier), [debts, supplier]);

  const duplicateHandoverGroups = useMemo(() => {
    const groups = new Map();
    reviewableHandovers.filter((record) => branch === "all" || record.branch === branch).forEach((record) => {
      const key = `${record.branch || ""}|${record.shift_date || ""}|${record.shift_type || ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    return Array.from(groups.values()).filter((records) => records.length > 1);
  }, [reviewableHandovers, branch]);

  const dataQuality = useMemo(() => {
    const duplicateInvoiceGroups = new Map();
    qualityInvoices.forEach((inv) => {
      const key = getInvoiceCanonicalKey(inv);
      if (!key) return;
      if (!duplicateInvoiceGroups.has(key)) duplicateInvoiceGroups.set(key, []);
      duplicateInvoiceGroups.get(key).push(inv);
    });
    return {
      reviewShifts: reviewableHandovers.filter((h) => h.status === "مراجعة" && (branch === "all" || h.branch === branch)).length,
      missingInvoiceDate: qualityInvoices.filter((i) => !i.invoice_date).length,
      missingInvoiceBranch: qualityInvoices.filter((i) => !i.branch).length,
      uncategorizedInvoices: fInvoices.filter((i) => !i.purchase_category || i.purchase_category === "unclassified").length,
      pendingInvoices: qualityInvoices.filter((i) => i.status === "انتظار المراجعة").length,
      rejectedInvoices: qualityInvoices.filter((i) => i.status === "مرفوضة").length,
      duplicateInvoiceGroups: [...duplicateInvoiceGroups.values()].filter((rows) => rows.length > 1).length,
    };
  }, [qualityInvoices, fInvoices, reviewableHandovers, branch]);
  const qualityIssueCount = Object.values(dataQuality).reduce((s, n) => s + Number(n || 0), 0);

  const kpiData = useMemo(() => ({
    totalSales: fHandovers.reduce((s,h) => s + (h.total_sales || 0), 0),
    netSales: fHandovers.reduce((s,h) => s + (h.net_amount || 0) + paymentMethodTotal(h.expenses), 0),
    totalPurchases: fInvoices.reduce((s,i) => s + getInvoiceNetAmount(i, suppliers), 0),
    totalPayments: fInvoices.reduce((s,i) => s + (i.paid_value || 0), 0),
    currentDebts: supplierDepthEnabled ? computeTotalRemaining(approvedBalanceInvoices, approvedBalancePayments, debts, supplier) : null,
    supplierPayments: fPayments.reduce((s,p) => s + (p.status === "reversed" ? 0 : (p.transaction_type === "reversal" ? -1 : 1) * (p.amount || 0)), 0),
  }), [fHandovers, fInvoices, fPayments, approvedBalanceInvoices, approvedBalancePayments, debts, supplier, suppliers, supplierDepthEnabled]);

  const distinctDayCount = (arr, field) => {
    const days = new Set(arr.map(r => (r[field] || "").slice(0, 10)).filter(Boolean));
    return days.size;
  };
  const salesDays = useMemo(() => distinctDayCount(fHandovers, "shift_date"), [fHandovers]);
  const purchaseDays = useMemo(() => distinctDayCount(fInvoices, "invoice_date"), [fInvoices]);

  // متوسط المبيعات اليومي لكل فرع على حدة (بغض النظر عن فلتر الفرع المختار) عشان مودال "متوسط المبيعات اليومي"
  const branchAvgSales = useMemo(() => {
    return BRANCHES.map(b => {
      const bHandovers = activeHandovers.filter(h => h.branch === b);
      const bTotalSales = bHandovers.reduce((s, h) => s + (h.total_sales || 0), 0);
      const bDays = distinctDayCount(bHandovers, "shift_date");
      return { branch: b, avgSales: bDays > 0 ? bTotalSales / bDays : 0, days: bDays };
    });
  }, [activeHandovers]);

  const totalExpenses = useMemo(() =>
    fHandovers.reduce((sum, h) => sum + (h.expenses || []).reduce((s, e) => {
      const label = expenseLabel(e);
      return PAYMENT_METHOD_KEYWORDS.some(k => label.includes(k)) ? s : s + (e.amount || 0);
    }, 0), 0)
  , [fHandovers]);

  const avgData = useMemo(() => ({
    avgSales: salesDays > 0 ? kpiData.totalSales / salesDays : 0,
    avgPurchases: purchaseDays > 0 ? kpiData.totalPurchases / purchaseDays : 0,
    avgExpenses: salesDays > 0 ? totalExpenses / salesDays : 0,
  }), [kpiData, totalExpenses, salesDays, purchaseDays]);

  const isDaily = useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    return (new Date(dateTo) - new Date(dateFrom)) / (1000*60*60*24) <= 45;
  }, [dateFrom, dateTo]);
  const chartData = useMemo(() => buildChartData(fHandovers, fInvoices, dateFrom, dateTo, suppliers), [fHandovers, fInvoices, dateFrom, dateTo, suppliers]);

  const branchComparison = useMemo(() => buildBranchComparison(fHandovers, fInvoices, suppliers), [fHandovers, fInvoices, suppliers]);
  const supplierAnalysis = useMemo(() => buildSupplierAnalysis(fInvoices, fPayments, fDebts, approvedBalanceInvoices, approvedBalancePayments), [fInvoices, fPayments, fDebts, approvedBalanceInvoices, approvedBalancePayments]);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">التقارير المالية</h1>
        <FinancialReportExport
          handovers={fHandovers}
          invoices={fInvoices}
          suppliers={suppliers}
          dateFrom={dateFrom}
          dateTo={dateTo}
          periodLabel={`${PERIOD_OPTIONS.find(o => o.value === periodType)?.label || ""} (${dateFrom} ← ${dateTo})`}
        />
      </div>

      {(duplicateHandoverGroups.length > 0 || qualityIssueCount > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-bold text-sm">جودة البيانات قبل اعتماد التقرير</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {duplicateHandoverGroups.length > 0 && <span className="rounded-full bg-white border px-2 py-1">شيفتات مكررة: {duplicateHandoverGroups.length}</span>}
              {dataQuality.reviewShifts > 0 && <span className="rounded-full bg-white border px-2 py-1">شيفتات تحت المراجعة: {dataQuality.reviewShifts}</span>}
              {dataQuality.duplicateInvoiceGroups > 0 && <span className="rounded-full bg-white border px-2 py-1">مجموعات فواتير مكررة: {dataQuality.duplicateInvoiceGroups}</span>}
              {dataQuality.missingInvoiceDate > 0 && <span className="rounded-full bg-white border px-2 py-1">فواتير بدون تاريخ رسمي: {dataQuality.missingInvoiceDate}</span>}
              {dataQuality.missingInvoiceBranch > 0 && <span className="rounded-full bg-white border px-2 py-1">فواتير بدون فرع: {dataQuality.missingInvoiceBranch}</span>}
              {dataQuality.uncategorizedInvoices > 0 && <span className="rounded-full bg-white border px-2 py-1">فواتير غير مصنفة: {dataQuality.uncategorizedInvoices}</span>}
              {dataQuality.pendingInvoices > 0 && <span className="rounded-full bg-white border px-2 py-1">انتظار مراجعة: {dataQuality.pendingInvoices}</span>}
              {dataQuality.rejectedInvoices > 0 && <span className="rounded-full bg-white border px-2 py-1">مرفوضة: {dataQuality.rejectedInvoices}</span>}
            </div>
            <p className="text-xs">سجلات الشيفت بحالة «مراجعة» لا تدخل في أرقام المبيعات التنفيذية. باقي التنبيهات لا تُعدَّل تلقائيًا حتى تتم مراجعتها من مصدرها.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-500">الفترة:</span>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setPeriodType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                periodType === opt.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {opt.label}
            </button>
          ))}
          {periodType === "custom" && (
            <div className="flex items-center gap-1">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border rounded px-2 py-1 text-xs" />
              <span className="text-gray-400">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border rounded px-2 py-1 text-xs" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={branch} onChange={e => setBranch(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="all">كل الفروع</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={supplier} onChange={e => setSupplier(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="all">كل الموردين</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <FinancialKpiCards data={kpiData} />

      {!supplierDepthEnabled && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><p className="font-bold text-blue-900 text-sm">تحليل الذمم التاريخي للموردين مؤجل لتسريع فتح التقرير</p><p className="text-xs text-blue-700 mt-1">الأرقام الأساسية للفترة ظهرت بالفعل. حمّل الذمم فقط لو محتاج الرصيد الحالي وتحليل الموردين التاريخي.</p></div>
          <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700" onClick={() => setLoadSupplierDepth(true)}>تحميل الذمم وتحليل الموردين</button>
        </div>
      )}

      <FinancialAdminExpensesCard items={adminExpenseItems} records={adminExpenseRecords} dateFrom={dateFrom} dateTo={dateTo} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
        <div className="lg:col-span-3"><FinancialAverageCards data={avgData} branchAvgSales={branchAvgSales} /></div>
        <div className="flex flex-col justify-end"><FinancialTargetCard handovers={fHandovers} targets={branchTargets} dateFrom={dateFrom} dateTo={dateTo} /></div>
      </div>
      <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">جاري تحميل الرسم المالي...</div>}>
        <FinancialSalesVsPurchasesChart data={chartData} isDaily={isDaily} />
      </Suspense>
      <FinancialBranchComparisonTable data={branchComparison} />
      {supplierDepthEnabled && <FinancialSupplierAnalysisTable data={supplierAnalysis} invoices={fInvoices} payments={fPayments} />}
      {supplierDepthEnabled && <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">جاري تحميل تطور رصيد الموردين...</div>}><FinancialSupplierBalanceTrendChart invoices={approvedBalanceInvoices} payments={approvedBalancePayments} debts={debts} supplier={supplier} /></Suspense>}
    </div>
  );
}
