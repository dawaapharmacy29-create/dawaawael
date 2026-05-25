import { useMemo } from "react";
import { Card } from "@/components/ui/card";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const STATUSES = ["طلب جديد", "جاري البحث", "النواقص", "تم توفير الصنف", "تم التوصيل", "الصنف غير متوفر حاليا", "تم الإلغاء"];

const STATUS_COLORS = {
  "طلب جديد": "bg-blue-100 text-blue-700",
  "جاري البحث": "bg-yellow-100 text-yellow-700",
  "النواقص": "bg-purple-100 text-purple-700",
  "تم توفير الصنف": "bg-teal-100 text-teal-700",
  "تم التوصيل": "bg-green-100 text-green-700",
  "الصنف غير متوفر حاليا": "bg-orange-100 text-orange-700",
  "تم الإلغاء": "bg-red-100 text-red-700",
};

export default function OrderAnalytics({ orders }) {
  // جدول: لكل فرع عدد الطلبات حسب كل حالة
  const branchStatusTable = useMemo(() => {
    const table = {};
    BRANCHES.forEach((b) => {
      table[b] = {};
      STATUSES.forEach((s) => { table[b][s] = 0; });
      table[b]["__total"] = 0;
    });
    orders.forEach((o) => {
      const branch = o.branch || "غير محدد";
      const status = o.status || "طلب جديد";
      if (!table[branch]) {
        table[branch] = {};
        STATUSES.forEach((s) => { table[branch][s] = 0; });
        table[branch]["__total"] = 0;
      }
      if (table[branch][status] !== undefined) table[branch][status]++;
      table[branch]["__total"]++;
    });
    return table;
  }, [orders]);

  // إجماليات لكل حالة
  const statusTotals = useMemo(() => {
    const map = {};
    STATUSES.forEach((s) => { map[s] = 0; });
    orders.forEach((o) => {
      const status = o.status || "طلب جديد";
      if (map[status] !== undefined) map[status]++;
    });
    return map;
  }, [orders]);

  const grandTotal = orders.length;

  // الأصناف الأكثر طلباً
  const productStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const name = o.product_name || "غير محدد";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  }, [orders]);

  // العملاء الأكثر طلباً
  const customerStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const name = o.customer_name || "غير محدد";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [orders]);

  if (orders.length === 0) {
    return <div className="text-center py-16 text-gray-400">لا توجد بيانات للعرض</div>;
  }

  return (
    <div className="space-y-6">

      {/* جدول الفروع × الحالات */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4">إحصائيات الطلبات لكل فرع حسب الحالة</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">الفرع</th>
                {STATUSES.map((s) => (
                  <th key={s} className="px-2 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">{s}</th>
                ))}
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {BRANCHES.map((branch, idx) => (
                <tr key={branch} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap">{branch}</td>
                  {STATUSES.map((s) => {
                    const count = branchStatusTable[branch]?.[s] || 0;
                    return (
                      <td key={s} className="px-2 py-2.5 text-center">
                        {count > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[s]}`}>{count}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center font-bold text-gray-800">
                    {branchStatusTable[branch]?.["__total"] || 0}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 border-t-2 font-bold">
                <td className="px-3 py-2.5 text-gray-700">الإجمالي</td>
                {STATUSES.map((s) => (
                  <td key={s} className="px-2 py-2.5 text-center text-gray-800">
                    {statusTotals[s] > 0 ? statusTotals[s] : "—"}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center text-teal-700">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* الأصناف الأكثر طلباً */}
        <Card className="p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4">الأصناف الأكثر طلبًا</h3>
          {productStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p> : (
            <div className="space-y-2">
              {productStats.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-gray-400 font-mono">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-gray-700 truncate">{p.name}</span>
                      <span className="text-sm font-bold text-teal-700">{p.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${(p.count / productStats[0].count) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* العملاء الأكثر طلباً */}
        <Card className="p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4">العملاء الأكثر طلبًا</h3>
          {customerStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p> : (
            <div className="space-y-2">
              {customerStats.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="text-sm text-gray-700">{c.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{c.count} طلب</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}