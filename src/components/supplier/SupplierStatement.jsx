import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, X, RotateCcw } from "lucide-react";
import { isInvoiceFinanciallyApproved } from "@/lib/purchaseCalculations";
import { isInvoiceInRange } from "@/lib/invoiceIdentity";
import { loadInvoicesByFinancialDate } from "@/lib/invoiceRangeLoader";
import { useUserRole } from "@/lib/useUserRole";

const BRANCHES = ["دواء شكري", "دواء الشامي"];

async function loadAllFiltered(entity, query, sort, maxRows = 10000) {
  const PAGE = 500;
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.filter(query, sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

export default function SupplierStatement({ branch, onClose }) {
  const qc = useQueryClient();
  const { isManager } = useUserRole();
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [selectedSupplier, setSelectedSupplier] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list("name"),
    staleTime: 300000,
  });
  const supplierNames = useMemo(() => suppliers.filter((s) => s.is_active !== false).map((s) => s.name).filter(Boolean).sort(), [suppliers]);

  const statementEnabled = Boolean(selectedSupplier && dateFrom && dateTo);
  const { data: filteredRows = [] } = useQuery({
    queryKey: ["supplier-statement-invoices", branch, selectedSupplier, dateFrom, dateTo],
    queryFn: () => loadInvoicesByFinancialDate(base44.entities.PurchaseInvoice, {
      from: dateFrom,
      to: dateTo,
      extraFilter: { branch, supplier_name: selectedSupplier },
      sort: "invoice_date",
      maxRows: 20000,
    }),
    enabled: statementEnabled,
    staleTime: 120000,
  });
  const { data: paymentRows = [] } = useQuery({
    queryKey: ["supplier-statement-payments", branch, selectedSupplier, dateFrom, dateTo],
    queryFn: () => loadAllFiltered(base44.entities.SupplierPayment, {
      supplier_name: selectedSupplier,
      payment_date: { $gte: dateFrom, $lte: dateTo },
    }, "payment_date"),
    enabled: statementEnabled,
    staleTime: 120000,
  });

  const filtered = statementEnabled ? filteredRows.filter((i) => isInvoiceInRange(i, dateFrom, dateTo) && isInvoiceFinanciallyApproved(i)) : null;
  const periodPayments = useMemo(
    () => paymentRows.filter((p) => !p.branch || p.branch === branch),
    [paymentRows, branch]
  );

  const signedPaymentAmount = (p) => (p.transaction_type === "reversal" ? -1 : 1) * (Number(p.amount) || 0);

  const reversePayment = useMutation({
    mutationFn: async (payment) => {
      if (!payment?.id || payment.transaction_type === "reversal") throw new Error("لا يمكن عكس هذه الحركة");
      const existing = await base44.entities.SupplierPayment.filter({ reversal_of_payment_id: payment.id, transaction_type: "reversal" }, "-created_date", 5);
      if (existing.some((r) => r.status !== "reversed")) throw new Error("تم عكس هذه الدفعة بالفعل");
      const reversalAllocations = Array.isArray(payment.allocations) && payment.allocations.length > 0
        ? payment.allocations
        : payment.invoice_id ? [{ invoice_id: payment.invoice_id, invoice_number: payment.invoice_number || "", amount: Number(payment.amount) || 0 }] : [];
      const reversalRow = await base44.entities.SupplierPayment.create({
        supplier_name: payment.supplier_name,
        invoice_id: payment.invoice_id || "",
        invoice_number: payment.invoice_number || "",
        amount: Number(payment.amount) || 0,
        payment_date: today,
        payment_method: payment.payment_method || "أخرى",
        reference_number: payment.reference_number || "",
        transaction_type: "reversal",
        status: "posted",
        reversal_of_payment_id: payment.id,
        allocation_type: payment.allocation_type || (payment.invoice_id ? "invoice" : "general"),
        allocations: reversalAllocations,
        allocation_sync_status: reversalAllocations.length > 0 ? "pending" : "not_applicable",
        branch: payment.branch || branch,
        notes: `عكس دفعة بتاريخ ${payment.payment_date}${payment.notes ? ` — ${payment.notes}` : ""}`,
      });
      try {
        for (const allocation of reversalAllocations) {
          if (!allocation.invoice_id) continue;
          const invoiceRows = await base44.entities.PurchaseInvoice.filter({ id: allocation.invoice_id }, "-created_date", 1);
          const invoice = invoiceRows[0];
          if (!invoice) continue;
          const nextPaid = Math.max(0, (Number(invoice.paid_value) || 0) - (Number(allocation.amount) || 0));
          await base44.entities.PurchaseInvoice.update(invoice.id, { paid_value: nextPaid });
        }
        if (reversalAllocations.length > 0) await base44.entities.SupplierPayment.update(reversalRow.id, { allocation_sync_status: "applied", allocation_sync_error: "" });
      } catch (err) {
        try { await base44.entities.SupplierPayment.update(reversalRow.id, { allocation_sync_status: "needs_review", allocation_sync_error: err?.message || "فشل جزئي أثناء عكس الدفعة" }); } catch {}
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-statement-payments"] });
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      qc.invalidateQueries({ queryKey: ["supplier-credit-invoices"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
    },
  });

  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

  const totalPurchases = filtered?.reduce((s, i) => s + (i.total_value || 0), 0) || 0;
  const totalReturned = filtered?.reduce((s, i) => s + (i.returned_value || 0), 0) || 0;
  const totalNet = totalPurchases - totalReturned;
  const totalPaid = periodPayments.reduce((s, p) => s + signedPaymentAmount(p), 0);

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800">كشف حساب مورد — {branch}</h2>
        </div>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="text-gray-500">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>المورد</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
            >
              <option value="">-- اختر مورد --</option>
              {supplierNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Results */}
      {filtered === null ? (
        <Card className="p-10 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>اختر مورداً ومدة زمنية لعرض كشف الحساب</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">
          <p>لا توجد فواتير لهذا المورد في المدة المحددة</p>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 text-center bg-blue-50 border-blue-100">
              <p className="text-xs text-gray-500 mb-1">إجمالي المسحوبات</p>
              <p className="text-xl font-bold text-blue-700">{fmt(totalPurchases)} ج</p>
              <p className="text-xs text-gray-400 mt-1">{filtered.length} فاتورة</p>
            </Card>
            <Card className="p-4 text-center bg-orange-50 border-orange-100">
              <p className="text-xs text-gray-500 mb-1">المرتجعات</p>
              <p className="text-xl font-bold text-orange-600">{fmt(totalReturned)} ج</p>
            </Card>
            <Card className="p-4 text-center bg-red-50 border-red-100">
              <p className="text-xs text-gray-500 mb-1">الصافي</p>
              <p className="text-xl font-bold text-red-600">{fmt(totalNet)} ج</p>
            </Card>
            <Card className="p-4 text-center bg-green-50 border-green-100">
              <p className="text-xs text-gray-500 mb-1">المدفوع في المدة</p>
              <p className="text-xl font-bold text-green-600">{fmt(totalPaid)} ج</p>
            </Card>
          </div>

          {/* Invoices Table */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="font-semibold text-gray-700 text-sm">الفواتير ({filtered.length})</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                    <TableHead className="text-right text-xs">تاريخ الفاتورة</TableHead>
                    <TableHead className="text-right text-xs">طريقة الدفع</TableHead>
                    <TableHead className="text-right text-xs">القيمة</TableHead>
                    <TableHead className="text-right text-xs">المرتجع</TableHead>
                    <TableHead className="text-right text-xs">الصافي</TableHead>
                    <TableHead className="text-right text-xs">المدفوع</TableHead>
                    <TableHead className="text-right text-xs">المتبقي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(inv => {
                    const net = (inv.total_value || 0) - (inv.returned_value || 0);
                    const remaining = net - (inv.paid_value || 0);
                    return (
                      <TableRow key={inv.id} className="hover:bg-gray-50 text-sm">
                        <TableCell className="font-mono text-teal-700">{inv.system_invoice_number}</TableCell>
                        <TableCell className="text-gray-600">{inv.invoice_date || inv.created_date?.slice(0, 10) || "—"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.payment_type === "آجل" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                            {inv.payment_type}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{fmt(inv.total_value)} ج</TableCell>
                        <TableCell className="text-orange-600">{fmt(inv.returned_value)} ج</TableCell>
                        <TableCell className="font-semibold">{fmt(net)} ج</TableCell>
                        <TableCell className="text-green-600">{fmt(inv.paid_value)} ج</TableCell>
                        <TableCell className={remaining > 0 ? "text-red-600 font-semibold" : "text-green-600"}>{fmt(remaining)} ج</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Footer Total */}
            <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap gap-6 text-sm font-semibold justify-end">
              <span className="text-blue-700">الإجمالي: {fmt(totalPurchases)} ج</span>
              <span className="text-orange-600">المرتجع: {fmt(totalReturned)} ج</span>
              <span className="text-red-600">الصافي: {fmt(totalNet)} ج</span>
              <span className="text-green-600">المدفوع الصافي: {fmt(periodPayments.reduce((s, p) => s + signedPaymentAmount(p), 0))} ج</span>
            </div>
          </Card>

          {/* Payments Table */}
          {periodPayments.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-green-50">
                <p className="font-semibold text-green-700 text-sm">المدفوعات في هذه المدة ({periodPayments.length})</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-right text-xs">تاريخ السداد</TableHead>
                      <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                      <TableHead className="text-right text-xs">الوسيلة / المرجع</TableHead>
                      <TableHead className="text-right text-xs">ملاحظات</TableHead>
                      <TableHead className="text-right text-xs">المبلغ</TableHead>
                      <TableHead className="text-right text-xs">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodPayments.map(p => (
                      <TableRow key={p.id} className="text-sm">
                        <TableCell className="text-gray-600">{p.payment_date}</TableCell>
                        <TableCell className="font-mono text-teal-700">{p.invoice_number || "—"}</TableCell>
                        <TableCell className="text-gray-500 text-xs">{p.payment_method || "قديم"}{p.reference_number ? ` — ${p.reference_number}` : ""}</TableCell>
                        <TableCell className="text-gray-500">{p.notes || "—"}</TableCell>
                        <TableCell className={`font-semibold ${p.transaction_type === "reversal" ? "text-red-600" : "text-green-700"}`}>{p.transaction_type === "reversal" ? "-" : "+"}{fmt(p.amount)} ج</TableCell>
                        <TableCell>{isManager && p.transaction_type !== "reversal" && <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-700" disabled={reversePayment.isPending} onClick={() => reversePayment.mutate(p)}><RotateCcw className="w-3 h-3" /> عكس</Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}