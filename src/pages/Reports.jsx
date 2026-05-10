import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];
const BRANCH_COLORS = { "فرع زكريا": "#3b82f6", "فرع بسيسة": "#a855f7", "فرع المنشية": "#f97316" };
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split("-");
  return `${MONTHS_AR[parseInt(month) - 1]} ${year}`;
}

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: invoices = [] } = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => base44.entities.PurchaseInvoice.list("-created_date") });
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => base44.entities.Expense.list("-created_date") });

  const years = useMemo(() => {
    const all = new Set();
    invoices.forEach((i) => i.created_date && all.add(new Date(i.created_date).getFullYear()));
    expenses.forEach((e) => e.date && all.add(new Date(e.date).getFullYear()));
    if (all.size === 0) all.add(new Date().getFullYear());
    return [...all].sort((a, b) => b - a);
  }, [invoices, expenses]);

  // Monthly data for line chart (all branches combined)
  const monthlyData = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      map[key] = { month: MONTHS_AR[m - 1], invoices: 0, expenses: 0 };
    }
    invoices.forEach((i) => {
      const k = getMonthKey(i.created_date);
      if (k && map[k]) map[k].invoices += i.total_value || 0;
    });
    expenses.forEach((e) => {
      const k = getMonthKey(e.date);
      if (k && map[k]) map[k].expenses += e.amount || 0;
    });
    return Object.values(map);
  }, [invoices, expenses, year]);

  // Branch comparison data (bar chart)
  const branchData = useMemo(() => {
    return BRANCHES.map((branch) => {
      const inv = invoices.filter((i) => i.branch === branch && new Date(i.created_date).getFullYear() === year);
      const exp = expenses.filter((e) => e.branch === branch && new Date(e.date).getFullYear() === year);
      return {
        branch: branch.replace("فرع ", ""),
        مشتريات: inv.reduce((s, i) => s + (i.total_value || 0), 0),
        مصروفات: exp.reduce((s, e) => s + (e.amount || 0), 0),
      };
    });
  }, [invoices, expenses, year]);

  // Monthly per branch data
  const branchMonthlyData = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      map[key] = { month: MONTHS_AR[m - 1] };
      BRANCHES.forEach((b) => { map[key][b.replace("فرع ", "")] = 0; });
    }
    invoices.forEach((i) => {
      const k = getMonthKey(i.created_date);
      const bKey = i.branch?.replace("فرع ", "");
      if (k && map[k] && bKey) map[k][bKey] += i.total_value || 0;
    });
    return Object.values(map);
  }, [invoices, year]);

  // Summary cards
  const totalInvoices = invoices.filter((i) => new Date(i.created_date).getFullYear() === year).reduce((s, i) => s + (i.total_value || 0), 0);
  const totalExpenses = expenses.filter((e) => new Date(e.date).getFullYear() === year).reduce((s, e) => s + (e.amount || 0), 0);

  const fmt = (n) => n.toLocaleString("ar-EG");

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">التقارير التفصيلية</h1>
          <p className="text-gray-500 text-sm mt-0.5">مقارنة الفروع والنفقات الشهرية</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المشتريات", value: fmt(totalInvoices) + " ج", color: "text-blue-600", bg: "bg-blue-50" },
          { label: "إجمالي المصروفات", value: fmt(totalExpenses) + " ج", color: "text-red-600", bg: "bg-red-50" },
          { label: "عدد الفواتير", value: invoices.filter((i) => new Date(i.created_date).getFullYear() === year).length, color: "text-teal-600", bg: "bg-teal-50" },
          { label: "عدد المصروفات", value: expenses.filter((e) => new Date(e.date).getFullYear() === year).length, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((s) => (
          <Card key={s.label} className={`p-4 ${s.bg}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-lg font-bold ${s.color} mt-1`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Branch Comparison Bar Chart */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">مقارنة المشتريات والمصروفات بين الفروع - {year}</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={branchData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => v.toLocaleString("ar-EG") + " ج"} />
            <Legend />
            <Bar dataKey="مشتريات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="مصروفات" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly Trend Line Chart */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">تطور المشتريات والمصروفات شهرياً - {year}</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => v.toLocaleString("ar-EG") + " ج"} />
            <Legend />
            <Line type="monotone" dataKey="invoices" name="مشتريات" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="expenses" name="مصروفات" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly per Branch Bar Chart */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">المشتريات الشهرية لكل فرع - {year}</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={branchMonthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => v.toLocaleString("ar-EG") + " ج"} />
            <Legend />
            {BRANCHES.map((b) => (
              <Bar key={b} dataKey={b.replace("فرع ", "")} fill={BRANCH_COLORS[b]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}