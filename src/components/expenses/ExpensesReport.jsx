import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899"];

const CATEGORY_LABELS = {
  "إيجار": "إيجار",
  "كهرباء": "كهرباء",
  "مياه": "مياه",
  "رواتب": "رواتب",
  "صيانة": "صيانة",
  "نت": "نت",
  "نثريات": "نثريات",
  "نظافة": "نظافة",
  "أخرى": "أخرى",
};

export default function ExpensesReport({ expenses }) {
  const categoryData = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const cat = e.category || "أخرى";
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: CATEGORY_LABELS[name] || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const branchData = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const branch = e.branch || "غير محدد";
      map[branch] = (map[branch] || 0) + (e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  if (expenses.length === 0) {
    return <div className="text-center py-16 text-gray-400">لا توجد بيانات للعرض</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-teal-50 border-teal-200">
          <p className="text-xs text-teal-600">إجمالي المصروفات</p>
          <p className="text-xl font-bold text-teal-800">{total.toLocaleString("ar-EG")} ج</p>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600">عدد السجلات</p>
          <p className="text-xl font-bold text-blue-800">{expenses.length}</p>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-200">
          <p className="text-xs text-purple-600">أكبر فئة</p>
          <p className="text-lg font-bold text-purple-800">{categoryData[0]?.name || "—"}</p>
        </Card>
        <Card className="p-4 bg-orange-50 border-orange-200">
          <p className="text-xs text-orange-600">قيمة أكبر فئة</p>
          <p className="text-xl font-bold text-orange-800">{(categoryData[0]?.value || 0).toLocaleString("ar-EG")} ج</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar Chart - by category */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">المصروفات حسب النوع</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryData} layout="vertical" margin={{ right: 20, left: 10 }}>
              <XAxis type="number" tickFormatter={(v) => v.toLocaleString("ar-EG")} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => `${v.toLocaleString("ar-EG")} ج`} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart - by branch */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">توزيع المصروفات على الفروع</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={branchData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {branchData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v.toLocaleString("ar-EG")} ج`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Category breakdown table */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">تفاصيل المصروفات حسب النوع</h3>
        <div className="space-y-2">
          {categoryData.map((cat, i) => {
            const pct = total > 0 ? (cat.value / total) * 100 : 0;
            return (
              <div key={cat.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{cat.name}</span>
                  <span className="font-bold text-gray-800">{cat.value.toLocaleString("ar-EG")} ج <span className="text-xs text-gray-400">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}