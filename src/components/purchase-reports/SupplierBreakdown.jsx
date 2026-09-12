import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Receipt, TrendingUp, CalendarDays, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInvoiceNetAmount } from "@/lib/purchaseCalculations";

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

export default function SupplierBreakdown({ invoices, suppliers = [], dateFrom, dateTo }) {
  const [selected, setSelected] = useState(null);

  const suppliersData = useMemo(() => {
    const map = {};
    invoices.forEach((i) => {
      const name = i.supplier_name || "غير محدد";
      const dateKey = i.invoice_date || i.created_date?.split("T")[0];
      if (!map[name]) map[name] = { name, total: 0, count: 0, dailyMap: {}, invoices: [], returned: 0 };
      const net = getInvoiceNetAmount(i, suppliers);
      map[name].total += net;
      map[name].count += 1;
      if (net > 0) map[name].returned += Math.max(Number(i.returned_value) || 0, 0);
      map[name].invoices.push({ ...i, net });
      if (dateKey) {
        if (!map[name].dailyMap[dateKey]) map[name].dailyMap[dateKey] = 0;
        map[name].dailyMap[dateKey] += getInvoiceNetAmount(i, suppliers);
      }
    });
    return Object.values(map)
      .map((s) => ({
        ...s,
        daily: Object.entries(s.dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
        avgPerInvoice: s.count > 0 ? s.total / s.count : 0,
        invoices: [...s.invoices].sort((a, b) => (b.invoice_date || b.created_date || "").localeCompare(a.invoice_date || a.created_date || "")),
      }))
      .sort((a, b) => b.total - a.total);
  }, [invoices, suppliers]);

  const selectedData = suppliersData.find((s) => s.name === selected);

  return (
    <div className="space-y-2">
      {suppliersData.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">لا يوجد موردين</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {suppliersData.map((s, idx) => (
            <div key={s.name}
              className="rounded-xl border border-gray-200 bg-white p-4 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all"
              onClick={() => setSelected(s.name)}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{s.name}</p>
                    <p className="text-[10px] text-gray-400">المورد رقم {idx + 1}</p>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-gray-300" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-teal-50 rounded-lg p-2">
                  <TrendingUp className="w-3 h-3 text-teal-500 mx-auto mb-0.5" />
                  <p className="text-[10px] text-gray-500">الإجمالي</p>
                  <p className="text-xs font-bold text-teal-700">{fmt(s.total)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <Receipt className="w-3 h-3 text-blue-500 mx-auto mb-0.5" />
                  <p className="text-[10px] text-gray-500">الفواتير</p>
                  <p className="text-xs font-bold text-blue-700">{s.count}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2">
                  <CalendarDays className="w-3 h-3 text-amber-500 mx-auto mb-0.5" />
                  <p className="text-[10px] text-gray-500">يومياً</p>
                  <p className="text-xs font-bold text-amber-700">{fmt(s.total / Math.max(s.daily.length, 1))}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              {selected}
            </DialogTitle>
          </DialogHeader>
          {selectedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                  <TrendingUp className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">إجمالي المشتريات</p>
                  <p className="text-sm font-bold text-teal-700">{fmt(selectedData.total)} ج.م</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <Receipt className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">عدد الفواتير</p>
                  <p className="text-sm font-bold text-blue-700">{selectedData.count}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <CalendarDays className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">متوسط يومي</p>
                  <p className="text-sm font-bold text-amber-700">{fmt(selectedData.total / Math.max(selectedData.daily.length, 1))}</p>
                </div>
              </div>

              {selectedData.daily.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2">المشتريات اليومية</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={selectedData.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.split("-").slice(1).join("/")} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip formatter={(v) => fmt(v) + " ج.م"} labelFormatter={(d) => d} />
                      <Bar dataKey="value" name="مشتريات" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">كل فواتير المورد في الفترة</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {selectedData.invoices.map((inv) => (
                    <div key={inv.id} className="bg-gray-50 rounded-lg px-3 py-2 border">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-gray-700">فاتورة {inv.system_invoice_number || inv.supplier_invoice_number || "بدون رقم"}</p>
                          <p className="text-[10px] text-gray-500">{inv.invoice_date || inv.created_date?.split("T")[0] || "—"} · {inv.branch || "—"} · {inv.payment_type || "—"}</p>
                        </div>
                        <span className="text-sm font-bold text-teal-700">{fmt(inv.net)} ج.م صافي</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-gray-500">
                        <span>الإجمالي: <b className="text-gray-700">{fmt(inv.total_value)} ج.م</b></span>
                        <span>المرتجع: <b className="text-rose-600">{fmt(inv.returned_value)} ج.م</b></span>
                        <span>التصنيف: <b className="text-gray-700">{inv.purchase_category === "medicines" ? "أدوية" : inv.purchase_category === "supplies_accessories" ? "مستلزمات وإكسسوار" : "غير مصنف"}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
