import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";

const BRANCHES = ["دواء شكري", "دواء الشامي"];

export default function BranchItemWeeklySales() {
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);

  const { data: items = [] } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["medicine-sales"],
    queryFn: () => base44.entities.MedicineSale.list("-week_start", 500),
    staleTime: 15000,
  });

  const activeItems = items.filter((i) => i.is_active !== false);

  const { weeks, matrix } = useMemo(() => {
    const branchRecords = sales
      .filter((s) => s.branch === selectedBranch && s.week_label && (!s.record_type || s.record_type === "sales"))
      .sort((a, b) => new Date(a.week_start || a.created_date) - new Date(b.week_start || b.created_date));

    const weekLabels = [...new Set(branchRecords.map((s) => s.week_label))];

    // matrix[itemId][weekLabel] = quantity
    const m = {};
    activeItems.forEach((item) => { m[item.id] = {}; });
    branchRecords.forEach((rec) => {
      (rec.sales || []).forEach((sale) => {
        const itemId = sale.medicine_id;
        if (m[itemId]) {
          m[itemId][rec.week_label] = (m[itemId][rec.week_label] || 0) + (Number(sale.quantity) || 0);
        }
      });
    });

    return { weeks: weekLabels, matrix: m };
  }, [sales, selectedBranch, activeItems]);

  const totals = useMemo(() => {
    const t = {};
    weeks.forEach((w) => { t[w] = 0; });
    activeItems.forEach((item) => {
      weeks.forEach((w) => { t[w] += matrix[item.id]?.[w] || 0; });
    });
    return t;
  }, [weeks, matrix, activeItems]);

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-gray-700 mb-3">مبيعات الأصناف أسبوعياً حسب الفرع</h2>

      {/* Branch selector buttons */}
      <div className="flex gap-2 flex-wrap mb-4">
        {BRANCHES.map((b) => (
          <button
            key={b}
            onClick={() => setSelectedBranch(b)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedBranch === b
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-gray-400">جاري التحميل...</Card>
      ) : weeks.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">لا توجد سجلات مبيعات لهذا الفرع</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" dir="rtl">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-right px-3 py-2 text-gray-600 font-semibold sticky right-0 bg-gray-50">
                    الصنف
                  </th>
                  {weeks.map((w, idx) => (
                    <th key={w} className={`text-center px-3 py-2 font-semibold whitespace-nowrap min-w-[90px] ${idx % 2 === 0 ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                      {w}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 text-teal-700 font-bold bg-teal-50">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item, idx) => {
                  const rowTotal = weeks.reduce((s, w) => s + (matrix[item.id]?.[w] || 0), 0);
                  return (
                    <tr key={item.id} className={`border-b last:border-0 hover:bg-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-3 py-1.5 font-medium text-gray-700 sticky right-0 bg-inherit">
                        {item.name}
                      </td>
                      {weeks.map((w, wi) => {
                        const val = matrix[item.id]?.[w];
                        return (
                          <td key={w} className={`px-3 py-1.5 text-center ${wi % 2 === 0 ? "bg-blue-50/40 text-gray-700" : "bg-purple-50/40 text-gray-700"}`}>
                            {val ? <span className="font-bold">{val.toLocaleString("ar-EG")}</span> : <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-center font-bold text-teal-700 bg-teal-50/50">
                        {rowTotal.toLocaleString("ar-EG")}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-teal-100 border-t-2 border-teal-300 font-bold">
                  <td className="px-3 py-2 text-gray-700 sticky right-0 bg-teal-100">إجمالي الأسبوع</td>
                  {weeks.map((w, wi) => (
                    <td key={w} className={`px-3 py-2 text-center font-bold ${wi % 2 === 0 ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
                      {(totals[w] || 0).toLocaleString("ar-EG")}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center text-teal-900 bg-teal-200">
                    {grandTotal.toLocaleString("ar-EG")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
