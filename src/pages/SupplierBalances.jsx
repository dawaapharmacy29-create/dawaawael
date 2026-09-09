import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, Wallet, Edit2, Loader2, Calendar, CalendarDays } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortControls } from "@/components/table/SortControls";

const SBAL_SORT_COLUMNS = [
  { field: "name", label: "اسم المورد", type: "text" },
  { field: "totalNet", label: "الإجمالي", type: "number" },
  { field: "oldDebt", label: "مديونية قديمة", type: "number" },
  { field: "newDebt", label: "مديونية جديدة", type: "number" },
];

export default function SupplierBalances() {
  const qc = useQueryClient();
  const { isManager } = useUserRole();

  const [expanded, setExpanded] = useState(null);
  const [debtDialog, setDebtDialog] = useState(null);
  const [debtForm, setDebtForm] = useState({ initial_debt: "", notes: "", branch: "" });
  const [savingDebt, setSavingDebt] = useState(false);
  const [monthStartDialog, setMonthStartDialog] = useState(null); // { supplier_name, existing? }
  const [monthStartForm, setMonthStartForm] = useState({ month_start_date: "", notes: "", branch: "" });
  const [savingMonthStart, setSavingMonthStart] = useState(false);

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
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const saveDebt = async () => {
    setSavingDebt(true);
    const data = { supplier_name: debtDialog.supplier_name, branch: debtForm.branch, initial_debt: round2(parseFloat(debtForm.initial_debt) || 0), notes: debtForm.notes };
    if (debtDialog.existing) await base44.entities.SupplierDebt.update(debtDialog.existing.id, data);
    else await base44.entities.SupplierDebt.create(data);
    await qc.invalidateQueries({ queryKey: ["supplier-debts"] });
    setSavingDebt(false);
    setDebtDialog(null);
  };

  const saveMonthStart = async () => {
    setSavingMonthStart(true);
    const data = { supplier_name: monthStartDialog.supplier_name, branch: monthStartForm.branch, month_start_date: monthStartForm.month_start_date, notes: monthStartForm.notes };
    if (monthStartDialog.existing) await base44.entities.SupplierMonthStart.update(monthStartDialog.existing.id, data);
    else await base44.entities.SupplierMonthStart.create(data);
    await qc.invalidateQueries({ queryKey: ["supplier-month-starts"] });
    setSavingMonthStart(false);
    setMonthStartDialog(null);
  };

  const openDebtDialog = (supplierName) => {
    setDebtForm({ initial_debt: "", notes: "", branch: "" });
    setDebtDialog({ supplier_name: supplierName });
  };

  const onDebtBranchChange = (branchName) => {
    const existing = debts.find(d => d.supplier_name === debtDialog.supplier_name && d.branch === branchName);
    setDebtForm(f => ({ ...f, branch: branchName, initial_debt: existing?.initial_debt?.toString() || "", notes: existing?.notes || "" }));
    setDebtDialog(d => ({ ...d, existing }));
  };

  const openMonthStartDialog = (supplierName) => {
    setMonthStartForm({ month_start_date: new Date().toISOString().split("T")[0], notes: "", branch: "" });
    setMonthStartDialog({ supplier_name: supplierName });
  };

  const onMonthStartBranchChange = (branchName) => {
    const existing = monthStarts.find(m => m.supplier_name === monthStartDialog.supplier_name && m.branch === branchName);
    setMonthStartForm(f => ({ ...f, branch: branchName, month_start_date: existing?.month_start_date || new Date().toISOString().split("T")[0], notes: existing?.notes || "" }));
    setMonthStartDialog(d => ({ ...d, existing }));
  };

  // ─── Data Aggregation ────────────────────────────────────────────────────────
  const allSupplierNames = useMemo(() => {
    const names = new Set([
      ...invoices.filter(i => i.payment_type === "آجل").map(i => i.supplier_name),
      ...debts.map(d => d.supplier_name),
    ]);
    return [...names].filter(Boolean);
  }, [invoices, debts]);

  const supplierGroups = useMemo(() => {
    const BRANCHES = ["دواء شكري", "دواء الشامي"];
    const calcRemaining = (inv) => round2(Math.max(0, (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0)));
    const invDate = (inv) => inv.invoice_date || inv.created_date?.slice(0, 10) || "";

    // حساب بيانات مورد لفرع معين (نفس منطق صفحة الفرع) — بدون توزيع الدفعات على الفواتير
    const calcBranchData = (name, branch, monthStartDate, initialDebt, adjustment, debtRecordExists) => {
      const branchInvoices = invoices.filter(inv => inv.payment_type === "آجل" && inv.supplier_name === name && inv.branch === branch);
      const withRemaining = branchInvoices.map(inv => ({ ...inv, remaining: calcRemaining(inv) }));

      const oldInvoices = monthStartDate ? withRemaining.filter(inv => invDate(inv) < monthStartDate) : withRemaining;
      const newInvoices = monthStartDate ? withRemaining.filter(inv => invDate(inv) >= monthStartDate) : [];

      const oldInvoicesRemaining = round2(oldInvoices.reduce((s, inv) => s + inv.remaining, 0));
      const newDebt = round2(newInvoices.reduce((s, inv) => s + inv.remaining, 0));
      const oldDebt = round2(initialDebt + oldInvoicesRemaining);

      // الدفعات العامة غير المخصصة على فاتورة تُخصم من الإجمالي مباشرة
      const generalPayments = payments.filter(p => p.supplier_name === name && !p.invoice_id && (!p.branch || p.branch === branch));
      const unallocatedPayments = round2(generalPayments.reduce((s, p) => s + (p.amount || 0), 0));

      const calculatedDebt = round2(oldDebt + newDebt - unallocatedPayments);
      const totalNet = round2(calculatedDebt + adjustment);

      return { oldInvoices, newInvoices, initialDebt, adjustment, monthStartDate, oldInvoicesRemaining, oldDebt, newDebt, unallocatedPayments, calculatedDebt, totalNet, allCreditCount: branchInvoices.length, debtRecordExists };
    };

    const map = {};

    allSupplierNames.forEach(name => {
      // احسب لكل فرع على حدة مع مديونية وتسوية وتاريخ بداية شهر خاص بكل فرع
      const branchResults = BRANCHES.map(br => {
        const branchMonthStart = monthStarts.find(m => m.supplier_name === name && m.branch === br);
        const branchMonthStartDate = branchMonthStart?.month_start_date || null;
        const branchDebtRecord = debts.find(d => d.supplier_name === name && d.branch === br);
        return calcBranchData(name, br, branchMonthStartDate, branchDebtRecord?.initial_debt || 0, branchDebtRecord?.adjustment || 0, !!branchDebtRecord);
      });

      // الفروع التي تعرض هذا المورد فعلياً في صفحتها (نفس شرط العرض في صفحة كل فرع)
      const isShownInBranch = (r) => !(r.totalNet <= 0 && r.allCreditCount === 0 && !r.debtRecordExists);
      const shownResults = branchResults.filter(isShownInBranch);
      if (shownResults.length === 0) return;

      // دمج الفواتير من الفروع المعروضة
      const oldInvoicesAll = shownResults.flatMap(r => r.oldInvoices);
      const newInvoicesAll = shownResults.flatMap(r => r.newInvoices);

      // الإجمالي = مجموع الفروع المعروضة (المديونية الإجمالية بعد التسوية)
      const oldDebt = round2(shownResults.reduce((s, r) => s + r.oldDebt, 0));
      const newDebt = round2(shownResults.reduce((s, r) => s + r.newDebt, 0));
      const initialDebt = round2(shownResults.reduce((s, r) => s + (r.initialDebt || 0), 0));
      const adjustment = round2(shownResults.reduce((s, r) => s + (r.adjustment || 0), 0));
      const oldInvoicesRemaining = round2(shownResults.reduce((s, r) => s + r.oldInvoicesRemaining, 0));
      const unallocatedPayments = round2(shownResults.reduce((s, r) => s + r.unallocatedPayments, 0));

      const calculatedDebt = round2(oldDebt + newDebt - unallocatedPayments);
      const totalNet = round2(calculatedDebt + adjustment);

      const monthStartDate = branchResults.map(r => r.monthStartDate).find(Boolean) || null;

      map[name] = {
        name,
        monthStartDate,
        oldInvoices: oldInvoicesAll,
        newInvoices: newInvoicesAll,
        initialDebt,
        adjustment,
        oldInvoicesRemaining,
        unallocatedPayments,
        calculatedDebt,
        oldDebt,
        newDebt,
        totalNet,
      };
    });

    return Object.values(map).sort((a, b) => b.totalNet - a.totalNet);
  }, [invoices, payments, debts, allSupplierNames, monthStarts]);

  const totalNet = supplierGroups.reduce((s, g) => s + g.totalNet, 0);

  const { sortField, sortDirection, toggleSort, setSort, resetSort, sortData } = useTableSorting({
    columns: SBAL_SORT_COLUMNS,
    defaultSort: { field: "totalNet", direction: "desc" },
    paramPrefix: "sbal",
  });
  const sortedGroups = useMemo(() => sortData(supplierGroups), [supplierGroups, sortData]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">أرصدة الموردين</h1>
          <p className="text-gray-500 text-sm mt-0.5">تتبع الحسابات الدائنة والمدفوعات</p>
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
            <p className="text-xs text-gray-500">إجمالي الصافي المتبقي</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalNet)} ج</p>
          </div>
        </div>
      </div>



      {/* Supplier Cards */}
      {supplierGroups.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-400 text-lg">لا توجد فواتير غير مسددة ✅</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map((group) => {
            const isExpanded = expanded === group.name;
            return (
              <Card key={group.name} className="overflow-hidden">
                {/* Supplier Header */}
                <div
                   className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                   onClick={() => setExpanded(isExpanded ? null : group.name)}
                 >
                   <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                     <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                       {group.name.charAt(0)}
                     </div>
                     <div className="min-w-0">
                       <p className="font-semibold text-gray-800 truncate">{group.name}</p>
                       <div className="flex items-center gap-2 flex-wrap">
                         <p className="text-xs text-gray-500">
                           {group.oldInvoices.length + group.newInvoices.length} فاتورة
                         </p>
                         {group.monthStartDate && (
                           <span className="text-xs text-blue-500 flex items-center gap-1">
                             <CalendarDays className="w-3 h-3" />
                             {group.monthStartDate}
                           </span>
                         )}
                       </div>
                     </div>
                   </div>

                   <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end shrink-0">
                    {/* Summary mini-cards */}
                    {group.monthStartDate && (
                      <>
                        <div className="hidden sm:flex flex-col items-center bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 min-w-[90px]">
                          <p className="text-xs text-gray-400">مديونية قديمة</p>
                          <p className="font-bold text-orange-600 text-sm">{fmt(group.oldDebt)} ج</p>
                        </div>
                        <div className="hidden sm:flex flex-col items-center bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 min-w-[90px]">
                          <p className="text-xs text-gray-400">مديونية جديدة</p>
                          <p className="font-bold text-blue-600 text-sm">{fmt(group.newDebt)} ج</p>
                        </div>
                      </>
                    )}
                    <div className="hidden sm:flex flex-col items-center bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 min-w-[90px]">
                      <p className="text-xs text-gray-400">الإجمالي</p>
                      <p className="font-bold text-red-600 text-sm">{fmt(group.totalNet)} ج</p>
                    </div>

                    {/* Buttons */}
                    {isManager && (
                      <>
                        <Button
                          size="sm" variant="outline"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50 h-7 text-xs gap-1"
                          onClick={(e) => { e.stopPropagation(); openMonthStartDialog(group.name); }}
                        >
                          <Calendar className="w-3 h-3" /> بداية شهر
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-purple-600 border-purple-300 hover:bg-purple-50 h-7 text-xs gap-1"
                          onClick={(e) => { e.stopPropagation(); openDebtDialog(group.name); }}
                        >
                          <Edit2 className="w-3 h-3" /> مديونية قديمة
                        </Button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* ─── Expanded Details ─── */}
                {isExpanded && (
                  <div className="border-t">

                    {/* ── 3 Summary Cards ── */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Old Debt Card */}
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-orange-700">المديونية القديمة</p>
                          <span className="text-xs text-gray-400 bg-white rounded px-2 py-0.5 border">
                            {group.monthStartDate ? `قبل ${group.monthStartDate}` : "كل الفترة"}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-orange-600 mt-2">{fmt(group.oldDebt)} ج</p>
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                            <span className="text-xs text-gray-500">إجمالي المديونية القديمة</span>
                            <span className="text-sm font-bold text-orange-600">{fmt((group.initialDebt || 0) + (group.oldInvoicesRemaining || 0))} ج</span>
                          </div>
                          <div className="flex items-center justify-between bg-orange-100 rounded-lg px-3 py-2 border border-orange-200">
                            <span className="text-xs font-semibold text-orange-800">المتبقي</span>
                            <span className="text-sm font-bold text-orange-700">{fmt(group.oldDebt)} ج</span>
                          </div>
                        </div>
                      </div>

                      {/* New Debt Card */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-blue-700">المديونية الجديدة</p>
                          <span className="text-xs text-gray-400 bg-white rounded px-2 py-0.5 border">
                            {group.monthStartDate ? `من ${group.monthStartDate}` : "—"}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 mt-2">{fmt(group.newDebt)} ج</p>
                        <p className="text-xs text-gray-500 mt-2">{group.newInvoices.length} فاتورة جديدة</p>
                      </div>

                      {/* Total Card */}
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-red-700">الإجمالي</p>
                          <span className="text-xs text-gray-400 bg-white rounded px-2 py-0.5 border">كل الفترات</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600 mt-2">{fmt(group.totalNet)} ج</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {group.oldInvoices.length + group.newInvoices.length} فاتورة إجمالي
                        </p>
                        <div className="mt-3 space-y-1.5">
                          {group.unallocatedPayments > 0 && (
                            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-100">
                              <span className="text-xs text-gray-500">دفعات عامة غير مخصصة</span>
                              <span className="text-sm font-bold text-green-600">- {fmt(group.unallocatedPayments)} ج</span>
                            </div>
                          )}
                          {group.adjustment !== 0 && (
                            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                              <span className="text-xs text-gray-500">فرق تسوية</span>
                              <span className="text-sm font-bold text-amber-600">{fmt(group.adjustment)} ج</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between bg-red-100 rounded-lg px-3 py-2 border border-red-200">
                            <span className="text-xs font-semibold text-red-800">الإجمالي النهائي بعد التسوية</span>
                            <span className="text-sm font-bold text-red-700">{fmt(group.totalNet)} ج</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Old Invoices Table ── */}
                    {group.oldInvoices.length > 0 && (
                      <div className="border-t">
                        <div className="px-4 py-2 bg-orange-50 flex items-center gap-2">
                          <span className="text-xs font-semibold text-orange-700">📋 الفواتير القديمة ({group.oldInvoices.length})</span>
                          {group.monthStartDate && <span className="text-xs text-gray-400">قبل {group.monthStartDate}</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                                <TableHead className="text-right text-xs">التاريخ</TableHead>
                                <TableHead className="text-right text-xs">الفرع</TableHead>
                                <TableHead className="text-right text-xs">القيمة</TableHead>
                                <TableHead className="text-right text-xs">المدفوع</TableHead>
                                <TableHead className="text-right text-xs">المتبقي</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.oldInvoices.map((inv) => (
                                <TableRow key={inv.id} className="hover:bg-orange-50/30">
                                  <TableCell className="font-mono text-teal-700 text-sm">{inv.system_invoice_number}</TableCell>
                                  <TableCell className="text-xs text-gray-500">{inv.invoice_date || inv.created_date?.slice(0,10) || "—"}</TableCell>
                                  <TableCell className="text-xs text-gray-600">{inv.branch || "—"}</TableCell>
                                  <TableCell className="font-semibold text-sm">{fmt(inv.total_value)} ج</TableCell>
                                  <TableCell className="text-green-600 text-sm">{fmt(inv.paid_value)} ج</TableCell>
                                  <TableCell className="text-red-600 font-semibold text-sm">{fmt(inv.remaining)} ج</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* ── New Invoices Table ── */}
                    {group.newInvoices.length > 0 && (
                      <div className="border-t">
                        <div className="px-4 py-2 bg-blue-50 flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-700">🆕 الفواتير الجديدة ({group.newInvoices.length})</span>
                          {group.monthStartDate && <span className="text-xs text-gray-400">من {group.monthStartDate}</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                                <TableHead className="text-right text-xs">التاريخ</TableHead>
                                <TableHead className="text-right text-xs">الفرع</TableHead>
                                <TableHead className="text-right text-xs">القيمة</TableHead>
                                <TableHead className="text-right text-xs">المدفوع</TableHead>
                                <TableHead className="text-right text-xs">المتبقي</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.newInvoices.map((inv) => (
                                <TableRow key={inv.id} className="hover:bg-blue-50/30">
                                  <TableCell className="font-mono text-teal-700 text-sm">{inv.system_invoice_number}</TableCell>
                                  <TableCell className="text-xs text-gray-500">{inv.invoice_date || inv.created_date?.slice(0,10) || "—"}</TableCell>
                                  <TableCell className="text-xs text-gray-600">{inv.branch || "—"}</TableCell>
                                  <TableCell className="font-semibold text-sm">{fmt(inv.total_value)} ج</TableCell>
                                  <TableCell className="text-green-600 text-sm">{fmt(inv.paid_value)} ج</TableCell>
                                  <TableCell className="text-red-600 font-semibold text-sm">{fmt(inv.remaining)} ج</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
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

      {/* ─── Debt Dialog ─── */}
      {isManager && (
        <Dialog open={!!debtDialog} onOpenChange={(o) => !o && setDebtDialog(null)}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>المديونية القديمة — {debtDialog?.supplier_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">سجّل المديونية التي كانت موجودة للمورد قبل استخدام التطبيق — اختر الفرع أولاً.</p>
              <div className="space-y-1">
                <Label>الفرع *</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={debtForm.branch} onChange={e => onDebtBranchChange(e.target.value)}>
                  <option value="">-- اختر الفرع --</option>
                  <option value="دواء شكري">دواء شكري</option>
                  <option value="دواء الشامي">دواء الشامي</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>المديونية القديمة (جنيه)</Label>
                <Input type="number" value={debtForm.initial_debt} onChange={e => setDebtForm(f => ({ ...f, initial_debt: e.target.value }))} placeholder="0" disabled={!debtForm.branch} />
              </div>
              <div className="space-y-1">
                <Label>ملاحظات</Label>
                <Textarea value={debtForm.notes} onChange={e => setDebtForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="اختياري..." disabled={!debtForm.branch} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDebtDialog(null)}>إلغاء</Button>
              <Button disabled={!debtForm.branch || savingDebt} onClick={saveDebt} className="bg-purple-600 hover:bg-purple-700">
                {savingDebt ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Month Start Dialog (Manager only) ─── */}
      {isManager && (
        <Dialog open={!!monthStartDialog} onOpenChange={(o) => !o && setMonthStartDialog(null)}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                بداية الشهر الجديد — {monthStartDialog?.supplier_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                <p>سيتم تصنيف الفواتير قبل هذا التاريخ كـ <strong>مديونية قديمة</strong> والفواتير بعده كـ <strong>مديونية جديدة</strong> — لكل فرع على حدة.</p>
                {monthStartDialog?.existing && (
                  <p className="mt-1 text-xs text-gray-500">التاريخ الحالي: <strong>{monthStartDialog.existing.month_start_date}</strong></p>
                )}
              </div>
              <div className="space-y-1">
                <Label>الفرع *</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={monthStartForm.branch} onChange={e => onMonthStartBranchChange(e.target.value)}>
                  <option value="">-- اختر الفرع --</option>
                  <option value="دواء شكري">دواء شكري</option>
                  <option value="دواء الشامي">دواء الشامي</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>تاريخ بداية الشهر الجديد *</Label>
                <Input type="date" value={monthStartForm.month_start_date}
                  onChange={e => setMonthStartForm(f => ({ ...f, month_start_date: e.target.value }))} disabled={!monthStartForm.branch} />
              </div>
              <div className="space-y-1">
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={monthStartForm.notes} onChange={e => setMonthStartForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="مثل: دورة شهر يونيو..." disabled={!monthStartForm.branch} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setMonthStartDialog(null)}>إلغاء</Button>
              <Button disabled={!monthStartForm.branch || !monthStartForm.month_start_date || savingMonthStart} onClick={saveMonthStart} className="bg-blue-600 hover:bg-blue-700">
                {savingMonthStart ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد بداية الشهر"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}