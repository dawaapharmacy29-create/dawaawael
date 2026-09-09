import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtCurrency, fmtNumber } from "@/lib/financial-report-utils";

export default function FinancialSupplierAnalysisTable({ data, invoices, payments }) {
  const [selected, setSelected] = useState(null);

  const supplierInvoices = selected ? invoices.filter(i => i.supplier_name === selected.name) : [];
  const supplierPayments = selected ? payments.filter(p => p.supplier_name === selected.name) : [];

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">تحليل الموردين</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="text-right py-2 px-2 font-medium">المورد</th>
              <th className="text-left py-2 px-2 font-medium">إجمالي المشتريات</th>
              <th className="text-left py-2 px-2 font-medium">الدفعات المسددة</th>
              <th className="text-left py-2 px-2 font-medium">الرصيد المستحق</th>
            </tr>
          </thead>
          <tbody>
            {data.map(s => (
              <tr key={s.name} className="border-b hover:bg-blue-50 cursor-pointer transition" onClick={() => setSelected(s)}>
                <td className="py-2.5 px-2 font-medium text-blue-600">{s.name}</td>
                <td className="text-left py-2.5 px-2">{fmtNumber(s.totalPurchases)}</td>
                <td className="text-left py-2.5 px-2">{fmtNumber(s.totalPayments)}</td>
                <td className="text-left py-2.5 px-2 text-rose-600 font-medium">{fmtNumber(s.currentDebt)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">لا توجد بيانات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل المورد: {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">إجمالي المشتريات</p>
                  <p className="text-sm font-bold text-blue-600">{fmtCurrency(selected.totalPurchases)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">الدفعات المسددة</p>
                  <p className="text-sm font-bold text-amber-600">{fmtCurrency(selected.totalPayments)}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">الرصيد المستحق</p>
                  <p className="text-sm font-bold text-rose-600">{fmtCurrency(selected.currentDebt)}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">فواتير المشتريات ({supplierInvoices.length})</h3>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr><th className="text-right p-2">رقم الفاتورة</th><th className="text-right p-2">التاريخ</th><th className="text-left p-2">القيمة</th><th className="text-left p-2">المدفوع</th></tr>
                    </thead>
                    <tbody>
                      {supplierInvoices.map(inv => (
                        <tr key={inv.id} className="border-t">
                          <td className="p-2">{inv.system_invoice_number || "-"}</td>
                          <td className="p-2">{inv.invoice_date || "-"}</td>
                          <td className="text-left p-2">{fmtNumber(inv.total_value)}</td>
                          <td className="text-left p-2">{fmtNumber(inv.paid_value)}</td>
                        </tr>
                      ))}
                      {supplierInvoices.length === 0 && <tr><td colSpan={4} className="text-center p-3 text-gray-400">لا توجد فواتير</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-2">سجل الدفعات ({supplierPayments.length})</h3>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr><th className="text-right p-2">التاريخ</th><th className="text-left p-2">المبلغ</th><th className="text-right p-2">ملاحظات</th></tr>
                    </thead>
                    <tbody>
                      {supplierPayments.map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="p-2">{p.payment_date || "-"}</td>
                          <td className="text-left p-2">{fmtNumber(p.amount)}</td>
                          <td className="p-2">{p.notes || "-"}</td>
                        </tr>
                      ))}
                      {supplierPayments.length === 0 && <tr><td colSpan={3} className="text-center p-3 text-gray-400">لا توجد دفعات</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
