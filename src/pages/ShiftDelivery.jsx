import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { PlusCircle, List, BarChart3, PieChart as PieIcon, Settings2, AlertTriangle } from "lucide-react";
import ShiftDeliveryForm from "@/components/shift/ShiftDeliveryForm";
import ShiftDeliveryHistory from "@/components/shift/ShiftDeliveryHistory";
import ShiftDeliveryStats from "@/components/shift/ShiftDeliveryStats";
import ShiftDeliveryReport from "@/components/shift/ShiftDeliveryReport";
import ExpenseItemsTab from "@/components/shift/ExpenseItemsTab";
import { cn } from "@/lib/utils";

export default function ShiftDelivery() {
  const { isAdmin, isManager } = useUserRole();
  const canViewAll = isAdmin || isManager;
  const [activeTab, setActiveTab] = useState("new");

  const { data: deliveries = [] } = useQuery({
    queryKey: ["shift-deliveries"],
    queryFn: async () => {
      const PAGE = 500; let all = []; let page = 0;
      while (true) {
        const batch = await base44.entities.ShiftDelivery.list("-shift_date", PAGE, page * PAGE);
        all = [...all, ...batch];
        if (batch.length < PAGE) break;
        page++;
      }
      return all;
    },
    staleTime: 30000,
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

  const tabs = canViewAll
    ? [
        { key: "new", label: "تسليم جديد", icon: PlusCircle },
        { key: "history", label: "التسليمات", icon: List },
        { key: "duplicates", label: "تنبيهات التكرار", icon: AlertTriangle, count: duplicateCount },
        { key: "stats", label: "الإحصائيات والفروع", icon: BarChart3 },
        { key: "report", label: "تحليل المصروفات", icon: PieIcon },
        { key: "items", label: "بنود المصروفات", icon: Settings2 },
      ]
    : [{ key: "new", label: "تسليم جديد", icon: PlusCircle }];

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="px-3 md:px-6 pt-3 md:pt-4 border-b flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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
        {activeTab === "new" && <ShiftDeliveryForm onSaved={() => canViewAll && setActiveTab("history")} />}
        {activeTab === "history" && canViewAll && (
          <ShiftDeliveryHistory deliveries={deliveries} onNewShift={() => setActiveTab("new")} />
        )}
        {activeTab === "duplicates" && canViewAll && (
          <ShiftDeliveryHistory deliveries={deliveries} onNewShift={() => setActiveTab("new")} duplicateOnly />
        )}
        {activeTab === "stats" && canViewAll && <ShiftDeliveryStats deliveries={activeDeliveries} />}
        {activeTab === "report" && canViewAll && <ShiftDeliveryReport deliveries={activeDeliveries} />}
        {activeTab === "items" && canViewAll && <ExpenseItemsTab />}
      </div>
    </div>
  );
}