import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { PlusCircle, List, BarChart3, PieChart as PieIcon, Settings2, AlertTriangle, RotateCcw } from "lucide-react";
import ShiftDeliveryForm from "@/components/shift/ShiftDeliveryForm";
import ShiftDeliveryHistory from "@/components/shift/ShiftDeliveryHistory";
const ShiftOperationsAnalytics = lazy(() => import("@/components/shift/ShiftOperationsAnalytics"));
const ShiftDeliveryReport = lazy(() => import("@/components/shift/ShiftDeliveryReport"));
const ExpenseItemsTab = lazy(() => import("@/components/shift/ExpenseItemsTab"));
const ShiftRecoveryQueue = lazy(() => import("@/components/shift/ShiftRecoveryQueue"));
import { cn } from "@/lib/utils";
import { cycleRangeFor, cairoTodayKey } from "@/lib/smart-commerce-analytics";

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ShiftDelivery() {
  const { isAdmin, isManager, branchAccess, financialAccessLevel } = useUserRole();
  const fullFinancial = financialAccessLevel === "full";
  const canReviewOperationally = isAdmin || isManager;
  const scopedBranches = fullFinancial ? ["دواء شكري", "دواء الشامي"] : branchAccess;
  const hasHistoryScope = scopedBranches.length > 0;
  const [activeTab, setActiveTab] = useState("new");
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [reviewMode, setReviewMode] = useState("duplicates");
  const [reportMode, setReportMode] = useState("stats");
  const currentCycle = cycleRangeFor(cairoTodayKey());

  const needsHistoryData = ["history", "review", "reports"].includes(activeTab) && hasHistoryScope;
  const historyRange = activeTab === "review"
    ? { from: dateDaysAgo(120), to: cairoTodayKey() }
    : fullFinancial && showFullHistory && activeTab === "history"
      ? null
      : currentCycle;
  const { data: deliveries = [] } = useQuery({
    queryKey: ["shift-deliveries", activeTab, historyRange?.from || "all", historyRange?.to || "all", scopedBranches.join("|")],
    queryFn: async () => {
      const PAGE = 500;
      const loadBranch = async (branch) => {
        let rows = []; let page = 0;
        while (true) {
          const query = {
            ...(historyRange ? { shift_date: { $gte: historyRange.from, $lte: historyRange.to } } : {}),
            ...(branch ? { branch } : {}),
          };
          const batch = Object.keys(query).length
            ? await base44.entities.ShiftDelivery.filter(query, "-shift_date", PAGE, page * PAGE)
            : await base44.entities.ShiftDelivery.list("-shift_date", PAGE, page * PAGE);
          rows = [...rows, ...batch];
          if (batch.length < PAGE) break;
          page++;
        }
        return rows;
      };
      if (fullFinancial) return loadBranch(null);
      const groups = await Promise.all(scopedBranches.map(loadBranch));
      return groups.flat();
    },
    enabled: needsHistoryData,
    staleTime: 120000,
  });

  const { data: rawActiveDrafts = [] } = useQuery({
    queryKey: ["shift-drafts-active", scopedBranches.join("|")],
    queryFn: async () => {
      if (fullFinancial) return base44.entities.ShiftDraft.filter({ status: { $in: ["draft", "submitting"] } }, "-last_saved_at", 500);
      const groups = await Promise.all(scopedBranches.map((branch) => base44.entities.ShiftDraft.filter({ branch, status: { $in: ["draft", "submitting"] } }, "-last_saved_at", 500)));
      return groups.flat();
    },
    enabled: activeTab === "review" && canReviewOperationally && hasHistoryScope,
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const activeDrafts = rawActiveDrafts.filter((d) => {
    const hasSales = Number(d.total_sales || 0) > 0;
    const hasPaymentDetails = Number(d.visa_sales || 0) > 0 || Number(d.insta_sales || 0) > 0 || Number(d.vodafone_sales || 0) > 0 || Number(d.other_sales || 0) > 0;
    const hasExpenses = Array.isArray(d.expenses) && d.expenses.some((e) => Number(e?.amount || 0) > 0 || String(e?.category || "").trim() || String(e?.description || "").trim());
    const hasNotes = String(d.notes || "").trim().length > 0;
    const hasFailure = Boolean(d.last_error) || d.status === "submitting";
    return hasSales || hasPaymentDetails || hasExpenses || hasNotes || hasFailure;
  });

  const activeDeliveries = deliveries.filter((d) => d.is_archived !== true);
  const duplicateCount = (() => {
    const groups = new Map();
    activeDeliveries.filter((d) => d.shift_date).forEach((d) => {
      const key = `${d.branch || ""}|${d.shift_date || ""}|${d.shift_type || ""}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return Array.from(groups.values()).filter((count) => count > 1).length;
  })();

  const tabs = [
    { key: "new", label: "تسليم جديد", icon: PlusCircle },
    ...(hasHistoryScope ? [{ key: "history", label: "سجل الشيفتات", icon: List }] : []),
    ...(canReviewOperationally && hasHistoryScope ? [{ key: "review", label: "مراجعة", icon: AlertTriangle, count: duplicateCount + activeDrafts.length }] : []),
    ...(fullFinancial ? [{ key: "reports", label: "تقارير وتحليلات", icon: BarChart3 }] : []),
    ...(isAdmin ? [{ key: "items", label: "إعدادات", icon: Settings2 }] : []),
  ];

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="px-3 md:px-6 pt-3 md:pt-4 border-b flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { if (tab.key === "new") setSelectedDraft(null); setActiveTab(tab.key); }}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">{tab.count.toLocaleString("ar-EG")}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-4">
        {!hasHistoryScope && !fullFinancial && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            يمكنك تسجيل تسليم جديد، لكن عرض سجل التسليمات متوقف حتى يحدد المدير فرع الحساب من «المستخدمين والصلاحيات». لن يعرض النظام كل الفروع تلقائيًا عند غياب نطاق واضح.
          </div>
        )}
        {activeTab === "new" && <ShiftDeliveryForm initialDraft={selectedDraft} onSaved={() => { setSelectedDraft(null); hasHistoryScope && setActiveTab("history"); }} />}
        {activeTab === "history" && hasHistoryScope && (
          <>
            {fullFinancial && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setShowFullHistory((v) => !v)} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  {showFullHistory ? "العودة للدورة الحالية 26→25" : "تحميل كل سجل الشيفتات"}
                </button>
              </div>
            )}
            <ShiftDeliveryHistory deliveries={deliveries} allowedBranches={scopedBranches} onNewShift={() => setActiveTab("new")} />
          </>
        )}
        {activeTab === "review" && canReviewOperationally && hasHistoryScope && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border bg-white p-2 w-fit">
              <button type="button" onClick={() => setReviewMode("duplicates")} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition-colors", reviewMode === "duplicates" ? "bg-amber-100 text-amber-800" : "text-gray-500 hover:bg-gray-50")}>
                التكرارات {duplicateCount > 0 ? `(${duplicateCount.toLocaleString("ar-EG")})` : ""}
              </button>
              <button type="button" onClick={() => setReviewMode("recovery")} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition-colors", reviewMode === "recovery" ? "bg-indigo-100 text-indigo-800" : "text-gray-500 hover:bg-gray-50")}>
                الاستعادة {activeDrafts.length > 0 ? `(${activeDrafts.length.toLocaleString("ar-EG")})` : ""}
              </button>
            </div>
            {reviewMode === "duplicates" && <ShiftDeliveryHistory deliveries={deliveries} allowedBranches={scopedBranches} onNewShift={() => setActiveTab("new")} duplicateOnly />}
            <Suspense fallback={<div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">جاري التحميل...</div>}>
              {reviewMode === "recovery" && <ShiftRecoveryQueue drafts={activeDrafts} onResume={(draft) => { setSelectedDraft(draft); setActiveTab("new"); }} />}
            </Suspense>
          </div>
        )}
        {activeTab === "reports" && fullFinancial && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border bg-white p-2 w-fit">
              <button type="button" onClick={() => setReportMode("stats")} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition-colors", reportMode === "stats" ? "bg-indigo-100 text-indigo-800" : "text-gray-500 hover:bg-gray-50")}>
                ملخص وتحليلات
              </button>
              <button type="button" onClick={() => setReportMode("report")} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition-colors", reportMode === "report" ? "bg-indigo-100 text-indigo-800" : "text-gray-500 hover:bg-gray-50")}>
                المصروفات والتصدير
              </button>
            </div>
            <Suspense fallback={<div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">جاري تحميل التقرير...</div>}>
              {reportMode === "stats" && <ShiftOperationsAnalytics deliveries={activeDeliveries} />}
              {reportMode === "report" && <ShiftDeliveryReport deliveries={activeDeliveries} />}
            </Suspense>
          </div>
        )}
        <Suspense fallback={<div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">جاري تحميل الإعدادات...</div>}>
          {activeTab === "items" && isAdmin && <ExpenseItemsTab />}
        </Suspense>
      </div>
    </div>
  );
}