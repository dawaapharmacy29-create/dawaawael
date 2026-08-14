import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CalendarDays, CalendarRange, TrendingUp, FileBarChart, Users, Building2, LayoutDashboard, Crown, Pill, Package, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/lib/useUserRole";
import ReportsDashboard from "@/components/purchase-reports/ReportsDashboard";
import BranchBreakdown from "@/components/purchase-reports/BranchBreakdown";
import SupplierBreakdown from "@/components/purchase-reports/SupplierBreakdown";
import AdminSummary from "@/components/purchase-reports/AdminSummary";
import MonthlySalesPurchasesChart from "@/components/purchase-reports/MonthlySalesPurchasesChart";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const BRANCH_COLORS = { "دواء شكري": "#3b82f6", "دواء الشامي": "#a855f7" };

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split("T")[0];
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split("T")[0];
}
function dayBeforeYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split("T")[0];
}
function monthStartStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthEndStr() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
}
function monthLabel() {
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const now = new Date();
  return `${MONTHS_AR[now.getMonth()]} ${now.getFullYear()}`;
}

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

export default function PurchaseReports() {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [filterBranch, setFilterBranch] = useState("الكل");
  const [filterSupplier, setFilterSupplier] = useState("الكل");
  const [tab, setTab] = useState("overview");
  const [categorizeOpen, setCategorizeOpen] = useState(false);
  const [pendingCategories, setPendingCategories] = useState({});
  const [categorizeFilter, setCategorizeFilter] = useState("uncategorized"); // uncategorized | all
  const [savingCategories, setSavingCategories] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => base44.entities.PurchaseInvoice.list("-created_date", 5000),
    staleTime: 60000,
  });

  const uniqueSuppliers = useMemo(
    () => [...new Set(invoices.map((i) => i.supplier_name).filter(Boolean))].sort(),
    [invoices]
  );

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const dateKey = inv.invoice_date || inv.created_date?.split("T")[0];
      if (dateFrom && (!dateKey || dateKey < dateFrom)) return false;
      if (dateTo && (!dateKey || dateKey > dateTo)) return false;
      if (filterBranch !== "الكل" && inv.branch !== filterBranch) return false;
      if (filterSupplier !== "الكل" && inv.supplier_name !== filterSupplier) return false;
      return true;
    });
  }, [invoices, dateFrom, dateTo, filterBranch, filterSupplier]);

  const totalPurchases = filtered.reduce((s, i) => s + (i.total_value || 0), 0);
  const totalInvoices = filtered.length;

  const branchTotals = useMemo(() => BRANCHES.map((branch) => {
    const list = filtered.filter((i) => i.branch === branch);
    return {
      branch,
      total: list.reduce((s, i) => s + (i.total_value || 0), 0),
      count: list.length,
      color: BRANCH_COLORS[branch],
    };
  }), [filtered]);

  const supplierTotals = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      const name = i.supplier_name || "غير محدد";
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += i.total_value || 0;
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const topSupplier = supplierTotals[0] || null;
  const topBranch = [...branchTotals].sort((a, b) => b.total - a.total)[0] || null;

  // إجمالي المشتريات حسب تصنيف الفاتورة (أدوية / مستلزمات وإكسسوار) لنفس الفترة والفلاتر المحددة فوق
  const categoryTotals = useMemo(() => {
    const cats = { medicines: 0, supplies_accessories: 0 };
    let uncategorized = 0;
    filtered.forEach((i) => {
      if (cats[i.purchase_category] !== undefined) cats[i.purchase_category] += i.total_value || 0;
      else uncategorized += i.total_value || 0;
    });
    return { cats, uncategorized };
  }, [filtered]);

  // فواتير الشهر الحالي اللي محتاجة تصنيف (لأداة المراجعة الجماعية)
  const thisMonthInvoices = useMemo(() => {
    const start = monthStartStr();
    const end = monthEndStr();
    return invoices.filter((inv) => {
      const d = inv.invoice_date || inv.created_date?.split("T")[0];
      return d && d >= start && d <= end;
    });
  }, [invoices]);
  const categorizeList = useMemo(
    () => (categorizeFilter === "uncategorized" ? thisMonthInvoices.filter((i) => !i.purchase_category || i.purchase_category === "unclassified") : thisMonthInvoices),
    [thisMonthInvoices, categorizeFilter]
  );

  const setPendingCategory = (id, cat) => setPendingCategories((p) => ({ ...p, [id]: cat }));

  const saveCategorization = async () => {
    const entries = Object.entries(pendingCategories);
    if (entries.length === 0) { setCategorizeOpen(false); return; }
    setSavingCategories(true);
    try {
      for (let i = 0; i < entries.length; i += 5) {
        const chunk = entries.slice(i, i + 5);
        await Promise.all(chunk.map(([id, cat]) => base44.entities.PurchaseInvoice.update(id, { purchase_category: cat, purchase_category_source: "manual" })));
      }
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setPendingCategories({});
      setCategorizeOpen(false);
    } finally {
      setSavingCategories(false);
    }
  };

  const setPreset = (preset) => {
    if (preset === "today") { setDateFrom(todayStr()); setDateTo(todayStr()); }
    else if (preset === "yesterday") { setDateFrom(yesterdayStr()); setDateTo(yesterdayStr()); }
    else if (preset === "day_before_yesterday") { setDateFrom(dayBeforeYesterdayStr()); setDateTo(dayBeforeYesterdayStr()); }
    else if (preset === "month") { setDateFrom(monthStartStr()); setDateTo(monthEndStr()); }
  };

  const isToday = dateFrom === todayStr() && dateTo === todayStr();
  const isYesterday = dateFrom === yesterdayStr() && dateTo === yesterdayStr();
  const isDayBeforeYesterday = dateFrom === dayBeforeYesterdayStr() && dateTo === dayBeforeYesterdayStr();
  const isMonth = dateFrom === monthStartStr() && dateTo === monthEndStr();

  if (!isAdmin) {
    return (
      <div dir="rtl" className="p-6 text-center text-gray-500">
        <Crown className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        هذه الصفحة متاحة للمدير فقط
      </div>
    );
  }

  const tabs = [
    { key: "overview", icon: LayoutDashboard, label: "نظرة عامة" },
    { key: "branches", icon: Building2, label: "تقرير الفروع" },
    { key: "suppliers", icon: Users, label: "تفاصيل الموردين" },
    { key: "admin", icon: Crown, label: "تقرير الإدارة" },
  ];

  return (
    <div dir="rtl" className="p-3 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
          <FileBarChart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">تقارير المشتريات اليومي</h1>
          <p className="text-gray-500 text-xs mt-0.5">{totalInvoices} فاتورة في الفترة المحددة</p>
        </div>
      </div>

      {/* Date presets + filters */}
      <div className="bg-white rounded-xl border p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setPreset("today")}
            className={`h-8 rounded-md border px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${isToday ? "bg-teal-600 text-white border-teal-600" : "bg-transparent hover:bg-gray-50"}`}>
            <CalendarDays className="w-3.5 h-3.5" /> اليوم الحالي
          </button>
          <button onClick={() => setPreset("yesterday")}
            className={`h-8 rounded-md border px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${isYesterday ? "bg-teal-600 text-white border-teal-600" : "bg-transparent hover:bg-gray-50"}`}>
            <CalendarDays className="w-3.5 h-3.5" /> اليوم السابق
          </button>
          <button onClick={() => setPreset("day_before_yesterday")}
            className={`h-8 rounded-md border px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${isDayBeforeYesterday ? "bg-teal-600 text-white border-teal-600" : "bg-transparent hover:bg-gray-50"}`}>
            <CalendarDays className="w-3.5 h-3.5" /> اليوم الاسبق
          </button>
          <button onClick={() => setPreset("month")}
            className={`h-8 rounded-md border px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${isMonth ? "bg-teal-600 text-white border-teal-600" : "bg-transparent hover:bg-gray-50"}`}>
            <CalendarRange className="w-3.5 h-3.5" /> الشهر الحالي
          </button>
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <span className="text-xs text-gray-500">من:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none" />
          <span className="text-xs text-gray-500">إلى:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-400">الفرع:</span>
          {["الكل", ...BRANCHES].map((b) => (
            <button key={b} onClick={() => setFilterBranch(b)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterBranch === b ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"}`}>
              {b}
            </button>
          ))}
          {uniqueSuppliers.length > 0 && (
            <>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <span className="text-xs text-gray-400">المورد:</span>
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none max-w-40">
                <option value="الكل">كل الموردين</option>
                {uniqueSuppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <p className="text-xs text-gray-600">إجمالي المشتريات</p>
          </div>
          <p className="text-lg font-bold text-teal-700">{fmt(totalPurchases)} ج.م</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{totalInvoices} فاتورة</p>
        </div>
        {branchTotals.map((b) => (
          <div key={b.branch} className="rounded-xl border p-4" style={{ borderColor: b.color + "40", backgroundColor: b.color + "0d" }}>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4" style={{ color: b.color }} />
              <p className="text-xs text-gray-600">{b.branch}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: b.color }}>{fmt(b.total)} ج.م</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{b.count} فاتورة</p>
          </div>
        ))}
      </div>

      {/* Top Suppliers row */}
      {supplierTotals.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-purple-500" />
            <p className="text-sm font-bold text-gray-700">الموردين ({supplierTotals.length})</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {supplierTotals.map((s, idx) => (
              <div key={s.name} className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3 hover:border-purple-200 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-orange-400" : "bg-purple-400"}`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-500">{fmt(s.total)} ج.م · {s.count} فاتورة</p>
                </div>
                {idx === 0 && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b flex overflow-x-auto scrollbar-hide gap-1 pb-0">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileBarChart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          لا توجد بيانات مشتريات في الفترة المحددة
        </div>
      ) : (
        <>
          {tab === "overview" && <ReportsDashboard invoices={filtered} branchTotals={branchTotals} supplierTotals={supplierTotals} />}
          {tab === "branches" && <BranchBreakdown invoices={filtered} />}
          {tab === "suppliers" && <SupplierBreakdown invoices={filtered} dateFrom={dateFrom} dateTo={dateTo} />}
          {tab === "admin" && <AdminSummary invoices={filtered} branchTotals={branchTotals} supplierTotals={supplierTotals} topSupplier={topSupplier} topBranch={topBranch} totalPurchases={totalPurchases} totalInvoices={totalInvoices} />}
        </>
      )}

      {/* كروت تصنيف المشتريات حسب نوع الفواتير — أسفل الصفحة */}
      <div className="pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-bold text-gray-700">المشتريات حسب النوع (لنفس الفترة والفلاتر المحددة فوق)</p>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => { setCategorizeOpen(true); setPendingCategories({}); }}>
              <Package className="w-3.5 h-3.5" /> مراجعة تصنيف فواتير الشهر الحالي
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileBarChart className="w-4 h-4 text-gray-500" />
              <p className="text-xs text-gray-600">إجمالي</p>
            </div>
            <p className="text-lg font-bold text-gray-800">{fmt(totalPurchases)} ج.م</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Pill className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-gray-600">أدوية</p>
            </div>
            <p className="text-lg font-bold text-emerald-700">{fmt(categoryTotals.cats.medicines)} ج.م</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-600">مستلزمات وإكسسوار</p>
            </div>
            <p className="text-lg font-bold text-blue-700">{fmt(categoryTotals.cats.supplies_accessories)} ج.م</p>
          </div>
        </div>
        {categoryTotals.uncategorized > 0 && (
          <p className="text-[11px] text-amber-600 mt-2">
            ⚠️ {fmt(categoryTotals.uncategorized)} ج.م من فواتير بدون تصنيف في الفترة دي — مش داخلة في أي من الكروت.
          </p>
        )}
      </div>

      {/* Dialog: مراجعة تصنيف فواتير الشهر الحالي */}
      <Dialog open={categorizeOpen} onOpenChange={setCategorizeOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-right">مراجعة تصنيف فواتير الشهر الحالي ({monthLabel()})</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setCategorizeFilter("uncategorized")} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${categorizeFilter === "uncategorized" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200"}`}>غير مصنفة فقط</button>
            <button onClick={() => setCategorizeFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${categorizeFilter === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200"}`}>كل فواتير الشهر</button>
          </div>
          {categorizeList.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">مفيش فواتير تحتاج مراجعة حاليًا.</p>
          ) : (
            <div className="space-y-2">
              {categorizeList.map((inv) => {
                const current = pendingCategories[inv.id] ?? (inv.purchase_category && inv.purchase_category !== "unclassified" ? inv.purchase_category : "");
                return (
                  <div key={inv.id} className="border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{inv.supplier_name || "بدون مورد"}</p>
                      <p className="text-xs text-gray-400">{inv.system_invoice_number} — {inv.branch} — {fmt(inv.total_value)} ج.م</p>
                    </div>
                    <div className="flex gap-1.5">
                      {[{ key: "medicines", label: "أدوية" }, { key: "supplies_accessories", label: "مستلزمات وإكسسوار" }].map((c) => (
                        <button key={c.key} onClick={() => setPendingCategory(inv.id, c.key)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${current === c.key ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200 hover:border-teal-300"}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button onClick={saveCategorization} disabled={savingCategories} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <CheckCircle2 className="w-4 h-4" /> {savingCategories ? "جاري الحفظ..." : `حفظ (${Object.keys(pendingCategories).length})`}
            </Button>
            <Button variant="outline" onClick={() => setCategorizeOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
