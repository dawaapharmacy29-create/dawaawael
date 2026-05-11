import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TopSuppliers({ invoices, year }) {
  const data = useMemo(() => {
    const map = {};
    invoices
      .filter((i) => new Date(i.created_date).getFullYear() === year)
      .forEach((inv) => {
        const name = inv.supplier_name || "غير محدد";
        if (!map[name]) map[name] = { name, total: 0, count: 0 };
        map[name].total += inv.total_value || 0;
        map[name].count++;
      });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [invoices, year]);

  if (data.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">أكثر الموردين تعاملاً - {year}</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ right: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString()} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
          <Tooltip formatter={(v) => v.toLocaleString("ar-EG") + " ج"} />
          <Bar dataKey="total" name="إجمالي المشتريات" fill="#0d9488" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}