import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";
import ExportButtons from "@/components/reports/ExportButtons";
import AgingReport from "@/components/reports/AgingReport";
import TopSuppliers from "@/components/reports/TopSuppliers";
import MonthlyBranchReport from "@/components/reports/MonthlyBranchReport";
import { useUserRole } from "@/lib/useUserRole";
import { Lock, Settings2 } from "lucide-react";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];
const BRANCH_COLORS = { "فرع زكريا": "#3b82f6", "فرع بسيسة": "#a855f7", "فرع المنشية": "#f97316" };
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const SETTING_KEY = "report_year";

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const { isManager } = useUserRole();
  const queryClient = useQueryClient();
  const [savingYear, setSavingYear] = useState(false);
  const [pendingYear, setPendingYear] = useState(null);

  const { data: invoices = [] } = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => base44.entities.PurchaseInvoice.list("-created_date") });
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => base44.entities.Expense.list("-created_date") });
  const { data: settings = [] } = useQuery({ queryKey: ["report-settings"], queryFn: () => base44.entities.ReportSettings.filter({ key: SETTING_KEY }) });

  const years = useMemo(() => {
    const all = new Set();
    invoices.forEach((i) => i.created_date && all.add(new Date(i.created_date).getFullYear()));
    expenses.forEach((e) => e.date && all.add(new Date(e.date).getFullYear()));
    if (all.size === 0) all.add(new Date().getFullYear());
    return [...all].sort((a, b) => b - a);
  }, [invoices, expenses]);

  // The active year: from saved setting or default to current year
  const savedSetting = settings[0];
  const year = savedSetting ? parseInt(savedSetting.value) : (years[0] || new Date().getFullYear());

  // Sync pendingYear when setting loads
  useEffect(() => {
    if (savedSetting && pendingYear === null) setPendingYear(parseInt(savedSetting.value));
    else if (!savedSetting && pendingYear === null) setPendingYear(new Date().getFullYear());
  }, [savedSetting]);

  const saveYear = async () => {
    setSavingYear(true);
    if (savedSetting) {
      await base44.entities.ReportSettings.update(savedSetting.id, { value: String(pendingYear) });
    } else {
      await base44.entities.ReportSettings.create({ key: SETTING_KEY, value: String(pendingYear) });
    }
    queryClient.invalidateQueries({ queryKey: ["report-settings"] });
    setSavingYear(false);
  };

  // Monthly data
  const monthlyData = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      map[key] = { month: MONTHS_AR[m - 1], invoices: 0, expenses: 0 };
    }
    invoices.forEach((i) => { const k = getMonthKey(i.created_date); if (k && map[k]) map[k].invoices += i.total_value || 0; });
    expenses.forEach((e) => { const k = getMonthKey(e.date); if (k && map[k]) map[k].expenses += e.amount || 0; });
    return Object.values(map);
  }, [invoices, expenses, year]);

  // Branch comparison
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

  // Monthly per branch
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
        <div className="flex items-center gap-3 flex-wrap">
          {isManager ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Settings2 className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">تحديد سنة التقارير:</span>
              <select
                value={pendingYear || year}
                onChange={(e) => setPendingYear(parseInt(e.target.value))}
                className="border-0 bg-transparent text-sm text-blue-700 font-semibold focus:outline-none"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              {pendingYear !== year && (
                <Button size="sm" onClick={saveYear} disabled={savingYear} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  {savingYear ? "جاري الحفظ..." : "حفظ"}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">سنة {year}</span>
            </div>
          )}
          <ExportButtons
            invoices={invoices.filter((i) => new Date(i.created_date).getFullYear() === year)}
            expenses={expenses.filter((e) => new Date(e.date).getFullYear() === year)}
            year={year}
            branchData={branchData}
            monthlyData={monthlyData}
          />
        </div>
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

      {/* Monthly Branch Report */}
      <MonthlyBranchReport invoices={invoices} expenses={expenses} />

      {/* Aging Report */}
      <AgingReport invoices={invoices} />

      {/* Top Suppliers */}
      <TopSuppliers invoices={invoices} year={year} />

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