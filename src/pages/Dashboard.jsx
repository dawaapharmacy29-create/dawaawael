import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Calendar } from "lucide-react";
import DashboardStatsCards from "@/components/dashboard/DashboardStatsCards";
import BranchBudgetCard from "@/components/dashboard/BranchBudgetCard";
import BudgetAlert from "@/components/dashboard/BudgetAlert";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import PurchaseDashboard from "@/components/dashboard/PurchaseDashboard";
import BranchSelector from "@/components/dashboard/BranchSelector";
import { getInvoiceNetAmount, getInvoiceCashAmount, isInvoiceExcluded } from "@/lib/purchaseCalculations";
import { fetchAllParallel } from "@/lib/paginatedFetch";
import { useSearchParams } from "react-router-dom";

const BRANCHES = ["دواء شكري", "دواء الشامي"];

const branchColor = {
  "دواء شكري": "bg-blue-50 border-blue-200 text-blue-700",
  "دواء الشامي": "bg-purple-50 border-purple-200 text-purple-700",
};

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtLabel = (iso) => {
  const [y, m, d] = (iso || "").split("-");
  return d ? `${d}-${m}-${y}` : iso;
};

// فترة الشهر تبدأ من يوم 15 من كل شهر حتى يوم 14 من الشهر التالي
function getBillingPeriod(ref = new Date()) {
  const start = ref.getDate() >= 15
    ? new Date(ref.getFullYear(), ref.getMonth(), 15)
    : new Date(ref.getFullYear(), ref.getMonth() - 1, 15);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 14);
  return { from: fmtDate(start), to: fmtDate(end), key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}` };
}

function getPrevBillingPeriod() {
  const start = new Date(getBillingPeriod().from + "T00:00:00");
  start.setMonth(start.getMonth() - 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 14);
  return { from: fmtDate(start), to: fmtDate(end) };
}

function getStoredDates() {
  try {
    const s = localStorage.getItem("dashboard_date_filter");
    if (s) {
      const p = JSON.parse(s);
      if (p.from && p.to) return { from: p.from, to: p.to };
    }
  } catch {}
  const p = getBillingPeriod();
  return { from: p.from, to: p.to };
}

export default function Dashboard() {
  const qc = useQueryClient();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [dateFilter, setDateFilter] = useState(getStoredDates);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const branch = searchParams.get("branch") || "all";
  const setBranch = (b) => {
    const next = new URLSearchParams(searchParams);
    if (b === "all") next.delete("branch");
    else next.set("branch", b);
    setSearchParams(next, { replace: true });
  };
  const [tempDate, setTempDate] = useState(getStoredDates);

  const currentPeriod = getBillingPeriod();
  const prevPeriod = getPrevBillingPeriod();
  const isCurrentMonth = dateFilter.from === currentPeriod.from && dateFilter.to === currentPeriod.to;
  const isPrevMonth = dateFilter.from === prevPeriod.from && dateFilter.to === prevPeriod.to;

  const setPeriod = (p) => {
    setDateFilter({ from: p.from, to: p.to });
    localStorage.setItem("dashboard_date_filter", JSON.stringify({ from: p.from, to: p.to }));
    setShowDateFilter(false);
  };

  const applyDateFilter = () => setPeriod(tempDate);

  useEffect(() => { setEditingTarget(false); }, [branch]);

  // فلترة الفواتير من الخادم حسب الفترة المختارة — يجيب فقط فواتير الشهر بدل 4000+ فاتورة
  const { data: invoices = [], isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["purchase-invoices", "byDate", dateFilter.from, dateFilter.to],
    queryFn: async () =>
      fetchAllParallel(base44.entities.PurchaseInvoice, {
        query: {
          $or: [
            { invoice_date: { $gte: dateFilter.from, $lte: dateFilter.to } },
            { created_date: { $gte: `${dateFilter.from}T00:00:00`, $lte: `${dateFilter.to}T23:59:59` } },
          ],
        },
      }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    staleTime: 60000,
  });
  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => base44.entities.Expense.list("-created_date", 2000),
    staleTime: 60000,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["branch-budgets"],
    queryFn: () => base44.entities.BranchBudget.list(),
    staleTime: 60000,
  });

  // Real-time subscriptions
  useEffect(() => {
    const unsub1 = base44.entities.PurchaseInvoice.subscribe(() => {
      refetchInvoices();
      qc.invalidateQueries({ queryKey: ["pending-invoices-count"] });
    });
    const unsub2 = base44.entities.Expense.subscribe(() => {
      refetchExpenses();
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // مفتاح الشهر الحالي حسب دورة الفوترة (من 15 حتى 14) — الشهر يُنسب لشهر البداية
  const currentMonth = getBillingPeriod().key;
  const { data: targetGoals = [] } = useQuery({
    queryKey: ["target-goals"],
    queryFn: () => base44.entities.TargetGoal.list(),
  });
  const branchTargets = BRANCHES.map((b) => ({
    branch: b,
    target: targetGoals.find((t) => t.month === currentMonth && t.branch === b),
  }));
  const currentBranchTarget = branch === "all"
    ? null
    : branchTargets.find((bt) => bt.branch === branch)?.target;

  const saveTargetMutation = useMutation({
    mutationFn: async (amount) => {
      if (branch === "all") return;
      if (currentBranchTarget) return base44.entities.TargetGoal.update(currentBranchTarget.id, { target_amount: amount });
      return base44.entities.TargetGoal.create({ label: "الهدف الشهري", target_amount: amount, month: currentMonth, branch });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["target-goals"] }); setEditingTarget(false); },
  });

  const now = new Date();
  const { from: monthStart, to: monthEnd } = dateFilter;

  const monthInvoices = invoices.filter((i) => {
    const d = i.invoice_date || i.created_date?.split("T")[0];
    return d && d >= monthStart && d <= monthEnd;
  });
  const monthExpenses = expenses.filter((e) => {
    const d = e.date || e.created_date?.split("T")[0];
    return d && d >= monthStart && d <= monthEnd;
  });
  const branchMonthInvoices = branch === "all" ? monthInvoices : monthInvoices.filter((i) => i.branch === branch);
  const branchMonthExpenses = branch === "all" ? monthExpenses : monthExpenses.filter((e) => e.branch === branch);

  const totalInvoiceValue = branchMonthInvoices.reduce((s, i) => s + getInvoiceNetAmount(i, suppliers), 0);
  const totalExpenses = branchMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalPayments = totalInvoiceValue + totalExpenses;
  const targetAmount = branch === "all"
    ? branchTargets.reduce((s, bt) => s + (bt.target?.target_amount || 0), 0)
    : currentBranchTarget?.target_amount || 0;
  const pending = invoices.filter((i) => i.status === "انتظار المراجعة" && (branch === "all" || i.branch === branch)).length;
  const totalCashPurchases = branchMonthInvoices
    .filter((i) => !isInvoiceExcluded(i, suppliers).excluded)
    .reduce((s, i) => s + getInvoiceCashAmount(i), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">الصفحة الرئيسية</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            من {fmtLabel(monthStart)} إلى {fmtLabel(monthEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={isCurrentMonth ? "default" : "outline"}
            className={isCurrentMonth ? "bg-teal-600 hover:bg-teal-700" : "text-gray-700"}
            onClick={() => setPeriod(currentPeriod)}
          >
            الشهر الحالي
          </Button>
          <Button
            size="sm"
            variant={isPrevMonth ? "default" : "outline"}
            className={isPrevMonth ? "bg-teal-600 hover:bg-teal-700" : "text-gray-700"}
            onClick={() => setPeriod(prevPeriod)}
          >
            الشهر السابق
          </Button>
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => { setTempDate(dateFilter); setShowDateFilter((v) => !v); }} className="gap-2 text-sm">
              <Calendar className="w-4 h-4" /> تحديد الفترة
            </Button>
            {showDateFilter && (
              <div className="absolute left-0 top-10 z-50 bg-white border rounded-xl shadow-lg p-4 space-y-3 w-64 max-w-[calc(100vw-2rem)]" dir="rtl">
                <p className="text-sm font-semibold text-gray-700">اختر الفترة الزمنية</p>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">من تاريخ</label>
                  <Input type="date" value={tempDate.from} onChange={(e) => setTempDate((p) => ({ ...p, from: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">إلى تاريخ</label>
                  <Input type="date" value={tempDate.to} onChange={(e) => setTempDate((p) => ({ ...p, to: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700 flex-1" onClick={applyDateFilter}>تطبيق</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowDateFilter(false)}>إلغاء</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BranchSelector value={branch} onChange={setBranch} />

      {/* Stats — كارت كبير للمدفوعات + كروت صغيرة */}
      <DashboardStatsCards
        totalPayments={totalPayments}
        totalCashPurchases={totalCashPurchases}
        totalExpenses={totalExpenses}
        invoiceCount={branchMonthInvoices.length}
        targetAmount={targetAmount}
        startDate={monthStart}
        endDate={monthEnd}
        canEditTarget={branch !== "all"}
        editingTarget={editingTarget}
        targetInput={targetInput}
        onTargetInputChange={setTargetInput}
        onStartEditTarget={() => { setTargetInput(targetAmount ? targetAmount.toString() : ""); setEditingTarget(true); }}
        onSaveTarget={() => saveTargetMutation.mutate(parseFloat(targetInput))}
        isSavingTarget={saveTargetMutation.isPending}
      />

      {/* Purchase Dashboard */}
      <PurchaseDashboard
        invoices={branchMonthInvoices}
        suppliers={suppliers}
        branch={branch}
        onBranchChange={setBranch}
        dateFilter={dateFilter}
        isLoading={invoicesLoading}
      />

      {/* Low Stock Alerts */}
      <LowStockAlert />

      {/* Budget Alerts */}
      <BudgetAlert invoices={branchMonthInvoices} expenses={branchMonthExpenses} budgets={budgets} suppliers={suppliers} />

      {/* Branch Budget */}
      <div>
        <BranchBudgetCard invoices={branchMonthInvoices} budgets={budgets} suppliers={suppliers} startDate={monthStart} endDate={monthEnd} />
      </div>

      {/* Branches Summary - only when all branches selected */}
      {branch === "all" && (
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> ملخص الفروع
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BRANCHES.map((branch) => {
            const branchInvoices = monthInvoices.filter((i) => i.branch === branch);
            const branchNetInvoices = branchInvoices.filter((i) => !isInvoiceExcluded(i, suppliers).excluded);
            const branchTotal = branchNetInvoices.reduce((s, i) => s + getInvoiceNetAmount(i, suppliers), 0);
            const branchPaid = branchInvoices.reduce((s, i) => s + (i.paid_value || 0), 0);
            const branchExpenses = monthExpenses.filter((e) => e.branch === branch);
            const branchExpTotal = branchExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            return (
              <Card key={branch} className={`p-4 border-2 ${branchColor[branch]}`}>
                <h3 className="font-bold text-base mb-3">{branch}</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span>عدد الفواتير (صافي)</span>
                    <span className="font-semibold">{branchNetInvoices.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>صافي المشتريات</span>
                    <span className="font-semibold">{branchTotal.toLocaleString("ar-EG")} ج</span>
                  </div>
                  <div className="flex justify-between">
                    <span>المدفوع</span>
                    <span className="font-semibold">{branchPaid.toLocaleString("ar-EG")} ج</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <span>المصروفات</span>
                    <span className="font-semibold">{branchExpTotal.toLocaleString("ar-EG")} ج</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      )}

      {/* Pending invoices */}
      {pending > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <p className="text-yellow-800 font-semibold text-sm">
            ⏳ يوجد {pending} فاتورة في انتظار المراجعة
          </p>
        </Card>
      )}
    </div>
  );
}