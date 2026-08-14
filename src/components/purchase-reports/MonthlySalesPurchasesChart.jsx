import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { GitCompareArrows } from "lucide-react";
import { base44 } from "@/api/base44Client";

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

function monthStartStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split("T")[0];
}
function dayLabel(dateKey) {
  const [, m, d] = dateKey.split("-");
  return `${d}/${m}`;
}

export default function MonthlySalesPurchasesChart({ invoices }) {
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["shift-deliveries-monthly-chart"],
    queryFn: async () => {
      const PAGE = 500;
      let all = [];
      let page = 0;
      while (true) {
        const batch = await base44.entities.ShiftDelivery.list("-shift_date", PAGE, page * PAGE);
        all = [...all, ...batch];
        if (batch.length < PAGE) break;
        page++;
      }
      return all;
    },
    staleTime: 60000,
  });

  const chartData = useMemo(() => {
    const start = monthStartStr();
    const end = todayStr();

    const salesByDay = {};
    deliveries.forEach((d) => {
      if (!d.shift_date || d.shift_date < start || d.shift_date > end) return;
      salesByDay[d.shift_date] = (salesByDay[d.shift_date] || 0) + (d.total_sales || 0);
    });

    const purchasesByDay = {};
    invoices.forEach((i) => {
      const dateKey = i.invoice_date || i.created_date?.split("T")[0];
      if (!dateKey || dateKey < start || dateKey > end) return;
      purchasesByDay[dateKey] = (purchasesByDay[dateKey] || 0) + (i.total_value || 0);
    });

    const days = [];
    const cursor = new Date(start);
    const endDate = new Date(end);
    while (cursor <= endDate) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      days.push({
        date: dayLabel(key),
        sales: salesByDay[key] || 0,
        purchases: purchasesByDay[key] || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [deliveries, invoices]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <GitCompareArrows className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-700">مقارنة إجمالي المبيعات وإجمالي المشتريات (يومي)</h2>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v, name) => [fmt(v) + " ج.م", name]} labelFormatter={(l) => l} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sales" name="إجمالي المبيعات" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="purchases" name="إجمالي المشتريات" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
