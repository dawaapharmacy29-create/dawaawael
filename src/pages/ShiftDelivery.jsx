import { lazy, Suspense, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { PlusCircle, List, BarChart3, PieChart, Settings2 } from "lucide-react";
import ShiftDeliveryForm from "@/components/shift/ShiftDeliveryForm";
const ShiftDeliveryHistory = lazy(() => import("@/components/shift/ShiftDeliveryHistory"));
const ShiftOperationsAnalytics = lazy(() => import("@/components/shift/ShiftOperationsAnalytics"));
const ShiftDeliveryReport = lazy(() => import("@/components/shift/ShiftDeliveryReport"));
const ExpenseItemsTab = lazy(() => import("@/components/shift/ExpenseItemsTab"));
const ShiftRecoveryQueue = lazy(() => import("@/components/shift/ShiftRecoveryQueue"));

async function loadAll(entity, query = {}) {
  const rows = [];
  for (let skip = 0; ; skip += 500) {
    const batch = await entity.filter(query, "id", 500, skip);
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

export default function ShiftDelivery() {
  const { accountantMode = false } = useOutletContext() || {};
  const { isAdmin, isManager, branchAccess, financialAccessLevel } = useUserRole();
  const fullFinancial = financialAccessLevel === "full";
  const scopedBranches = fullFinancial ? ["دواء شكري", "دواء الشامي"] : [...new Set(branchAccess)];
  const hasHistoryScope = scopedBranches.length > 0;
  const [selectedTab, setActiveTab] = useState("new");
  const activeTab = accountantMode && !["history", "stats", "expenses"].includes(selectedTab) ? "history" : selectedTab;
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const scopeKey = scopedBranches.join("|");
  const history = useQuery({
    queryKey: ["shift-deliveries", "all-history", fullFinancial, scopeKey],
    queryFn: async () => fullFinancial
      ? loadAll(base44.entities.ShiftDelivery)
      : (await Promise.all(scopedBranches.map(branch => loadAll(base44.entities.ShiftDelivery, { branch })))).flat(),
    enabled: hasHistoryScope && ["history", "stats", "expenses"].includes(activeTab),
    staleTime: 30000,
  });
  const drafts = useQuery({
    queryKey: ["shift-drafts-active", fullFinancial, scopeKey],
    queryFn: async () => {
      const query = { status: { $in: ["draft", "submitting"] } };
      return fullFinancial ? loadAll(base44.entities.ShiftDraft, query)
        : (await Promise.all(scopedBranches.map(branch => loadAll(base44.entities.ShiftDraft, { ...query, branch })))).flat();
    },
    enabled: !accountantMode && activeTab === "history" && isManager && hasHistoryScope,
    staleTime: 15000,
  });
  const deliveries = history.data || [];
  const tabs = [
    ...(!accountantMode ? [{ key: "new", label: "تسليم جديد", icon: PlusCircle }] : []),
    ...(hasHistoryScope ? [{ key: "history", label: "التسليمات", icon: List }] : []),
    ...(fullFinancial ? [
      { key: "stats", label: "الإحصائيات والفروع", icon: BarChart3 },
      { key: "expenses", label: "تحليل المصروفات", icon: PieChart },
    ] : []),
    ...(!accountantMode && isAdmin ? [{ key: "items", label: "بنود المصروفات", icon: Settings2 }] : []),
  ];
  const fallback = <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">جاري التحميل...</div>;
  return <div className="w-full" dir="rtl">
    <div className="px-3 md:px-6 pt-3 md:pt-4 border-b flex overflow-x-auto scrollbar-hide gap-1 pb-0">
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActiveTab(key)}
        className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
        <Icon className="w-4 h-4" />{label}
      </button>)}
    </div>
    <div className="p-3 md:p-6 space-y-4">
      {!hasHistoryScope && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">عرض التسليمات يحتاج تحديد فرع الحساب من المستخدمين والصلاحيات.</p>}
      {!accountantMode && <div hidden={activeTab !== "new"}>
        <ShiftDeliveryForm key={formKey} initialDraft={selectedDraft} active={activeTab === "new"} onSaved={() => {
          setSelectedDraft(null); setFormKey(k => k + 1);
          if (hasHistoryScope) setActiveTab("history");
        }} />
      </div>}
      {["history", "stats", "expenses"].includes(activeTab) && history.isPending && fallback}
      {["history", "stats", "expenses"].includes(activeTab) && history.isError &&
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">تعذر تحميل التسليمات. <button onClick={() => history.refetch()} className="underline">إعادة المحاولة</button></div>}
      <Suspense fallback={fallback}>
        {activeTab === "history" && hasHistoryScope && history.isSuccess && <>
          <ShiftDeliveryHistory deliveries={deliveries} allowedBranches={scopedBranches} fullFinancial={fullFinancial} onNewShift={accountantMode ? undefined : () => setActiveTab("new")} />
          {!accountantMode && isManager && <details className="rounded-xl border bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold text-blue-700">مسودات التسليم غير المكتملة ({(drafts.data || []).length})</summary>
            <div className="pt-4">
              {drafts.isPending ? fallback : drafts.isError ? <button onClick={() => drafts.refetch()} className="text-red-700">تعذر تحميل المسودات — إعادة المحاولة</button> :
                <ShiftRecoveryQueue drafts={drafts.data || []} onResume={draft => {
                  setSelectedDraft(draft); setFormKey(k => k + 1); setActiveTab("new");
                }} />}
            </div>
          </details>}
        </>}
        {activeTab === "stats" && fullFinancial && history.isSuccess && <ShiftOperationsAnalytics deliveries={deliveries} />}
        {activeTab === "expenses" && fullFinancial && history.isSuccess && <ShiftDeliveryReport deliveries={deliveries} />}
        {activeTab === "items" && isAdmin && <ExpenseItemsTab />}
      </Suspense>
    </div>
  </div>;
}
