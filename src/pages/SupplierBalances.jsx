import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, ChevronDown, ChevronUp, Wallet, AlertTriangle } from "lucide-react";

export default function SupplierBalances() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [payDialog, setPayDialog] = useState(null); // { invoice }
  const [payForm, setPayForm] = useState({ amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });

  const { data: invoices = [] } = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => base44.entities.PurchaseInvoice.list("-created_date") });
  const { data: payments = [] } = useQuery({ queryKey: ["supplier-payments"], queryFn: () => base44.entities.SupplierPayment.list("-payment_date") });

  const addPayment = useMutation({
    mutationFn: async ({ invoice, amount, payment_date, notes }) => {
      const newPaid = (invoice.paid_value || 0) + parseFloat(amount);
      await base44.entities.SupplierPayment.create({
        supplier_name: invoice.supplier_name,
        invoice_id: invoice.id,
        invoice_number: invoice.system_invoice_number,
        amount: parseFloat(amount),
        payment_date,
        notes,
      });
      await base44.entities.PurchaseInvoice.update(invoice.id, { paid_value: newPaid });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      setPayDialog(null);
      setPayForm({ amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
    },
  });

  // Group unpaid/partial invoices by supplier
  const supplierGroups = useMemo(() => {
    const creditInvoices = invoices.filter((i) => {
      const remaining = (i.total_value || 0) - (i.returned_value || 0) - (i.paid_value || 0);
      return remaining > 0;
    });

    const map = {};
    creditInvoices.forEach((inv) => {
      const s = inv.supplier_name || "غير محدد";
      if (!map[s]) map[s] = { name: s, invoices: [], total: 0, paid: 0 };
      const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
      map[s].invoices.push({ ...inv, remaining });
      map[s].total += inv.total_value || 0;
      map[s].paid += inv.paid_value || 0;
    });

    return Object.values(map).sort((a, b) => {
      const ra = a.total - a.paid;
      const rb = b.total - b.paid;
      return rb - ra;
    });
  }, [invoices]);

  const totalDebt = supplierGroups.reduce((s, g) => s + (g.total - g.paid), 0);
  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

  // Overdue alerts: آجل invoices with invoice_date older than supplier payment terms (default 30 days)
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list() });
  const overdueInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.payment_type !== "آجل") return false;
      const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
      if (remaining <= 0) return false;
      const supplier = suppliers.find((s) => s.name === inv.supplier_name);
      const terms = supplier?.payment_terms_days || 30;
      const dateStr = inv.invoice_date || inv.created_date;
      if (!dateStr) return false;
      const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      return days >= terms;
    });
  }, [invoices, suppliers]);

  const openPayDialog = (invoice) => {
    const remaining = invoice.remaining || ((invoice.total_value || 0) - (invoice.returned_value || 0) - (invoice.paid_value || 0));
    setPayForm({ amount: remaining.toString(), payment_date: new Date().toISOString().split("T")[0], notes: "" });
    setPayDialog({ invoice });
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">أرصدة الموردين</h1>
          <p className="text-gray-500 text-sm mt-0.5">تتبع الحسابات الدائنة والمدفوعات</p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          <Wallet className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-xs text-gray-500">إجمالي الديون المتبقية</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalDebt)} ج</p>
          </div>
        </div>
      </div>

      {/* Overdue Alerts */}
      {overdueInvoices.length > 0 && (
        <Card className="p-4 border-r-4 border-r-red-500 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="font-semibold text-red-700 text-sm">{overdueInvoices.length} فاتورة آجلة تجاوزت مدة السداد</p>
          </div>
          <div className="space-y-1">
            {overdueInvoices.map((inv) => {
              const days = Math.floor((Date.now() - new Date(inv.invoice_date || inv.created_date).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={inv.id} className="text-xs text-red-600 bg-white rounded px-3 py-1.5 border border-red-100 flex justify-between">
                  <span>{inv.supplier_name} — فاتورة {inv.system_invoice_number} ({days} يوم)</span>
                  <span className="font-semibold">{fmt((inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0))} ج</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Supplier Cards */}
      {supplierGroups.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-400 text-lg">لا توجد فواتير غير مسددة ✅</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {supplierGroups.map((group) => {
            const totalRemaining = group.total - group.paid;
            const paidPercent = group.total > 0 ? Math.round((group.paid / group.total) * 100) : 0;
            const isExpanded = expanded === group.name;

            return (
              <Card key={group.name} className="overflow-hidden">
                {/* Supplier Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : group.name)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {group.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-500">{group.invoices.length} فاتورة غير مسددة بالكامل</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-gray-500">المتبقي</p>
                      <p className="font-bold text-red-600">{fmt(totalRemaining)} ج</p>
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-gray-500">نسبة السداد</p>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="h-2 bg-green-500 rounded-full" style={{ width: `${paidPercent}%` }} />
                        </div>
                        <span className="text-xs font-medium">{paidPercent}%</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Invoice Details */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                            <TableHead className="text-right text-xs">الفرع</TableHead>
                            <TableHead className="text-right text-xs">القيمة الكلية</TableHead>
                            <TableHead className="text-right text-xs">المدفوع</TableHead>
                            <TableHead className="text-right text-xs">المتبقي</TableHead>
                            <TableHead className="text-right text-xs">إجراء</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.invoices.map((inv) => (
                            <TableRow key={inv.id} className="hover:bg-gray-50">
                              <TableCell className="font-mono text-teal-700 text-sm">{inv.system_invoice_number}</TableCell>
                              <TableCell className="text-xs text-gray-600">{inv.branch || "—"}</TableCell>
                              <TableCell className="font-semibold text-sm">{fmt(inv.total_value)} ج</TableCell>
                              <TableCell className="text-green-600 text-sm">{fmt(inv.paid_value)} ج</TableCell>
                              <TableCell className="text-red-600 font-semibold text-sm">{fmt(inv.remaining)} ج</TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50 h-7 text-xs gap-1" onClick={() => openPayDialog(inv)}>
                                  <CreditCard className="w-3 h-3" />
                                  سداد
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Payment History for this supplier */}
                    {payments.filter((p) => p.supplier_name === group.name).length > 0 && (
                      <div className="p-4 border-t bg-green-50">
                        <p className="text-xs font-semibold text-green-700 mb-2">سجل المدفوعات</p>
                        <div className="space-y-1">
                          {payments.filter((p) => p.supplier_name === group.name).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs text-gray-600 bg-white rounded px-3 py-1.5 border border-green-100">
                              <span>{p.payment_date} — فاتورة {p.invoice_number}</span>
                              <span className="font-semibold text-green-700">{fmt(p.amount)} ج</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pay Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-500">المورد: <span className="font-semibold text-gray-800">{payDialog.invoice.supplier_name}</span></p>
                <p className="text-gray-500">الفاتورة: <span className="font-mono font-semibold text-teal-700">{payDialog.invoice.system_invoice_number}</span></p>
                <p className="text-gray-500">المتبقي: <span className="font-bold text-red-600">{fmt(payDialog.invoice.remaining)} ج</span></p>
              </div>
              <div className="space-y-1">
                <Label>مبلغ الدفعة</Label>
                <Input type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>تاريخ السداد</Label>
                <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="مثل: تحويل بنكي، شيك..." />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialog(null)}>إلغاء</Button>
            <Button
              disabled={!payForm.amount || addPayment.isPending}
              onClick={() => addPayment.mutate({ invoice: payDialog.invoice, ...payForm })}
              className="bg-green-600 hover:bg-green-700"
            >
              {addPayment.isPending ? "جاري الحفظ..." : "تأكيد الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}