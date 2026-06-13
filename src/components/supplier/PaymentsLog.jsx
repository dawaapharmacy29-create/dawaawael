import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard } from "lucide-react";

export default function PaymentsLog() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const { data: payments = [] } = useQuery({
    queryKey: ["supplier-payments"],
    staleTime: 60000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    staleTime: 60000,
  });

  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

  // All supplier names from payments + suppliers list
  const supplierNames = useMemo(() => {
    const fromPayments = payments.map(p => p.supplier_name).filter(Boolean);
    const fromSuppliers = suppliers.map(s => s.name).filter(Boolean);
    return [...new Set([...fromSuppliers, ...fromPayments])].sort();
  }, [payments, suppliers]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const d = (p.payment_date || "").slice(0, 10);
      const matchSupplier = !selectedSupplier || p.supplier_name === selectedSupplier;
      const matchFrom = !dateFrom || d >= dateFrom;
      const matchTo = !dateTo || d <= dateTo;
      return matchSupplier && matchFrom && matchTo;
    }).sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || ""));
  }, [payments, selectedSupplier, dateFrom, dateTo]);

  const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div dir="rtl" className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>المورد (اختياري)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
            >
              <option value="">-- كل الموردين --</option>
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-green-50 border-green-100 text-center">
          <p className="text-xs text-gray-500 mb-1">إجمالي المدفوعات</p>
          <p className="text-xl font-bold text-green-700">{fmt(totalAmount)} ج</p>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-100 text-center">
          <p className="text-xs text-gray-500 mb-1">عدد الدفعات</p>
          <p className="text-xl font-bold text-blue-700">{filtered.length}</p>
        </Card>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد مدفوعات في هذه المدة</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="font-semibold text-gray-700 text-sm">سجل المدفوعات ({filtered.length})</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-right text-xs">التاريخ</TableHead>
                  <TableHead className="text-right text-xs">المورد</TableHead>
                  <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                  <TableHead className="text-right text-xs">ملاحظات</TableHead>
                  <TableHead className="text-right text-xs">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="hover:bg-gray-50 text-sm">
                    <TableCell className="text-gray-600">{p.payment_date || "—"}</TableCell>
                    <TableCell className="font-semibold text-gray-800">{p.supplier_name || "—"}</TableCell>
                    <TableCell className="font-mono text-teal-700">{p.invoice_number || "—"}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{p.notes || "—"}</TableCell>
                    <TableCell className="font-bold text-green-700">{fmt(p.amount)} ج</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t bg-green-50 text-sm font-semibold text-green-700 text-left">
            الإجمالي: {fmt(totalAmount)} ج
          </div>
        </Card>
      )}
    </div>
  );
}