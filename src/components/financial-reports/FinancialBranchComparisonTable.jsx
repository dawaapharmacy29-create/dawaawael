import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtCurrency, fmtNumber } from "@/lib/financial-report-utils";

export default function FinancialBranchComparisonTable({ data }) {
  const [selected, setSelected] = useState(null);

  const totals = data.reduce((acc, b) => ({
    totalSales: acc.totalSales + b.totalSales,
    netSales: acc.netSales + b.netSales,
    totalPurchases: acc.totalPurchases + b.totalPurchases,
  }), { totalSales: 0, netSales: 0, totalPurchases: 0 });
  const totalDiff = totals.netSales - totals.totalPurchases;
  const totalRatio = totals.netSales > 0 ? (totals.totalPurchases / totals.netSales) * 100 : 0;

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">مقارنة الفروع</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="text-right py-2 px-2 font-medium">الفرع</th>
              <th className="text-left py-2 px-2 font-medium">إجمالي المبيعات</th>
              <th className="text-left py-2 px-2 font-medium">صافي المبيعات</th>
              <th className="text-left py-2 px-2 font-medium">إجمالي المشتريات</th>
              <th className="text-left py-2 px-2 font-medium">الفرق</th>
              <th className="text-left py-2 px-2 font-medium">نسبة المشتريات</th>
            </tr>
          </thead>
          <tbody>
            {data.map(b => (
              <tr key={b.branch} className="border-b hover:bg-blue-50 cursor-pointer transition" onClick={() => setSelected(b)}>
                <td className="py-2.5 px-2 font-medium text-blue-600">{b.branch}</td>
                <td className="text-left py-2.5 px-2">{fmtNumber(b.totalSales)}</td>
                <td className="text-left py-2.5 px-2">{fmtNumber(b.netSales)}</td>
                <td className="text-left py-2.5 px-2">{fmtNumber(b.totalPurchases)}</td>
                <td className={`text-left py-2.5 px-2 font-medium ${b.diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtNumber(b.diff)}</td>
                <td className="text-left py-2.5 px-2">{b.ratio.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td className="py-2.5 px-2">الإجمالي</td>
              <td className="text-left py-2.5 px-2">{fmtNumber(totals.totalSales)}</td>
              <td className="text-left py-2.5 px-2">{fmtNumber(totals.netSales)}</td>
              <td className="text-left py-2.5 px-2">{fmtNumber(totals.totalPurchases)}</td>
              <td className={`text-left py-2.5 px-2 ${totalDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtNumber(totalDiff)}</td>
              <td className="text-left py-2.5 px-2">{totalRatio.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل {selected?.branch}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "إجمالي المبيعات", value: fmtCurrency(selected.totalSales), color: "text-emerald-600" },
                { label: "صافي المبيعات", value: fmtCurrency(selected.netSales), color: "text-teal-600" },
                { label: "إجمالي المشتريات", value: fmtCurrency(selected.totalPurchases), color: "text-blue-600" },
                { label: "الفرق بين المبيعات والمشتريات", value: fmtCurrency(selected.diff), color: selected.diff >= 0 ? "text-emerald-600" : "text-rose-600" },
                { label: "نسبة المشتريات من المبيعات", value: `${selected.ratio.toFixed(1)}%`, color: "text-indigo-600" },
                { label: "عدد فواتير المشتريات", value: fmtNumber(selected.invoiceCount), color: "text-purple-600" },
                { label: "عدد تسليمات الشيفت", value: fmtNumber(selected.handoverCount), color: "text-amber-600" },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color} mt-1`}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
