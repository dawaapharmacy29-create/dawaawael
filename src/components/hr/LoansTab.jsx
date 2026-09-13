import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, AlertCircle, CalendarClock, Banknote, History, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LoanFormDialog from "./LoanFormDialog";
import QuickAddEmployeeDialog from "./QuickAddEmployeeDialog";

async function loadAllRows(entity, sort, maxRows = 10000) {
  const PAGE = 500;
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.list(sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

const statusColor = {
  "نشطة": "bg-teal-100 text-teal-700 border-0",
  "مكتملة": "bg-green-100 text-green-700 border-0",
  "ملغاة": "bg-gray-100 text-gray-500 border-0",
};

export default function LoansTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [paymentLoan, setPaymentLoan] = useState(null);
  const [historyLoan, setHistoryLoan] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", transaction_date: new Date().toISOString().slice(0, 10), transaction_type: "payment", payroll_month: "", notes: "" });

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["employee-loans"],
    queryFn: () => loadAllRows(base44.entities.EmployeeLoan, "-created_date"),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["active-team-members"],
    queryFn: async () => (await base44.entities.TeamMember.list()).filter((m) => m.is_active !== false),
  });
  const { data: loanTransactions = [] } = useQuery({
    queryKey: ["employee-loan-transactions"],
    queryFn: () => loadAllRows(base44.entities.EmployeeLoanTransaction, "-transaction_date"),
    staleTime: 60000,
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke("createEmployeeLoanSafe", { loan: data });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر حفظ السلفة");
      return result.record;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const current = loans.find((l) => l.id === id);
      const hasTransactions = loanTransactions.some((t) => t.loan_id === id && t.status !== "reversed");
      if (hasTransactions && current && Number(data.amount) !== Number(current.amount)) {
        throw new Error("لا يمكن تغيير أصل السلفة بعد بدء تسجيل حركات عليها. استخدم حركة تسوية بدل تعديل المبلغ الأصلي.");
      }
      return base44.entities.EmployeeLoan.update(id, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
  });

  const paymentMut = useMutation({
    mutationFn: async ({ loan, form }) => {
      const amount = Number(form.amount) || 0;
      const currentPaid = Number(loan.paid_amount) || 0;
      const remaining = Math.max(0, (Number(loan.amount) || 0) - currentPaid);
      if (amount <= 0) throw new Error("قيمة الحركة يجب أن تكون أكبر من صفر");
      if (["payment", "installment", "adjustment_minus"].includes(form.transaction_type) && amount > remaining + 0.01) throw new Error(`قيمة الحركة أكبر من المتبقي (${remaining.toLocaleString("ar-EG")} ج)`);
      if (form.transaction_type === "installment" && form.payroll_month) {
        const duplicateInstallment = await base44.entities.EmployeeLoanTransaction.filter({ loan_id: loan.id, payroll_month: form.payroll_month, transaction_type: "installment", status: "posted" }, "-transaction_date", 5);
        if (duplicateInstallment.length > 0) throw new Error(`تم تسجيل قسط لهذه السلفة بالفعل في شهر ${form.payroll_month}`);
      }
      await base44.entities.EmployeeLoanTransaction.create({
        loan_id: loan.id,
        employee_name: loan.employee_name,
        branch: loan.branch,
        transaction_date: form.transaction_date,
        transaction_type: form.transaction_type,
        amount,
        payroll_month: form.payroll_month || "",
        notes: form.notes || "",
        status: "posted",
      });
      let nextPaid = currentPaid;
      if (["payment", "installment", "adjustment_minus"].includes(form.transaction_type)) nextPaid += amount;
      if (form.transaction_type === "adjustment_plus") nextPaid = Math.max(0, nextPaid - amount);
      const nextStatus = nextPaid >= (Number(loan.amount) || 0) - 0.01 ? "مكتملة" : loan.status === "ملغاة" ? "ملغاة" : "نشطة";
      await base44.entities.EmployeeLoan.update(loan.id, { paid_amount: nextPaid, status: nextStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-loans"] });
      queryClient.invalidateQueries({ queryKey: ["employee-loan-transactions"] });
      setPaymentLoan(null);
      setPaymentForm({ amount: "", transaction_date: new Date().toISOString().slice(0, 10), transaction_type: "payment", payroll_month: "", notes: "" });
    },
  });
  const reverseTransactionMut = useMutation({
    mutationFn: async ({ loan, transaction }) => {
      if (!transaction || transaction.status === "reversed" || transaction.transaction_type === "reversal") throw new Error("هذه الحركة غير قابلة للعكس");
      const existing = await base44.entities.EmployeeLoanTransaction.filter({ reference_transaction_id: transaction.id, transaction_type: "reversal", status: "posted" }, "-transaction_date", 5);
      if (existing.length > 0) throw new Error("تم عكس هذه الحركة بالفعل");
      await base44.entities.EmployeeLoanTransaction.create({
        loan_id: loan.id,
        employee_name: loan.employee_name,
        branch: loan.branch,
        transaction_date: new Date().toISOString().slice(0, 10),
        transaction_type: "reversal",
        amount: Number(transaction.amount) || 0,
        reference_transaction_id: transaction.id,
        payroll_month: transaction.payroll_month || "",
        notes: `عكس حركة ${transaction.transaction_type} بتاريخ ${transaction.transaction_date}`,
        status: "posted",
      });
      await base44.entities.EmployeeLoanTransaction.update(transaction.id, { status: "reversed" });
      const amount = Number(transaction.amount) || 0;
      let nextPaid = Number(loan.paid_amount) || 0;
      if (["payment", "installment", "adjustment_minus"].includes(transaction.transaction_type)) nextPaid = Math.max(0, nextPaid - amount);
      if (transaction.transaction_type === "adjustment_plus") nextPaid += amount;
      const nextStatus = nextPaid >= (Number(loan.amount) || 0) - 0.01 ? "مكتملة" : "نشطة";
      await base44.entities.EmployeeLoan.update(loan.id, { paid_amount: nextPaid, status: nextStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-loans"] });
      queryClient.invalidateQueries({ queryKey: ["employee-loan-transactions"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke("archiveHRRecordSafe", {
        id,
        entity_type: "EmployeeLoan",
        action: "archive",
        archive_reason: "أرشفة سلفة موظف",
        archive_note: "تمت الأرشفة من سجل السلف بدل الحذف النهائي",
      });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر أرشفة السلفة");
      return result.record;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
  });

  const operationalLoans = loans.filter((l) => l.is_archived !== true);
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const futureLoans = operationalLoans.filter((l) => l.status === "نشطة" && l.date && l.date > todayStr);
  const activeLoans = operationalLoans.filter((l) => l.status === "نشطة" && (!l.date || l.date <= todayStr));
  const totalAmount = activeLoans.reduce((s, l) => s + (l.amount || 0), 0);
  const totalRemaining = activeLoans.reduce((s, l) => s + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  const filtered = operationalLoans.filter((l) => !search || l.employee_name?.includes(search));
  const historyTransactions = historyLoan
    ? loanTransactions.filter((t) => t.loan_id === historyLoan.id).sort((a, b) => String(b.transaction_date || b.created_date || "").localeCompare(String(a.transaction_date || a.created_date || "")))
    : [];
  const transactionLabel = { installment: "قسط مرتب", payment: "سداد مباشر", adjustment_minus: "تسوية تخفض الرصيد", adjustment_plus: "تسوية تزيد الرصيد", reversal: "عكس حركة" };

  const handleSubmit = (data) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100"><Wallet className="w-5 h-5 text-teal-600" /></div>
          <div><p className="text-xs text-gray-500">سلف نشطة</p><p className="text-lg font-bold">{activeLoans.length}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">إجمالي السلف</p><p className="text-lg font-bold">{totalAmount.toLocaleString("ar-EG")}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100"><AlertCircle className="w-5 h-5 text-orange-600" /></div>
          <div><p className="text-xs text-gray-500">متبقي للسداد</p><p className="text-lg font-bold text-orange-600">{totalRemaining.toLocaleString("ar-EG")}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100"><CalendarClock className="w-5 h-5 text-violet-600" /></div>
          <div><p className="text-xs text-gray-500">سلف بتاريخ مستقبلي</p><p className="text-lg font-bold text-violet-700">{futureLoans.length}</p></div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="max-w-xs h-9" dir="rtl" />
        <div className="flex items-center gap-2">
          <QuickAddEmployeeDialog />
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4" /> إضافة سلفة</Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">لا توجد سلف</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>الموظف</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الأقساط</TableHead>
                    <TableHead>شهري</TableHead>
                    <TableHead>المسدد</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const remaining = (l.amount || 0) - (l.paid_amount || 0);
                    const isFuture = l.status === "نشطة" && l.date && l.date > todayStr;
                    return (
                      <TableRow key={l.id} className={isFuture ? "bg-violet-50/60 hover:bg-violet-50" : "hover:bg-gray-50"}>
                        <TableCell className="font-semibold">{l.employee_name}</TableCell>
                        <TableCell className="font-bold">{(l.amount || 0).toLocaleString("ar-EG")}</TableCell>
                        <TableCell className="text-gray-600 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span>{l.date}</span>
                            {isFuture && <Badge className="bg-violet-100 text-violet-700 border-0">مستقبلية</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">{l.installments_count || 1}</TableCell>
                        <TableCell className="text-gray-600">{(l.monthly_deduction || 0).toLocaleString("ar-EG")}</TableCell>
                        <TableCell className="text-green-600">{(l.paid_amount || 0).toLocaleString("ar-EG")}</TableCell>
                        <TableCell className={remaining > 0 ? "text-orange-600 font-semibold" : "text-gray-500"}>{remaining.toLocaleString("ar-EG")}</TableCell>
                        <TableCell><Badge className={statusColor[l.status] || "bg-gray-100"}>{l.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            {remaining > 0 && l.status !== "ملغاة" && <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" title="تسجيل سداد أو قسط" onClick={() => { setPaymentLoan(l); setPaymentForm({ amount: Math.min(remaining, l.monthly_deduction || remaining).toString(), transaction_date: new Date().toISOString().slice(0, 10), transaction_type: "installment", payroll_month: new Date().toISOString().slice(0, 7), notes: "" }); }}><Banknote className="w-3.5 h-3.5" /></Button>}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-violet-600 hover:bg-violet-50" title="سجل الحركات" onClick={() => setHistoryLoan(l)}><History className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => { setEditing(l); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteMut.mutate(l.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((l) => {
                const remaining = (l.amount || 0) - (l.paid_amount || 0);
                const isFuture = l.status === "نشطة" && l.date && l.date > todayStr;
                return (
                  <div key={l.id} className={isFuture ? "p-3 bg-violet-50/60" : "p-3"}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{l.employee_name}</span>
                      <Badge className={statusColor[l.status] || "bg-gray-100"}>{l.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                      <span>المبلغ: <b className="text-gray-800">{(l.amount || 0).toLocaleString("ar-EG")}</b></span>
                      <span>المتبقي: <b className="text-orange-600">{remaining.toLocaleString("ar-EG")}</b></span>
                      <span>القسط: {l.monthly_deduction || 0} × {l.installments_count || 1}</span>
                      <span>{l.date}</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {remaining > 0 && l.status !== "ملغاة" && <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700" onClick={() => { setPaymentLoan(l); setPaymentForm({ amount: Math.min(remaining, l.monthly_deduction || remaining).toString(), transaction_date: new Date().toISOString().slice(0, 10), transaction_type: "installment", payroll_month: new Date().toISOString().slice(0, 7), notes: "" }); }}><Banknote className="w-3 h-3" /> تسجيل سداد</Button>}
                      <Button size="sm" variant="outline" className="h-7 text-xs text-violet-700" onClick={() => setHistoryLoan(l)}><History className="w-3 h-3" /> الحركات</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(l); setDialogOpen(true); }}><Pencil className="w-3 h-3" /> تعديل</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-500" onClick={() => deleteMut.mutate(l.id)}><Trash2 className="w-3 h-3" /> حذف</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Dialog open={!!paymentLoan} onOpenChange={(open) => !open && setPaymentLoan(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل حركة على السلفة</DialogTitle></DialogHeader>
          {paymentLoan && <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p><b>{paymentLoan.employee_name}</b> — {paymentLoan.branch}</p>
              <p className="text-gray-500 mt-1">المتبقي الحالي: <b className="text-orange-700">{Math.max(0, (paymentLoan.amount || 0) - (paymentLoan.paid_amount || 0)).toLocaleString("ar-EG")} ج</b></p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">نوع الحركة</Label><select className="h-9 w-full rounded-md border px-2 text-sm" value={paymentForm.transaction_type} onChange={(e) => setPaymentForm((f) => ({ ...f, transaction_type: e.target.value }))}><option value="installment">قسط من المرتب</option><option value="payment">سداد مباشر</option><option value="adjustment_minus">تسوية تخفض الرصيد</option><option value="adjustment_plus">تسوية تزيد الرصيد</option></select></div>
              <div className="space-y-1"><Label className="text-xs">المبلغ</Label><Input type="number" min="0" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">تاريخ الحركة</Label><Input type="date" value={paymentForm.transaction_date} onChange={(e) => setPaymentForm((f) => ({ ...f, transaction_date: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">شهر المرتب</Label><Input type="month" value={paymentForm.payroll_month} onChange={(e) => setPaymentForm((f) => ({ ...f, payroll_month: e.target.value }))} disabled={paymentForm.transaction_type !== "installment"} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">ملاحظات</Label><Input value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="سبب التسوية أو تفاصيل السداد" /></div>
            {paymentMut.error && <p className="text-xs text-red-600">{paymentMut.error.message}</p>}
          </div>}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setPaymentLoan(null)}>إلغاء</Button><Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!paymentForm.amount || paymentMut.isPending} onClick={() => paymentMut.mutate({ loan: paymentLoan, form: paymentForm })}>{paymentMut.isPending ? "جاري الحفظ..." : "تسجيل الحركة"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyLoan} onOpenChange={(open) => !open && setHistoryLoan(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>سجل حركة السلفة — {historyLoan?.employee_name}</DialogTitle></DialogHeader>
          {historyLoan && <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-blue-50 p-3"><p className="text-[11px] text-gray-500">أصل السلفة</p><p className="font-black text-blue-700">{Number(historyLoan.amount || 0).toLocaleString("ar-EG")} ج</p></div>
              <div className="rounded-lg bg-green-50 p-3"><p className="text-[11px] text-gray-500">المسدد</p><p className="font-black text-green-700">{Number(historyLoan.paid_amount || 0).toLocaleString("ar-EG")} ج</p></div>
              <div className="rounded-lg bg-orange-50 p-3"><p className="text-[11px] text-gray-500">المتبقي</p><p className="font-black text-orange-700">{Math.max(0, Number(historyLoan.amount || 0) - Number(historyLoan.paid_amount || 0)).toLocaleString("ar-EG")} ج</p></div>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-gray-50"><TableHead>التاريخ</TableHead><TableHead>الحركة</TableHead><TableHead>شهر المرتب</TableHead><TableHead>المبلغ</TableHead><TableHead>ملاحظات</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
                <TableBody>
                  {historyTransactions.map((t) => <TableRow key={t.id} className={t.status === "reversed" ? "opacity-50 bg-gray-50" : ""}>
                    <TableCell className="text-xs">{t.transaction_date || "—"}</TableCell>
                    <TableCell className="text-xs"><Badge className={t.transaction_type === "reversal" ? "bg-red-100 text-red-700 border-0" : "bg-violet-100 text-violet-700 border-0"}>{transactionLabel[t.transaction_type] || t.transaction_type}</Badge>{t.status === "reversed" && <span className="mr-1 text-[10px] text-gray-400">تم عكسها</span>}</TableCell>
                    <TableCell className="text-xs">{t.payroll_month || "—"}</TableCell>
                    <TableCell className={`font-bold text-sm ${t.transaction_type === "adjustment_plus" ? "text-red-600" : t.transaction_type === "reversal" ? "text-amber-700" : "text-green-700"}`}>{Number(t.amount || 0).toLocaleString("ar-EG")} ج</TableCell>
                    <TableCell className="text-xs text-gray-500">{t.notes || "—"}</TableCell>
                    <TableCell>{t.status !== "reversed" && t.transaction_type !== "reversal" && <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-700" disabled={reverseTransactionMut.isPending} onClick={() => reverseTransactionMut.mutate({ loan: historyLoan, transaction: t })}><RotateCcw className="w-3 h-3" /> عكس</Button>}</TableCell>
                  </TableRow>)}
                  {historyTransactions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">لا توجد حركات مسجلة لهذه السلفة حتى الآن.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            {reverseTransactionMut.error && <p className="text-xs text-red-600">{reverseTransactionMut.error.message}</p>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setHistoryLoan(null)}>إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <LoanFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} initial={editing} employees={employees} />
    </div>
  );
}