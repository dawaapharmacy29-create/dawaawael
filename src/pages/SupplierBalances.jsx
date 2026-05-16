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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, ChevronDown, ChevronUp, Wallet, AlertTriangle, PlusCircle, Edit2, Loader2 } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

export default function SupplierBalances() {
  const qc = useQueryClient();
  const { isManager } = useUserRole();
  const [expanded, setExpanded] = useState(null);
  const [payDialog, setPayDialog] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
  const [debtDialog, setDebtDialog] = useState(null); // { supplier_name, existing? }
  const [debtForm, setDebtForm] = useState({ initial_debt: "", notes: "" });
  const [savingDebt, setSavingDebt] = useState(false);
  const [generalPayDialog, setGeneralPayDialog] = useState(false);
  const [generalPayForm, setGeneralPayForm] = useState({ supplier_name: "", amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });

  const { data: invoices = [] } = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => base44.entities.PurchaseInvoice.list("-created_date", 2000) });
  const { data: payments = [] } = useQuery({ queryKey: ["supplier-payments"], queryFn: () => base44.entities.SupplierPayment.list("-payment_date") });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list() });
  const { data: debts = [] } = useQuery({ queryKey: ["supplier-debts"], queryFn: () => base44.entities.SupplierDebt.list() });

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

  const saveDebt = async () => {
    setSavingDebt(true);
    const data = { supplier_name: debtDialog.supplier_name, initial_debt: parseFloat(debtForm.initial_debt) || 0, notes: debtForm.notes };
    if (debtDialog.existing) {
      await base44.entities.SupplierDebt.update(debtDialog.existing.id, data);
    } else {
      await base44.entities.SupplierDebt.create(data);
    }
    await qc.invalidateQueries({ queryKey: ["supplier-debts"] });
    setSavingDebt(false);
    setDebtDialog(null);
  };

  const openDebtDialog = (supplierName) => {
    const existing = debts.find(d => d.supplier_name === supplierName);
    setDebtForm({ initial_debt: existing?.initial_debt?.toString() || "", notes: existing?.notes || "" });
    setDebtDialog({ supplier_name: supplierName, existing });
  };

  // All unique supplier names from invoices + debts
  const allSupplierNames = useMemo(() => {
    const names = new Set([
      ...invoices.filter(i => i.payment_type === "آجل").map(i => i.supplier_name),
      ...debts.map(d => d.supplier_name),
    ]);
    return [...names].filter(Boolean);
  }, [invoices, debts]);

  // Group by supplier: invoices debt + initial debt
  const supplierGroups = useMemo(() => {
    const map = {};

    allSupplierNames.forEach(name => {
      const creditInvoices = invoices.filter(inv => {
        if (inv.payment_type !== "آجل" || inv.supplier_name !== name) return false;
        const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
        return remaining > 0;
      });

      const debtRecord = debts.find(d => d.supplier_name === name);
      const initialDebt = debtRecord?.initial_debt || 0;

      // Sum payments against initial debt (payments without invoice_id)
      const debtPayments = payments.filter(p => p.supplier_name === name && !p.invoice_id);
      const debtPaid = debtPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const remainingInitialDebt = Math.max(0, initialDebt - debtPaid);

      const invoicesRemaining = creditInvoices.reduce((s, inv) => {
        return s + (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
      }, 0);

      const totalNet = remainingInitialDebt + invoicesRemaining;
      if (totalNet <= 0 && creditInvoices.length === 0) return;

      map[name] = {
        name,
        invoices: creditInvoices.map(inv => ({
          ...inv,
          remaining: (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0),
        })),
        initialDebt,
        debtPaid,
        remainingInitialDebt,
        invoicesRemaining,
        totalNet,
        debtRecord,
      };
    });

    return Object.values(map).sort((a, b) => b.totalNet - a.totalNet);
  }, [invoices, payments, debts, allSupplierNames]);

  const totalNet = supplierGroups.reduce((s, g) => s + g.totalNet, 0);
  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

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
    setPayForm({ amount: invoice.remaining?.toString() || "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
    setPayDialog({ invoice });
  };

  const openDebtPayDialog = (supplierName, remaining) => {
    setPayForm({ amount: remaining?.toString() || "", payment_date: new Date().toISOString().split("T")[0], notes: "سداد مديونية قديمة" });
    setPayDialog({ debtPayment: true, supplier_name: supplierName, remaining });
  };

  const addDebtPayment = useMutation({
    mutationFn: async ({ supplier_name, amount, payment_date, notes }) => {
      await base44.entities.SupplierPayment.create({
        supplier_name,
        amount: parseFloat(amount),
        payment_date,
        notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      setPayDialog(null);
      setPayForm({ amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
    },
  });

  const addGeneralPayment = useMutation({
    mutationFn: async ({ supplier_name, amount, payment_date, notes }) => {
      await base44.entities.SupplierPayment.create({
        supplier_name,
        amount: parseFloat(amount),
        payment_date,
        notes: notes || "دفعة عامة",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      setGeneralPayDialog(false);
      setGeneralPayForm({ supplier_name: "", amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
    },
  });

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">أرصدة الموردين</h1>
          <p className="text-gray-500 text-sm mt-0.5">تتبع الحسابات الدائنة والمدفوعات</p>
        </div>
        <Button onClick={() => setGeneralPayDialog(true)} className="bg-green-600 hover:bg-green-700 gap-2">
          <PlusCircle className="w-4 h-4" /> تسديد دفعة
        </Button>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          <Wallet className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-xs text-gray-500">إجمالي الصافي المتبقي</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalNet)} ج</p>
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
                      <p className="text-xs text-gray-500">
                        {group.invoices.length} فاتورة
                        {group.initialDebt > 0 && ` + مديونية قديمة ${fmt(group.remainingInitialDebt)} ج`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-gray-500">الصافي المتبقي</p>
                      <p className="font-bold text-red-600">{fmt(group.totalNet)} ج</p>
                    </div>
                    {isManager && (
                      <Button
                        size="sm" variant="outline"
                        className="text-purple-600 border-purple-300 hover:bg-purple-50 h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); openDebtDialog(group.name); }}
                      >
                        <Edit2 className="w-3 h-3" /> مديونية قديمة
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Details */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Initial Debt Row */}
                    {group.initialDebt > 0 && (
                      <div className="p-4 bg-purple-50 border-b">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-purple-700">المديونية القديمة (قبل التطبيق)</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div className="bg-white rounded-lg p-2 border border-purple-100 text-center">
                            <p className="text-xs text-gray-500">المديونية الأصلية</p>
                            <p className="font-bold text-purple-700">{fmt(group.initialDebt)} ج</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-purple-100 text-center">
                            <p className="text-xs text-gray-500">المسدد منها</p>
                            <p className="font-bold text-green-600">{fmt(group.debtPaid)} ج</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-purple-100 text-center">
                            <p className="text-xs text-gray-500">المتبقي</p>
                            <p className="font-bold text-red-600">{fmt(group.remainingInitialDebt)} ج</p>
                          </div>
                        </div>
                        {group.remainingInitialDebt > 0 && (
                          <Button size="sm" variant="outline" className="text-purple-600 border-purple-300 hover:bg-purple-50 h-7 text-xs gap-1"
                            onClick={() => openDebtPayDialog(group.name, group.remainingInitialDebt)}>
                            <CreditCard className="w-3 h-3" /> سداد مديونية قديمة
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Invoices Table */}
                    {group.invoices.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                              <TableHead className="text-right text-xs">الفرع</TableHead>
                              <TableHead className="text-right text-xs">القيمة</TableHead>
                              <TableHead className="text-right text-xs">المدفوع</TableHead>
                              <TableHead className="text-right text-xs">المتبقي</TableHead>
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
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Summary Row */}
                    <div className="p-3 bg-gray-50 border-t flex flex-wrap gap-4 text-sm">
                      {group.initialDebt > 0 && <span>مديونية قديمة: <strong className="text-purple-700">{fmt(group.remainingInitialDebt)} ج</strong></span>}
                      {group.invoicesRemaining > 0 && <span>فواتير: <strong className="text-red-600">{fmt(group.invoicesRemaining)} ج</strong></span>}
                      <span className="mr-auto font-bold text-red-700">الصافي الإجمالي: {fmt(group.totalNet)} ج</span>
                    </div>

                    {/* Payment History */}
                    {payments.filter((p) => p.supplier_name === group.name).length > 0 && (
                      <div className="p-4 border-t bg-green-50">
                        <p className="text-xs font-semibold text-green-700 mb-2">سجل المدفوعات</p>
                        <div className="space-y-1">
                          {payments.filter((p) => p.supplier_name === group.name).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs text-gray-600 bg-white rounded px-3 py-1.5 border border-green-100">
                              <span>{p.payment_date} — {p.invoice_number ? `فاتورة ${p.invoice_number}` : p.notes || "مديونية قديمة"}</span>
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
                {payDialog.debtPayment ? (
                  <>
                    <p className="text-gray-500">المورد: <span className="font-semibold text-gray-800">{payDialog.supplier_name}</span></p>
                    <p className="text-gray-500">النوع: <span className="font-semibold text-purple-700">سداد مديونية قديمة</span></p>
                    <p className="text-gray-500">المتبقي: <span className="font-bold text-red-600">{fmt(payDialog.remaining)} ج</span></p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500">المورد: <span className="font-semibold text-gray-800">{payDialog.invoice.supplier_name}</span></p>
                    <p className="text-gray-500">الفاتورة: <span className="font-mono font-semibold text-teal-700">{payDialog.invoice.system_invoice_number}</span></p>
                    <p className="text-gray-500">المتبقي: <span className="font-bold text-red-600">{fmt(payDialog.invoice.remaining)} ج</span></p>
                  </>
                )}
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
              disabled={!payForm.amount || addPayment.isPending || addDebtPayment.isPending}
              onClick={() => {
                if (payDialog?.debtPayment) {
                  addDebtPayment.mutate({ supplier_name: payDialog.supplier_name, ...payForm });
                } else {
                  addPayment.mutate({ invoice: payDialog.invoice, ...payForm });
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              {(addPayment.isPending || addDebtPayment.isPending) ? "جاري الحفظ..." : "تأكيد الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* General Payment Dialog */}
      <Dialog open={generalPayDialog} onOpenChange={setGeneralPayDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تسديد دفعة عامة لمورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>اسم المورد</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={generalPayForm.supplier_name}
                onChange={e => setGeneralPayForm(f => ({ ...f, supplier_name: e.target.value }))}
              >
                <option value="">-- اختر مورد --</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>المبلغ المسدد (جنيه)</Label>
              <Input type="number" value={generalPayForm.amount} onChange={e => setGeneralPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>تاريخ السداد</Label>
              <Input type="date" value={generalPayForm.payment_date} onChange={e => setGeneralPayForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={generalPayForm.notes} onChange={e => setGeneralPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="مثل: تحويل بنكي، شيك..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGeneralPayDialog(false)}>إلغاء</Button>
            <Button
              disabled={!generalPayForm.supplier_name || !generalPayForm.amount || addGeneralPayment.isPending}
              onClick={() => addGeneralPayment.mutate(generalPayForm)}
              className="bg-green-600 hover:bg-green-700"
            >
              {addGeneralPayment.isPending ? "جاري الحفظ..." : "تأكيد الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debt Dialog */}
      {isManager && (
        <Dialog open={!!debtDialog} onOpenChange={(o) => !o && setDebtDialog(null)}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>المديونية القديمة — {debtDialog?.supplier_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">سجّل المديونية التي كانت موجودة للمورد قبل استخدام التطبيق.</p>
              <div className="space-y-1">
                <Label>المديونية القديمة (جنيه)</Label>
                <Input type="number" value={debtForm.initial_debt} onChange={e => setDebtForm(f => ({ ...f, initial_debt: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>ملاحظات</Label>
                <Textarea value={debtForm.notes} onChange={e => setDebtForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="اختياري..." />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDebtDialog(null)}>إلغاء</Button>
              <Button disabled={savingDebt} onClick={saveDebt} className="bg-purple-600 hover:bg-purple-700">
                {savingDebt ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}