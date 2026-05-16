import { useMemo } from "react";
import { Card } from "@/components/ui/card";

export default function TopSuppliers({ invoices, dateFrom, dateTo }) {
  const data = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const map = {};
    invoices
      .filter((i) => {
        const d = new Date(i.created_date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .forEach((inv) => {
        const name = inv.supplier_name || "غير محدد";
        if (!map[name]) map[name] = { name, total: 0, count: 0 };
        map[name].total += inv.total_value || 0;
        map[name].count++;
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [invoices, dateFrom, dateTo]);

  if (data.length === 0) return null;

  const grandTotal = data.reduce((s, r) => s + r.total, 0);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">جميع الموردين وحجم التعامل</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold">#</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold">المورد</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold">عدد الفواتير</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold">إجمالي المشتريات</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold">النسبة</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.name} className="border-b hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                <td className="px-3 py-2 text-gray-600">{row.count}</td>
                <td className="px-3 py-2 font-semibold text-teal-700">{row.total.toLocaleString("ar-EG")} ج</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                      <div
                        className="bg-teal-500 h-1.5 rounded-full"
                        style={{ width: `${grandTotal ? (row.total / grandTotal) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {grandTotal ? ((row.total / grandTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-sm text-gray-700">الإجمالي</td>
              <td className="px-3 py-2 text-sm text-gray-700">{data.reduce((s, r) => s + r.count, 0)}</td>
              <td className="px-3 py-2 text-sm text-teal-700">{grandTotal.toLocaleString("ar-EG")} ج</td>
              <td className="px-3 py-2 text-sm text-gray-500">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}