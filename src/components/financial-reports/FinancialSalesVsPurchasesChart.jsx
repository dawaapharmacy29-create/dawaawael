import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { fmtCurrency } from "@/lib/financial-report-utils";

export default function FinancialSalesVsPurchasesChart({ data, isDaily }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        مقارنة إجمالي المبيعات وإجمالي المشتريات ({isDaily ? "يومي" : "شهري"})
      </h2>
      {data.length === 0 ? (
        <p className="text-center text-gray-400 py-12">لا توجد بيانات للفترة المحددة</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString("ar-EG")} />
            <Tooltip formatter={(v) => fmtCurrency(v)} />
            <Legend />
            <Bar dataKey="totalSales" name="إجمالي المبيعات" fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="purchases" name="إجمالي المشتريات" fill="#3b82f6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
