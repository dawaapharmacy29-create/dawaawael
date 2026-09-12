import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Eye, Plus, LayoutGrid, Table2, CalendarCheck, Clock, RotateCcw } from "lucide-react";
import ShiftDeliveryDetail from "./ShiftDeliveryDetail";
import ShiftDeliveryEditDialog from "./ShiftDeliveryEditDialog";
import { useUserRole } from "@/lib/useUserRole";
import DateRangeFilter from "./DateRangeFilter";
import ArchiveDialog from "@/components/common/ArchiveDialog";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortControls } from "@/components/table/SortControls";
import { SHIFT_TYPE_ORDER } from "@/lib/sortUtils";

const SHIFT_SORT_COLUMNS = [
  { field: "shift_type", label: "نوع الشفت", type: "status", statusMap: SHIFT_TYPE_ORDER },
  { field: "submitted_by", label: "الموظف", type: "text" },
  { field: "total_sales", label: "المبيعات", type: "number" },
  { field: "total_expenses", label: "المصروفات", type: "number" },
  { field: "net_amount", label: "الصافي", type: "number" },
];

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const BRANCH_COLORS = {
  "دواء شكري": { dot: "bg-teal-500", text: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200", accent: "border-r-teal-400" },
  "دواء الشامي": { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", accent: "border-r-orange-400" },
};
const SHIFT_BADGE = {
  "صباحي": "bg-amber-100 text-amber-700",
  "مسائي": "bg-blue-100 text-blue-700",
  "ليلي": "bg-indigo-100 text-indigo-700",
};
const SHIFT_ORDER = { "صباحي": 0, "مسائي": 1, "ليلي": 2 };

const ACCENTS = {
  today: { bg: "bg-green-100", text: "text-green-600", gradient: "from-green-50 to-white", border: "border-green-100" },
  yesterday: { bg: "bg-amber-100", text: "text-amber-600", gradient: "from-amber-50 to-white", border: "border-amber-100" },
  older: { bg: "bg-blue-100", text: "text-blue-600", gradient: "from-blue-50 to-white", border: "border-blue-100" },
};

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

function dateLabel(dateStr) {
  if (!dateStr || dateStr === "—") return "تسليمات بدون تاريخ";
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return "تسليمات اليوم";
  if (d.getTime() === yesterday.getTime()) return "تسليمات الأمس";
  const dayName = d.toLocaleDateString("ar-EG", { weekday: "long" });
  return `تسليمات ${dayName}`;
}

function dateVariant(dateStr) {
  if (!dateStr || dateStr === "—") return "older";
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === yesterday.getTime()) return "yesterday";
  return "older";
}

/**
 * كارت يوم واحد (شكل ومنطق مطابق لصفحة تسليم الشيفت في DawaaBills):
 * هيدر ملخّص باللون المناسب لليوم + بطاقة منفصلة لكل فرع بداخلها التسليمات.
 */
function DayCard({ dateStr, records, isAdmin, onView, onEdit, onDelete, onRestore }) {
  const accent = ACCENTS[dateVariant(dateStr)];
  const totalSales = records.reduce((s, r) => s + (r.total_sales || 0), 0);
  const totalExpenses = records.reduce((s, r) => s + (r.total_expenses || 0), 0);
  const netAmount = records.reduce((s, r) => s + (r.net_amount || 0), 0);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${accent.bg} flex items-center justify-center`}>
          <CalendarCheck className={`w-4 h-4 ${accent.text}`} />
        </div>
        <h3 className="text-sm font-bold text-gray-800">{dateLabel(dateStr)}</h3>
        <span className="text-xs text-gray-400">({dateStr})</span>
        <span className="text-xs text-gray-400">({records.length} تسليم)</span>
      </div>

      <div className={`bg-gradient-to-l ${accent.gradient} rounded-xl border ${accent.border} p-3 mb-3 grid grid-cols-3 gap-2 text-center`}>
        <div>
          <p className="text-[10px] text-gray-500">إجمالي المبيعات</p>
          <p className="text-sm font-bold text-blue-600">{fmt(totalSales)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">إجمالي المصروفات</p>
          <p className="text-sm font-bold text-red-600">{fmt(totalExpenses)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">الصافي</p>
          <p className="text-sm font-bold text-green-600">{fmt(netAmount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BRANCHES.map((branch) => {
          const branchRecords = records
            .filter((r) => r.branch === branch)
            .sort((a, b) => (SHIFT_ORDER[a.shift_type] ?? 99) - (SHIFT_ORDER[b.shift_type] ?? 99));
          const colors = BRANCH_COLORS[branch];
          if (branchRecords.length === 0) {
            return (
              <div key={branch} className={`rounded-xl border-2 border-dashed ${colors.border} p-4 text-center`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>{branch}</span>
                </div>
                <p className="text-xs text-gray-400">لا توجد تسليمات</p>
              </div>
            );
          }
          const bNet = branchRecords.reduce((s, r) => s + (r.net_amount || 0), 0);
          const bSales = branchRecords.reduce((s, r) => s + (r.total_sales || 0), 0);
          return (
            <div key={branch} className={`bg-white rounded-xl border border-r-4 ${colors.accent} overflow-hidden`}>
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                  <span className="text-sm font-bold text-gray-700">{branch}</span>
                </div>
                <span className="text-xs text-gray-400">{branchRecords.length} تسليم</span>
              </div>
              <div className="divide-y">
                {branchRecords.map((r) => (
                  <div key={r.id} className="px-3 py-2 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SHIFT_BADGE[r.shift_type] || "bg-gray-100"}`}>{r.shift_type}</span>
                        <span className="text-xs font-medium text-gray-700">{r.submitted_by || "—"}</span>
                        {r.recorded_at && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400" title="وقت التسليم">
                            <Clock className="w-3 h-3" />
                            {r.recorded_at.slice(11, 16)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => onView(r)} className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100">
                          <Eye className="w-3 h-3" />
                        </button>
                        {isAdmin && r.is_archived !== true && (
                          <>
                            <button onClick={() => onEdit(r)} className="w-6 h-6 flex items-center justify-center rounded text-indigo-600 hover:bg-indigo-50">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDelete(r)} className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:bg-red-50" title="أرشفة">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {isAdmin && r.is_archived === true && (
                          <button onClick={() => onRestore(r)} className="w-6 h-6 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50" title="استعادة من الأرشيف">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end text-xs gap-2">
                      <span className="text-gray-500">مبيعات: <span className="font-medium">{fmt(r.total_sales)}</span></span>
                      <span className="text-green-600 font-bold">صافي: {fmt(r.net_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-1.5 bg-gray-50 border-t flex justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">إجمالي المبيعات</span>
                  <span className="font-bold text-blue-600">{fmt(bSales)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">صافي الفرع</span>
                  <span className="font-bold text-green-600">{fmt(bNet)} ج.م</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ShiftDeliveryHistory({ deliveries, onNewShift }) {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // cards | table
  const [showArchived, setShowArchived] = useState(false);
  const [archiveItem, setArchiveItem] = useState(null);

  const dateFilteredRaw = useMemo(() => {
    return (deliveries || []).filter((d) => {
      if (showArchived ? d.is_archived !== true : d.is_archived === true) return false;
      if (!d.shift_date) return false;
      if (fromDate && d.shift_date < fromDate) return false;
      if (toDate && d.shift_date > toDate) return false;
      return true;
    });
  }, [deliveries, fromDate, toDate, showArchived]);

  const { sortField, sortDirection, toggleSort, setSort, resetSort, sortData } = useTableSorting({
    columns: SHIFT_SORT_COLUMNS,
    defaultSort: { field: "shift_type", direction: "asc" },
    paramPrefix: "shift",
  });
  const dateFiltered = useMemo(() => sortData(dateFilteredRaw), [dateFilteredRaw, sortData]);

  const restoreMutation = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke("updateShiftDeliveryAdmin", { id, action: "restore_archive" });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر استعادة التسليم");
      return result.record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-deliveries"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, reason, note }) => {
      const res = await base44.functions.invoke("updateShiftDeliveryAdmin", {
        id,
        action: "archive",
        archive_reason: reason || "أرشفة تسليم شيفت",
        archive_note: note || "",
      });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر أرشفة التسليم");
      return result.record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-deliveries"] }),
  });

  // تجميع بالتاريخ (الأحدث أولاً)
  const grouped = useMemo(() => {
    const map = {};
    for (const d of dateFiltered) {
      const key = d.shift_date || "—";
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [dateFiltered]);

  // جدول تجميعي بالأيام: إجمالي كل فرع يومياً
  const dailyBranchTotals = useMemo(() => {
    const map = new Map();
    dateFiltered.forEach((r) => {
      const d = r.shift_date;
      if (!d) return;
      if (!map.has(d)) map.set(d, { "دواء شكري": 0, "دواء الشامي": 0 });
      const entry = map.get(d);
      entry[r.branch] = (entry[r.branch] || 0) + (r.total_sales || 0);
    });
    return Array.from(map.entries())
      .map(([dateStr, totals]) => ({
        dateStr,
        dayName: new Date(dateStr).toLocaleDateString("ar-EG", { weekday: "long" }),
        totals,
        grandTotal: BRANCHES.reduce((s, b) => s + (totals[b] || 0), 0),
      }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [dateFiltered]);

  const branchAverages = useMemo(() => {
    const avgs = {};
    BRANCHES.forEach((b) => {
      const values = dailyBranchTotals.map((row) => row.totals[b] || 0);
      avgs[b] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    });
    const grandValues = dailyBranchTotals.map((row) => row.grandTotal);
    avgs.grandTotal = grandValues.length > 0 ? grandValues.reduce((s, v) => s + v, 0) / grandValues.length : 0;
    return avgs;
  }, [dailyBranchTotals]);

  const columnGrandTotals = useMemo(() => {
    const totals = { "دواء شكري": 0, "دواء الشامي": 0 };
    let grand = 0;
    dailyBranchTotals.forEach((row) => {
      BRANCHES.forEach((b) => { totals[b] += row.totals[b] || 0; });
      grand += row.grandTotal || 0;
    });
    return { totals, grand };
  }, [dailyBranchTotals]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800">التسليمات</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> تفصيلي
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}
            >
              <Table2 className="w-3.5 h-3.5" /> جدول يومي
            </button>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)} className={showArchived ? "border-amber-300 bg-amber-50 text-amber-700" : ""}>
              {showArchived ? "عرض التسليمات الحالية" : "عرض الأرشيف"}
            </Button>
          )}
          <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToDateChange={setToDate} />
          <SortControls
            columns={SHIFT_SORT_COLUMNS}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggle={toggleSort}
            onSet={setSort}
            onReset={resetSort}
            cardMode
          />
          <Button onClick={onNewShift} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> تسليم جديد
          </Button>
        </div>
      </div>

      {dateFiltered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">لا توجد تسليمات بعد</p>
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-l from-indigo-50 via-teal-50 to-emerald-50 border-b border-gray-100">
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600">اليوم</th>
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600">التاريخ</th>
                  {BRANCHES.map((b) => (
                    <th key={b} className="px-4 py-3.5 text-left">
                      <span className="flex items-center gap-1.5 justify-end">
                        <span className={`w-2 h-2 rounded-full ${BRANCH_COLORS[b].dot}`} />
                        <span className="font-bold text-gray-700">{b}</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 font-normal mt-0.5">متوسط {Math.round(branchAverages[b] || 0).toLocaleString("ar-EG")}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-left bg-teal-50/60">
                    <span className="font-extrabold text-teal-800">الإجمالي</span>
                    <span className="block text-[10px] text-teal-500 font-normal mt-0.5">متوسط {Math.round(branchAverages.grandTotal || 0).toLocaleString("ar-EG")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dailyBranchTotals.map((row, i) => (
                  <tr key={row.dateStr} className={`hover:bg-gray-50/80 transition-colors ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.dayName}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{row.dateStr}</td>
                    {BRANCHES.map((b) => {
                      const value = row.totals[b] || 0;
                      const isAbove = value >= (branchAverages[b] || 0);
                      return (
                        <td key={b} className="px-4 py-3 text-left">
                          <span className={`font-bold ${isAbove ? "text-emerald-600" : "text-red-500"}`}>{value.toLocaleString("ar-EG")}</span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-left bg-teal-50/30">
                      <span className={`font-extrabold text-base ${row.grandTotal >= (branchAverages.grandTotal || 0) ? "text-emerald-700" : "text-red-600"}`}>
                        {row.grandTotal.toLocaleString("ar-EG")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-l from-indigo-100 via-teal-100 to-emerald-100 border-t-2 border-teal-200">
                  <td colSpan={2} className="px-4 py-3.5 font-extrabold text-gray-700">إجمالي الفترة</td>
                  {BRANCHES.map((b) => (
                    <td key={b} className="px-4 py-3.5 text-left font-extrabold text-gray-800">
                      {columnGrandTotals.totals[b].toLocaleString("ar-EG")}
                    </td>
                  ))}
                  <td className="px-4 py-3.5 text-left bg-teal-100/70">
                    <span className="font-extrabold text-base text-teal-900">{columnGrandTotals.grand.toLocaleString("ar-EG")}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50/60 border-t border-gray-100 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> أعلى من متوسط الفترة</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> أقل من متوسط الفترة</span>
          </div>
        </div>
      ) : (
        grouped.map(([dateStr, items]) => (
          <DayCard
            key={dateStr}
            dateStr={dateStr}
            records={items}
            isAdmin={isAdmin}
            onView={setDetailItem}
            onEdit={setEditItem}
            onDelete={setArchiveItem}
            onRestore={(item) => restoreMutation.mutate(item.id)}
          />
        ))
      )}

      <ArchiveDialog
        open={!!archiveItem}
        onOpenChange={(open) => !open && setArchiveItem(null)}
        title="أرشفة تسليم الشيفت"
        description="سيتم استبعاد التسليم من الحسابات والتقارير العادية مع الاحتفاظ به كاملًا في الأرشيف."
        defaultReason="أرشفة تسليم شيفت"
        isLoading={deleteMutation.isPending}
        onConfirm={async ({ reason, note }) => {
          await deleteMutation.mutateAsync({ id: archiveItem.id, reason, note });
          setArchiveItem(null);
        }}
      />

      {detailItem && <ShiftDeliveryDetail item={detailItem} onClose={() => setDetailItem(null)} />}
      {editItem && <ShiftDeliveryEditDialog item={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}