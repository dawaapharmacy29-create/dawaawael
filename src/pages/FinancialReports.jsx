import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  BRANCHES, computeDateRange, buildChartData, buildBranchComparison,
  buildSupplierAnalysis, computeTotalRemaining,
} from "@/lib/financial-report-utils";
import { getInvoiceNetAmount } from "@/lib/purchaseCalculations";
import FinancialKpiCards from "@/components/financial-reports/FinancialKpiCards";
import FinancialAverageCards from "@/components/financial-reports/FinancialAverageCards";
import FinancialTargetCard from "@/components/financial-reports/FinancialTargetCard";
import FinancialSalesVsPurchasesChart from "@/components/financial-reports/FinancialSalesVsPurchasesChart";
import FinancialBranchComparisonTable from "@/components/financial-reports/FinancialBranchComparisonTable";
import FinancialSupplierAnalysisTable from "@/components/financial-reports/FinancialSupplierAnalysisTable";
import FinancialReportExport from "@/components/financial-reports/FinancialReportExport";
import FinancialAdminExpensesCard from "@/components/financial-reports/FinancialAdminExpensesCard";
import FinancialSupplierBalanceTrendChart from "@/components/financial-reports/FinancialSupplierBalanceTrendChart";
import { Calendar, Building2, Truck, AlertTriangle } from "lucide-react";

// بنود ليست مصروفات حقيقية بل طرق دفع تُضاف لصافي المبيعات
const PAYMENT_METHOD_KEYWORDS = ["فودافون كاش", "انستا", "فيزا"];
const expenseLabel = (e) => `${e.category || ""} ${e.description || ""}`.trim();
const paymentMethodTotal = (expenses) =>
  (expenses || []).reduce((sum, e) => {
    const label = expenseLabel(e);
    return PAYMENT_METHOD_KEYWORDS.some(k => label.includes(k)) ? sum + (e.amount || 0) : sum;
  }, 0);

