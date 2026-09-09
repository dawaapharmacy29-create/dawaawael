import { useState, useMemo } from "react";
import { Building2, ChevronLeft, CalendarClock, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtCurrency } from "@/lib/financial-report-utils";

// يبني قائمة الأشهر (YYYY-MM) التي تتقاطع مع فترة [dateFrom, dateTo]
function monthsInRange(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return [];
  const months = [];
  const d = new Date(dateFrom + "T00:00:00");
  d.setDate(1);
  const end = new Date(dateTo + "T00:00:00");
  while (d <= end) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

export default function FinancialAdminExpensesCard({ items, records, dateFrom, dateTo }) {
  const [open, setOpen] = useState(false);

  const months = useMemo(() => monthsInRange(dateFrom, dateTo), [dateFrom, dateTo]);

  const filteredRecords = useMemo(
    () => records.filter((r) => months.includes(r.month)),
    [records, months]
  );

  const total = filteredRecords.reduce((s, r) => s + (r.amount || 0), 0);

  const byItem = useMemo(() => {
    return items.map((item) => {
      const itemRecords = filteredRecords.filter((r) => r.item_id === item.id);
      const itemTotal = itemRecords.reduce((s, r) => s + (r.amount || 0), 0);
      const missingMonths = months.filter((m) => !itemRecords.some((r) => r.month === m));
      return { item, total: itemTotal, missingMonths };
    });
  }, [items, filteredRecords, months]);

  const hasMissing = byItem.some((b) => b.missingMonths.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-right rounded-xl p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <ChevronLeft className="w-4 h-4 text-orange-400" />
        </div>
        <p className="text-xs text-gray-500 mb-0.5">إجمالي المصروفات الإدارية</p>
        <p className="text-lg font-bold text-orange-800">{fmtCurrency(total)}</p>
        {hasMissing ? (
          <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> يوجد بنود غير مسجّلة لبعض الأشهر
          </p>
        ) : months.length > 0 ? (
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
            <CalendarClock className="w-3 h-3" /> {months.length} شهر مشمول
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 mt-1">لا توجد أشهر ضمن الفترة المحددة</p>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تفصيل المصروفات الإدارية</DialogTitle></DialogHeader>
          <p className="text-xs text-gray-400 -mt-2">
            {months.length > 0 ? `الأشهر المشمولة: ${months.join("، ")}` : "لا توجد أشهر ضمن الفترة المحددة"}
          </p>
          <div className="space-y-2">
            {byItem.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">لا توجد بنود مصروفات إدارية معرّفة.</p>
            ) : (
              byItem.map(({ item, total: itemTotal, missingMonths }) => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                    {missingMonths.length > 0 && (
                      <p className="text-[11px] text-red-500">غير مسجّل: {missingMonths.join("، ")}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-orange-700">{fmtCurrency(itemTotal)}</p>
                </div>
              ))
            )}
            {byItem.length > 0 && (
              <div className="flex items-center justify-between border-t pt-2.5 mt-1">
                <p className="text-sm font-bold text-gray-800">الإجمالي</p>
                <p className="text-base font-bold text-orange-800">{fmtCurrency(total)}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
