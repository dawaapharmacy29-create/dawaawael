import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function OrderAnalytics({ orders }) {
  const productStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const name = o.product_name || "غير محدد";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  }, [orders]);

  const customerStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const name = o.customer_name || "غير محدد";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [orders]);

  const branchStats = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const b = o.branch || "غير محدد";
      map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most requested products */}
        <div className="bg-white rounded-xl border p-4">
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
        </div>

        {/* Most active customers */}
        <div className="bg-white rounded-xl border p-4">
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
        </div>
      </div>

      {/* Branch chart */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4">الطلبات حسب الفرع</h3>
        {branchStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={branchStats} barSize={40}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="عدد الطلبات" radius={[4, 4, 0, 0]}>
                {branchStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}