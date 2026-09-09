import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { computeTotalRemaining, fmtCurrency } from "@/lib/financial-report-utils";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

// نقاط القياس: يوم 1 و10 و20 لكل شهر من آخر 3 شهور (بدون تجاوز تاريخ النهاردة)
function buildCheckpoints() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const points = [];
  for (let back = 2; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    [1, 10, 20].forEach((day) => {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dateStr <= today) {
        points.push({ date: dateStr, label: `${day} ${MONTHS_AR[m]}` });
      }
    });
  }
  return points;
}

export default function FinancialSupplierBalanceTrendChart({ invoices, payments, debts, supplier }) {
  const checkpoints = useMemo(() => buildCheckpoints(), []);

  const chartData = useMemo(() => {
    return checkpoints.map(({ date, label }) => {
      const invUpTo = invoices.filter((i) => (i.invoice_date || "") <= date);
      const payUpTo = payments.filter((p) => (p.payment_date || "") <= date);
      const balance = computeTotalRemaining(invUpTo, payUpTo, debts, supplier);
      return { label, balance };
    });
  }, [checkpoints, invoices, payments, debts, supplier]);

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-orange-500" />
        <h3 className="font-bold text-gray-800 text-sm">تطور رصيد الموردين — آخر 3 شهور (كل 10 أيام)</h3>
        {supplier !== "all" && <span className="text-xs text-gray-400">({supplier})</span>}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={55} tickFormatter={(v) => fmtCurrency(v)} />
          <Tooltip formatter={(v) => [fmtCurrency(v), "رصيد الموردين"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, direction: "rtl" }} />
          <Line type="monotone" dataKey="balance" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: "#f97316" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
