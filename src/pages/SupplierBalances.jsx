import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortableHeader } from "@/components/table/SortableHeader";
import { SortControls } from "@/components/table/SortControls";
import { BRANCHES, calcSupplierTotalDebt, getAllCreditSupplierNames } from "@/lib/supplierBalanceUtils";

const SBAL_SORT_COLUMNS = [
  { field: "name", label: "اسم المورد", type: "text" },
  { field: "oldDebt", label: "مديونية قديمة", type: "number" },
  { field: "newDebt", label: "مديونية جديدة", type: "number" },
  { field: "totalNet", label: "الإجمالي", type: "number" },
];

/**
 * صفحة الإجمالي — نظرة سريعة فقط على إجمالي المديونية الحالية لكل مورد عبر الفرعين.
 * ملحوظة: لا يوجد هنا أي تسجيل دفعات أو فواتير أو كشف حساب — هذه العمليات
 * أصبحت مستقلة تماماً داخل صفحة كل فرع (أرصدة دواء شكري / أرصدة دواء الشامي).
 */
export default function SupplierBalances() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: async () => {
      const PAGE = 500; let all = []; let page = 0;
      while (true) {
        const batch = await base44.entities.PurchaseInvoice.list("-created_date", PAGE, page * PAGE);
        all = [...all, ...batch];
        if (batch.length < PAGE) break;
        page++;
      }
      return all;
    },
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
  const { data: payments = [] } = useQuery({ queryKey: ["supplier-payments"], queryFn: () => base44.entities.SupplierPayment.list("-payment_date", 2000), staleTime: 0 });
  const { data: debts = [] } = useQuery({ queryKey: ["supplier-debts"], queryFn: () => base44.entities.SupplierDebt.list() });
  const { data: monthStarts = [] } = useQuery({ queryKey: ["supplier-month-starts"], queryFn: () => base44.entities.SupplierMonthStart.list() });

  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

  const allSupplierNames = useMemo(() => getAllCreditSupplierNames({ invoices, debts }), [invoices, debts]);

  const supplierTotals = useMemo(() => {
    return allSupplierNames
      .map((name) => {
        const result = calcSupplierTotalDebt({ invoices, payments, debts, monthStarts, supplierName: name, branches: BRANCHES });
        const hasCreditInvoices = invoices.some((inv) => inv.payment_type === "آجل" && inv.supplier_name === name);
        if (result.totalNet <= 0 && !hasCreditInvoices) return null;
        return { name, ...result };
      })
      .filter(Boolean);
  }, [allSupplierNames, invoices, payments, debts, monthStarts]);

  const { sortField, sortDirection, toggleSort, setSort, resetSort, sortData } = useTableSorting({
    columns: SBAL_SORT_COLUMNS,
    defaultSort: { field: "totalNet", direction: "desc" },
    paramPrefix: "sbal",
  });
  const sortedSuppliers = useMemo(() => sortData(supplierTotals), [supplierTotals, sortData]);

  const grandTotal = supplierTotals.reduce((s, g) => s + g.totalNet, 0);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">أرصدة الموردين — الإجمالي</h1>
          <p className="text-gray-500 text-sm mt-0.5">إجمالي المديونية الحالية لكل مورد عبر كل الفروع (نظرة سريعة فقط)</p>
        </div>
        <div className="flex items-center gap-2">
          <SortControls
            columns={SBAL_SORT_COLUMNS}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggle={toggleSort}
            onSet={setSort}
            onReset={resetSort}
            cardMode
          />
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          <Wallet className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-xs text-gray-500">إجمالي المديونية الحالية لكل الموردين</p>
            <p className="text-lg font-bold text-red-600">{fmt(grandTotal)} ج</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        لتسجيل دفعة أو مراجعة كشف حساب أو سجل مدفوعات، ادخل صفحة الفرع المطلوب من قائمة "الموردون والحسابات".
      </p>

      {sortedSuppliers.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-400 text-lg">لا توجد مديونيات مسجّلة حالياً ✅</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <SortableHeader field="name" label="اسم المورد" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="text-right text-xs" />
                  <SortableHeader field="oldDebt" label="مديونية قديمة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="text-right text-xs" />
                  <SortableHeader field="newDebt" label="مديونية جديدة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="text-right text-xs" />
                  <SortableHeader field="totalNet" label="الإجمالي" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="text-right text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSuppliers.map((g) => (
                  <TableRow key={g.name} className="hover:bg-gray-50">
                    <TableCell className="font-semibold text-gray-800">{g.name}</TableCell>
                    <TableCell className="text-orange-600">{fmt(g.oldDebt)} ج</TableCell>
                    <TableCell className="text-blue-600">{fmt(g.newDebt)} ج</TableCell>
                    <TableCell className="font-bold text-red-600">{fmt(g.totalNet)} ج</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t bg-red-50 text-sm font-semibold text-red-700 text-left">
            الإجمالي: {fmt(grandTotal)} ج
          </div>
        </Card>
      )}
    </div>
  );
}
