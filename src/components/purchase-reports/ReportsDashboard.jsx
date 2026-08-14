import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { BarChart3, PieChart as PieIcon } from "lucide-react";

const BRANCH_COLORS = { "دواء شكري": "#3b82f6", "دواء الشامي": "#a855f7" };
const PIE_COLORS = ["#3b82f6", "#a855f7", "#f97316", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#14b8a6", "#8b5cf6"];

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

export default function ReportsDashboard({ branchTotals, supplierTotals }) {
  const branchChart = branchTotals.map((b) => ({ name: b.branch, value: b.total }));
  const supplierChart = supplierTotals.slice(0, 8).map((s, i) => ({ name: s.name, value: s.total, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Branch comparison */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">مقارنة مشتريات الفروع</h2>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={branchChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => fmt(v) + " ج.م"} />
            <Bar dataKey="value" name="مشتريات" radius={[4, 4, 0, 0]}>
              {branchChart.map((entry, idx) => (
                <Cell key={idx} fill={Object.values(BRANCH_COLORS)[idx]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Supplier distribution */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <PieIcon className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-semibold text-gray-700">توزيع المشتريات حسب الموردين</h2>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={supplierChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name.slice(0, 10)}`}>
              {supplierChart.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => fmt(v) + " ج.م"} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
