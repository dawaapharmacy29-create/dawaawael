import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, LockKeyhole, AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { loadAllEntityFiltered } from "@/lib/entityPagination";
import { loadInvoicesByFinancialDate } from "@/lib/invoiceRangeLoader";
import { getInvoiceCanonicalKey, isInvoiceInRange } from "@/lib/invoiceIdentity";
import { getInvoiceNetAmount, isInvoiceFinanciallyApproved } from "@/lib/purchaseCalculations";
import { cairoTodayKey } from "@/lib/smart-commerce-analytics";
import { shiftFinancialView } from "@/lib/shiftFinancials";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const EXPECTED_SHIFTS = ["صباحي", "مسائي", "ليلي"];
const money = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });

function statusBadge(status) {
  if (status === "closed") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">مقفول</Badge>;
  if (status === "ready") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">جاهز للإقفال</Badge>;
  if (status === "reopened") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">أعيد فتحه</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">يحتاج مراجعة</Badge>;
}

export default function DailyClose() {
  const qc = useQueryClient();
  const { isManager, user, canAccessBranch } = useUserRole();
  const [businessDate, setBusinessDate] = useState(cairoTodayKey());
  const [branch, setBranch] = useState("دواء شكري");
  const [notes, setNotes] = useState("");

  const actor = user?.full_name || user?.name || user?.email || "مستخدم الإدارة";
  const canUseBranch = canAccessBranch(branch);
  const enabled = Boolean(businessDate && branch && canUseBranch);

  const { data: shifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useQuery({
    queryKey: ["daily-close-shifts", businessDate, branch],
    queryFn: () => loadAllEntityFiltered(base44.entities.ShiftDelivery, { branch, shift_date: businessDate }, "shift_type", 5000),
    enabled,
    staleTime: 30000,
  });

  const { data: invoiceCandidates = [], isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["daily-close-invoices", businessDate, branch],
    queryFn: () => loadInvoicesByFinancialDate(base44.entities.PurchaseInvoice, {
      from: businessDate,
      to: businessDate,
      extraFilter: { branch },
      sort: "-invoice_date",
      maxRows: 10000,
    }),
    enabled,
    staleTime: 30000,
  });

  const { data: expenses = [], isLoading: expensesLoading, refetch: refetchExpenses } = useQuery({
    queryKey: ["daily-close-expenses", businessDate, branch],
    queryFn: () => loadAllEntityFiltered(base44.entities.Expense, { branch, date: businessDate }, "-created_date", 5000),
    enabled,
    staleTime: 30000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    staleTime: 300000,
  });

  const { data: closeRows = [], isLoading: closeLoading } = useQuery({
    queryKey: ["daily-close-record", businessDate, branch],
    queryFn: () => base44.entities.DailyClose.filter({ business_date: businessDate, branch }, "-updated_date", 10),
    enabled,
    staleTime: 30000,
  });

  const currentClose = closeRows[0] || null;

  const audit = useMemo(() => {
    const activeShifts = shifts.filter((s) => s.is_archived !== true);
    const presentShiftTypes = new Set(activeShifts.map((s) => s.shift_type));
    const missingShifts = EXPECTED_SHIFTS.filter((type) => !presentShiftTypes.has(type));
    const reviewShifts = activeShifts.filter((s) => s.status === "مراجعة");
    const unresolvedWorkflowShifts = activeShifts.filter((s) => !["approved", "closed"].includes(s.workflow_status || "submitted"));

    const shiftGroups = new Map();
    activeShifts.forEach((s) => {
      const key = `${s.branch}|${s.shift_date}|${s.shift_type}`;
      if (!shiftGroups.has(key)) shiftGroups.set(key, []);
      shiftGroups.get(key).push(s);
    });
    const duplicateShiftGroups = [...shiftGroups.values()].filter((rows) => rows.length > 1);

    const shiftAnomalies = activeShifts.flatMap((s) => {
      const reasons = [];
      const sales = Number(s.total_sales) || 0;
      const financial = shiftFinancialView(s);
      const totalExpenses = financial.realExpenseTotal;
      const net = financial.operationalNet;
      const arithmeticGap = Math.abs(sales - totalExpenses - net);
      const electronic = financial.electronicTotal;
      if (sales <= 10) reasons.push("مبيعات منخفضة جدًا");
      if (arithmeticGap > 0.5) reasons.push(`عدم اتزان حسابي ${money(arithmeticGap)} ج`);
      if (sales > 0 && electronic / sales >= 0.85) reasons.push("نسبة دفع إلكتروني مرتفعة جدًا");
      return reasons.length ? [{ ...s, reasons }] : [];
    });

    const invoices = invoiceCandidates.filter((i) => isInvoiceInRange(i, businessDate, businessDate));
    const approvedInvoices = invoices.filter(isInvoiceFinanciallyApproved);
    const pendingInvoices = invoices.filter((i) => i.status === "انتظار المراجعة");
    const pendingExternal = pendingInvoices.filter((i) => (i.transaction_type || "external_purchase") !== "internal_transfer");
    const pendingInternal = pendingInvoices.filter((i) => i.transaction_type === "internal_transfer");
    const rejectedInvoices = invoices.filter((i) => i.status === "مرفوضة");
    const zeroExternal = invoices.filter((i) => (i.transaction_type || "external_purchase") !== "internal_transfer" && Number(i.total_value || 0) <= 0 && i.status !== "مرفوضة");

    const invoiceGroups = new Map();
    invoices.forEach((inv) => {
      const key = getInvoiceCanonicalKey(inv);
      if (!key) return;
      if (!invoiceGroups.has(key)) invoiceGroups.set(key, []);
      invoiceGroups.get(key).push(inv);
    });
    const duplicateInvoiceGroups = [...invoiceGroups.values()].filter((rows) => rows.length > 1);

    const sales = activeShifts.filter((s) => s.status !== "مراجعة").reduce((sum, s) => sum + (Number(s.total_sales) || 0), 0);
    const purchases = approvedInvoices.reduce((sum, i) => sum + getInvoiceNetAmount(i, suppliers), 0);
    const externalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const shiftExpenses = activeShifts.filter((s) => s.status !== "مراجعة").reduce((sum, s) => sum + shiftFinancialView(s).realExpenseTotal, 0);

    const blockingIssueCount = missingShifts.length
      + duplicateShiftGroups.length
      + reviewShifts.length
      + unresolvedWorkflowShifts.length
      + shiftAnomalies.filter((s) => s.reasons.some((r) => r.startsWith("عدم اتزان") || r.includes("منخفضة جدًا"))).length
      + pendingInvoices.length
      + duplicateInvoiceGroups.length
      + zeroExternal.length;

    const warningCount = shiftAnomalies.filter((s) => s.reasons.some((r) => r.includes("إلكتروني"))).length + rejectedInvoices.length;

    return {
      activeShifts, missingShifts, reviewShifts, unresolvedWorkflowShifts, duplicateShiftGroups, shiftAnomalies,
      invoices, approvedInvoices, pendingInvoices, pendingExternal, pendingInternal, rejectedInvoices,
      duplicateInvoiceGroups, zeroExternal, sales, purchases, externalExpenses, shiftExpenses,
      blockingIssueCount, warningCount,
      ready: blockingIssueCount === 0,
    };
  }, [shifts, invoiceCandidates, expenses, suppliers, businessDate]);

  const snapshot = () => ({
    business_date: businessDate,
    branch,
    sales_total: audit.sales,
    purchases_total: audit.purchases,
    expenses_total: audit.externalExpenses,
    shift_count: audit.activeShifts.length,
    missing_shifts: audit.missingShifts,
    duplicate_shift_groups: audit.duplicateShiftGroups.length,
    review_shift_count: audit.reviewShifts.length,
    anomaly_count: audit.shiftAnomalies.length,
    pending_invoice_count: audit.pendingInvoices.length,
    pending_external_count: audit.pendingExternal.length,
    pending_internal_count: audit.pendingInternal.length,
    rejected_invoice_count: audit.rejectedInvoices.length,
    duplicate_invoice_groups: audit.duplicateInvoiceGroups.length,
    zero_value_invoice_count: audit.zeroExternal.length,
    quality_issue_count: audit.blockingIssueCount,
    snapshot_json: JSON.stringify({
      missing_shifts: audit.missingShifts,
      duplicate_shift_groups: audit.duplicateShiftGroups.map((g) => g.map((x) => x.id)),
      review_shift_ids: audit.reviewShifts.map((x) => x.id),
      unresolved_workflow_shift_ids: audit.unresolvedWorkflowShifts.map((x) => x.id),
      anomaly_shift_ids: audit.shiftAnomalies.map((x) => x.id),
      pending_invoice_ids: audit.pendingInvoices.map((x) => x.id),
      duplicate_invoice_groups: audit.duplicateInvoiceGroups.map((g) => g.map((x) => x.id)),
      zero_value_invoice_ids: audit.zeroExternal.map((x) => x.id),
    }),
    reviewed_by: actor,
    reviewed_at: new Date().toISOString(),
    notes,
  });

  const saveReview = useMutation({
    mutationFn: async () => {
      const payload = { ...snapshot(), status: audit.ready ? "ready" : "needs_review" };
      if (currentClose) return base44.entities.DailyClose.update(currentClose.id, payload);
      return base44.entities.DailyClose.create(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-close-record", businessDate, branch] }),
  });

  const closeDay = useMutation({
    mutationFn: async () => {
      if (!audit.ready) throw new Error("لا يمكن إقفال اليوم قبل حل نقاط المراجعة المانعة.");
      const payload = { ...snapshot(), status: "closed", closed_by: actor, closed_at: new Date().toISOString() };
      if (currentClose) return base44.entities.DailyClose.update(currentClose.id, payload);
      return base44.entities.DailyClose.create(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-close-record", businessDate, branch] }),
  });

  const reopenDay = useMutation({
    mutationFn: async () => {
      if (!currentClose) return null;
      return base44.entities.DailyClose.update(currentClose.id, {
        status: "reopened",
        reopened_by: actor,
        reopened_at: new Date().toISOString(),
        notes,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-close-record", businessDate, branch] }),
  });

  const refresh = async () => Promise.all([refetchShifts(), refetchInvoices(), refetchExpenses(), qc.invalidateQueries({ queryKey: ["daily-close-record", businessDate, branch] })]);
  const loading = shiftsLoading || invoicesLoading || expensesLoading || closeLoading;

  if (!isManager) return <div dir="rtl" className="p-8 text-center text-gray-500">الإقفال اليومي متاح للمدير والمشرف فقط.</div>;

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><LockKeyhole className="w-6 h-6 text-teal-600" /> الإقفال اليومي</h1>
          <p className="text-sm text-gray-500 mt-1">لا يتم إقفال اليوم إلا بعد اكتمال الشيفتات وحسم التكرارات والفواتير المعلقة.</p>
        </div>
        <div className="flex items-center gap-2">{currentClose ? statusBadge(currentClose.status) : statusBadge(audit.ready ? "ready" : "needs_review")}<Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCw className="w-4 h-4 ml-1" />تحديث</Button></div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div><label className="text-xs text-gray-500">اليوم</label><Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">الفرع</label><select className="w-full h-10 rounded-md border px-3 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>{BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">ملاحظات المراجعة</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="سبب أو ملاحظة اختيارية" /></div>
        </div>
      </Card>

      {!canUseBranch && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">لا تملك صلاحية مراجعة هذا الفرع.</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-gray-500">المبيعات المعتمدة</p><p className="text-xl font-black mt-1">{money(audit.sales)} ج</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">صافي المشتريات المعتمد</p><p className="text-xl font-black mt-1">{money(audit.purchases)} ج</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">المصروفات الخارجية</p><p className="text-xl font-black mt-1">{money(audit.externalExpenses)} ج</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">مصروفات الشيفت الحقيقية</p><p className="text-xl font-black mt-1">{money(audit.shiftExpenses)} ج</p></Card>
      </div>

      <div className={`rounded-xl border p-4 ${audit.ready ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-2 font-bold">{audit.ready ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />} {audit.ready ? "اليوم جاهز للإقفال" : `${audit.blockingIssueCount} نقطة مانعة للإقفال`}</div>
        {audit.warningCount > 0 && <p className="text-xs mt-1 text-amber-700">يوجد أيضًا {audit.warningCount} تنبيه غير مانع يحتاج نظرة إدارية.</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2"><h2 className="font-bold">الشيفتات</h2><p className="text-sm">الموجود: {audit.activeShifts.length}/3</p>{audit.missingShifts.length > 0 && <p className="text-sm text-red-700">الناقص: {audit.missingShifts.join("، ")}</p>}{audit.duplicateShiftGroups.length > 0 && <p className="text-sm text-red-700">مجموعات مكررة: {audit.duplicateShiftGroups.length}</p>}{audit.reviewShifts.length > 0 && <p className="text-sm text-amber-700">تحت المراجعة: {audit.reviewShifts.length}</p>}{audit.unresolvedWorkflowShifts.length > 0 && <p className="text-sm text-red-700">لم تُعتمد/تُقفل بعد: {audit.unresolvedWorkflowShifts.length}</p>}{audit.shiftAnomalies.map((s) => <div key={s.id} className="text-xs border rounded-lg p-2 bg-amber-50"><b>{s.shift_type} — {s.submitted_by}</b>: {s.reasons.join("، ")}</div>)}</Card>
        <Card className="p-4 space-y-2"><h2 className="font-bold">الفواتير</h2><p className="text-sm">المحتسبة ماليًا: {audit.approvedInvoices.length}</p><p className="text-sm text-amber-700">انتظار المراجعة: {audit.pendingInvoices.length} ({audit.pendingExternal.length} خارجي + {audit.pendingInternal.length} داخلي)</p>{audit.rejectedInvoices.length > 0 && <p className="text-sm text-gray-600">مرفوضة: {audit.rejectedInvoices.length}</p>}{audit.duplicateInvoiceGroups.length > 0 && <p className="text-sm text-red-700">مجموعات مشتبه تكرار: {audit.duplicateInvoiceGroups.length}</p>}{audit.zeroExternal.length > 0 && <p className="text-sm text-red-700">شراء خارجي بقيمة صفر: {audit.zeroExternal.length}</p>}</Card>
      </div>

      {currentClose?.status === "closed" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><b>اليوم مقفول.</b> تم الإقفال بواسطة {currentClose.closed_by || "—"} في {currentClose.closed_at ? new Date(currentClose.closed_at).toLocaleString("ar-EG") : "—"}. لا يتم تغيير البيانات تلقائيًا بواسطة سجل الإقفال.</div>}

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => saveReview.mutate()} disabled={!enabled || saveReview.isPending || currentClose?.status === "closed"}>{currentClose?.status === "closed" ? "اليوم مقفول — أعد فتحه أولًا" : audit.ready ? "حفظ المراجعة — جاهز" : "حفظ نتيجة المراجعة"}</Button>
        {currentClose?.status !== "closed" && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => closeDay.mutate()} disabled={!enabled || !audit.ready || closeDay.isPending}><LockKeyhole className="w-4 h-4 ml-1" />إقفال اليوم</Button>}
        {currentClose?.status === "closed" && <Button variant="outline" className="text-amber-700 border-amber-300" onClick={() => reopenDay.mutate()} disabled={reopenDay.isPending}><RotateCcw className="w-4 h-4 ml-1" />إعادة فتح للمراجعة</Button>}
      </div>
    </div>
  );
}
