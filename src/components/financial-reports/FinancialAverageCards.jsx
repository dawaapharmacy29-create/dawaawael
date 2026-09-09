import { useState } from "react";
import { ShoppingBag, TrendingUp, Receipt, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtCurrency } from "@/lib/financial-report-utils";

const ITEMS = [
  { key: "avgSales", label: "متوسط المبيعات اليومي", icon: TrendingUp, bg: "bg-emerald-50", text: "text-emerald-700", gradient: "from-emerald-500 to-emerald-600" },
  { key: "avgPurchases", label: "متوسط المشتريات اليومي", icon: ShoppingBag, bg: "bg-blue-50", text: "text-blue-700", gradient: "from-blue-500 to-blue-600" },
  { key: "avgExpenses", label: "متوسط المصروفات اليومي", icon: Receipt, bg: "bg-amber-50", text: "text-amber-700", gradient: "from-amber-500 to-amber-600" },
];

export default function FinancialAverageCards({ data, branchAvgSales = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-2">المتوسطات اليومية للفترة المحددة</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ITEMS.map(({ key, label, icon: Icon, bg, text, gradient }) => {
          const clickable = key === "avgSales";
          const CardTag = clickable ? "button" : "div";
          return (
            <CardTag
              key={key}
              type={clickable ? "button" : undefined}
              onClick={clickable ? () => setOpen(true) : undefined}
              className={`text-right rounded-xl p-4 ${bg} border border-black/5 shadow-sm w-full ${clickable ? "hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {clickable && <ChevronLeft className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-xs mb-0.5 leading-tight text-gray-500">{label}</p>
              <p className={`text-sm md:text-base font-bold ${text}`}>{fmtCurrency(data[key])}</p>
            </CardTag>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>متوسط المبيعات اليومي حسب الفرع</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {branchAvgSales.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات ضمن الفترة المحددة.</p>
            ) : (
              branchAvgSales.map(({ branch, avgSales, days }) => (
                <div key={branch} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{branch}</p>
                    <p className="text-[11px] text-gray-400">{days > 0 ? `${days} يوم مبيعات` : "لا توجد مبيعات مسجلة"}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">{fmtCurrency(avgSales)}</p>
                </div>
              ))
            )}
            {branchAvgSales.length > 0 && (
              <div className="flex items-center justify-between border-t pt-2.5 mt-1">
                <p className="text-sm font-bold text-gray-800">إجمالي كل الفروع</p>
                <p className="text-base font-bold text-emerald-800">{fmtCurrency(data.avgSales)}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