const PERIOD_OPTIONS = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر السابق" },
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
  const [periodType, setPeriodType] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [branch, setBranch] = useState("all");
  const [supplier, setSupplier] = useState("all");

  const { dateFrom, dateTo } = useMemo(
    () => computeDateRange(periodType, customFrom, customTo),
    [periodType, customFrom, customTo]
  );

  const periodEnabled = Boolean(dateFrom && dateTo);
  const { data: handovers = [] } = useQuery({
    queryKey: ["shift-deliveries-fr", dateFrom, dateTo],
    queryFn: () => loadAllFiltered(base44.entities.ShiftDelivery, { shift_date: { $gte: dateFrom, $lte: dateTo } }, "-shift_date"),
    enabled: periodEnabled,
    staleTime: 120000,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["purchase-invoices-fr", dateFrom, dateTo],
    queryFn: () => loadAllFiltered(base44.entities.PurchaseInvoice, {
      $or: [
        { invoice_date: { $gte: dateFrom, $lte: dateTo } },
        { created_date: { $gte: `${dateFrom}T00:00:00`, $lte: `${dateTo}T23:59:59` } },
      ],
    }, "-created_date"),
    enabled: periodEnabled,
    staleTime: 120000,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["supplier-payments-fr", dateFrom, dateTo],
    queryFn: () => loadAllFiltered(base44.entities.SupplierPayment, { payment_date: { $gte: dateFrom, $lte: dateTo } }, "-payment_date"),
    enabled: periodEnabled,
    staleTime: 120000,
  });
  const balanceInvoiceQuery = supplier === "all" ? { payment_type: "آجل" } : { payment_type: "آجل", supplier_name: supplier };
  const balancePaymentQuery = supplier === "all" ? {} : { supplier_name: supplier };
  const { data: balanceInvoices = [] } = useQuery({
    queryKey: ["purchase-credit-balance-fr", supplier],
    queryFn: () => loadAllFiltered(base44.entities.PurchaseInvoice, balanceInvoiceQuery, "-invoice_date"),
    staleTime: 300000,
  });
  const { data: balancePayments = [] } = useQuery({
    queryKey: ["supplier-balance-payments-fr", supplier],
    queryFn: () => loadAllFiltered(base44.entities.SupplierPayment, balancePaymentQuery, "-payment_date"),
    staleTime: 300000,
  });
  const { data: debts = [] } = useQuery({ queryKey: ["supplier-debts-fr"], queryFn: () => base44.entities.SupplierDebt.list(), staleTime: 300000 });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list-fr"], queryFn: () => base44.entities.Supplier.list() });
  const { data: branchTargets = [] } = useQuery({ queryKey: ["target-goals-fr"], queryFn: () => base44.entities.TargetGoal.list() });
  const { data: adminExpenseItems = [] } = useQuery({
    queryKey: ["admin-expense-items-fr"],
    queryFn: () => base44.entities.AdminExpenseItem.list("sort_order"),
    select: (data) => data.filter((i) => i.is_active !== false),
  });
  const { data: adminExpenseRecords = [] } = useQuery({ queryKey: ["admin-expense-records-fr"], queryFn: () => base44.entities.AdminExpenseRecord.list() });

  const reviewableHandovers = useMemo(() => handovers.filter(h => h.is_archived !== true), [handovers]);
  const activeHandovers = useMemo(() => reviewableHandovers.filter(h => h.status !== "مراجعة"), [reviewableHandovers]);
  const fHandovers = useMemo(() => activeHandovers.filter(h => branch === "all" || h.branch === branch), [activeHandovers, branch]);
  const fInvoices = useMemo(() => invoices.filter(i => (branch === "all" || i.branch === branch) && (supplier === "all" || i.supplier_name === supplier)), [invoices, branch, supplier]);
  const fPayments = useMemo(() => payments.filter(p => supplier === "all" || p.supplier_name === supplier), [payments, supplier]);
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

  const kpiData = useMemo(() => ({
    totalSales: fHandovers.reduce((s,h) => s + (h.total_sales || 0), 0),
    netSales: fHandovers.reduce((s,h) => s + (h.net_amount || 0) + paymentMethodTotal(h.expenses), 0),
    totalPurchases: fInvoices.reduce((s,i) => s + getInvoiceNetAmount(i, suppliers), 0),
    totalPayments: fInvoices.reduce((s,i) => s + (i.paid_value || 0), 0),
    currentDebts: computeTotalRemaining(balanceInvoices, balancePayments, debts, supplier),
    supplierPayments: fPayments.reduce((s,p) => s + (p.amount || 0), 0),
  }), [fHandovers, fInvoices, fPayments, balanceInvoices, balancePayments, debts, supplier, suppliers]);

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
  const supplierAnalysis = useMemo(() => buildSupplierAnalysis(fInvoices, fPayments, fDebts, balanceInvoices, balancePayments), [fInvoices, fPayments, fDebts, balanceInvoices, balancePayments]);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">التقارير المالية</h1>
        <FinancialReportExport
          handovers={activeHandovers}
          invoices={invoices}
          suppliers={suppliers}
          dateFrom={dateFrom}
          dateTo={dateTo}
          periodLabel={`${PERIOD_OPTIONS.find(o => o.value === periodType)?.label || ""} (${dateFrom} ← ${dateTo})`}
        />
      </div>

      {duplicateHandoverGroups.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">تنبيه مراجعة: يوجد {duplicateHandoverGroups.length} شيفت مكرر داخل الفترة المختارة</p>
            <p className="text-xs mt-1">إجماليات المبيعات والتارجت قد تكون أعلى من الرقم الصحيح لحين مراجعة السجلات المكررة من صفحة تسليم الشيفت. لم يتم استبعاد أي سجل تلقائيًا حفاظًا على البيانات.</p>
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

      <FinancialAdminExpensesCard items={adminExpenseItems} records={adminExpenseRecords} dateFrom={dateFrom} dateTo={dateTo} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
        <div className="lg:col-span-3"><FinancialAverageCards data={avgData} branchAvgSales={branchAvgSales} /></div>
        <div className="flex flex-col justify-end"><FinancialTargetCard handovers={activeHandovers} targets={branchTargets} /></div>
      </div>
      <FinancialSalesVsPurchasesChart data={chartData} isDaily={isDaily} />
      <FinancialBranchComparisonTable data={branchComparison} />
      <FinancialSupplierAnalysisTable data={supplierAnalysis} invoices={fInvoices} payments={fPayments} />
      <FinancialSupplierBalanceTrendChart invoices={balanceInvoices} payments={balancePayments} debts={debts} supplier={supplier} />
    </div>
  );
}
