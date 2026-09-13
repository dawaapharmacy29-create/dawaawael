import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { loadAllEntityFiltered } from "@/lib/entityPagination";
import { cycleRangeFor, cairoTodayKey } from "@/lib/smart-commerce-analytics";
import { getInvoiceNetAmount, isInvoiceFinanciallyApproved } from "@/lib/purchaseCalculations";
import { normalizeInvoiceNumber, getInvoiceOfficialDate, getInvoiceEffectiveDate, getInvoiceCanonicalKey, isInvoiceInRange } from "@/lib/invoiceIdentity";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const PAYMENT_METHOD_KEYWORDS = ["فودافون كاش", "انستا", "فيزا"];
const money = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function realShiftExpenses(record) {
  return (record.expenses || []).reduce((sum, e) => {
    const label = `${e.category || ""} ${e.description || ""}`;
    return PAYMENT_METHOD_KEYWORDS.some((key) => label.includes(key)) ? sum : sum + (Number(e.amount) || 0);
  }, 0);
}

function qualityBadge(level, text) {
  const cls = level === "bad"
    ? "bg-red-100 text-red-700 border-red-200"
    : level === "warn"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-emerald-100 text-emerald-700 border-emerald-200";
  return <span className={`inline-flex px-2 py-1 rounded-full border text-[11px] font-bold ${cls}`}>{text}</span>;
}

export default function DataReconciliation() {
  const currentCycle = cycleRangeFor();
  const [from, setFrom] = useState(currentCycle.from);
  const [to, setTo] = useState(currentCycle.to);
  const [branch, setBranch] = useState("all");
  const today = cairoTodayKey();

  const { data: shifts = [], isLoading: loadingShifts, refetch: refetchShifts } = useQuery({
    queryKey: ["reconciliation-shifts", from, to],
    queryFn: () => loadAllEntityFiltered(base44.entities.ShiftDelivery, { shift_date: { $gte: from, $lte: to } }, "shift_date", 20000),
    staleTime: 120000,
  });
  const { data: invoicesRaw = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["reconciliation-invoices", from, to],
    queryFn: () => loadAllEntityFiltered(base44.entities.PurchaseInvoice, {
      $or: [
        { invoice_date: { $gte: from, $lte: to } },
        { created_date: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` } },
      ],
    }, "invoice_date", 30000),
    staleTime: 120000,
  });
  const { data: expenses = [], isLoading: loadingExpenses, refetch: refetchExpenses } = useQuery({
    queryKey: ["reconciliation-expenses", from, to],
    queryFn: () => loadAllEntityFiltered(base44.entities.Expense, {
      $or: [
        { date: { $gte: from, $lte: to } },
        { created_date: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` } },
      ],
    }, "date", 20000),
    staleTime: 120000,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    staleTime: 300000,
  });
  const { data: targets = [] } = useQuery({
    queryKey: ["reconciliation-targets", to.slice(0, 7)],
    queryFn: () => base44.entities.TargetGoal.filter({ month: to.slice(0, 7) }, "branch"),
    staleTime: 300000,
  });
  const { data: purchaseTargets = [] } = useQuery({
    queryKey: ["reconciliation-purchase-targets", to.slice(0, 7)],
    queryFn: () => base44.entities.PurchaseTargetHistory.filter({ month: to.slice(0, 7) }, "branch"),
    staleTime: 300000,
  });

  const data = useMemo(() => {
    const scopedShifts = shifts.filter((s) => s.is_archived !== true && (branch === "all" || s.branch === branch));
    const scopedInvoices = invoicesRaw.filter((i) => {
      return isInvoiceInRange(i, from, to) && (branch === "all" || i.branch === branch);
    });
    const scopedExpenses = expenses.filter((e) => {
      const d = e.date || e.created_date?.slice(0, 10);
      return d && d >= from && d <= to && (branch === "all" || e.branch === branch);
    });

    const duplicateShiftMap = new Map();
    scopedShifts.forEach((s) => {
      const key = `${s.branch || ""}|${s.shift_date || ""}|${s.shift_type || ""}`;
      if (!duplicateShiftMap.has(key)) duplicateShiftMap.set(key, []);
      duplicateShiftMap.get(key).push(s);
    });
    const duplicateShiftGroups = [...duplicateShiftMap.values()].filter((rows) => rows.length > 1);

    const activeShifts = scopedShifts.filter((s) => s.status !== "مراجعة");
    const reviewShifts = scopedShifts.filter((s) => s.status === "مراجعة");
    const medians = {};
    BRANCHES.forEach((b) => {
      ["صباحي", "مسائي", "ليلي"].forEach((type) => {
        medians[`${b}|${type}`] = median(activeShifts.filter((s) => s.branch === b && s.shift_type === type && Number(s.total_sales) > 100).map((s) => Number(s.total_sales)));
      });
    });

    const shiftAnomalies = [];
    activeShifts.forEach((s) => {
      const sales = Number(s.total_sales) || 0;
      const net = Number(s.net_amount) || 0;
      const storedExpenses = Number(s.total_expenses) || 0;
      const expenseItemsSum = (s.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const baseline = medians[`${s.branch}|${s.shift_type}`] || 0;
      const reasons = [];
      if (sales > 0 && sales <= 100) reasons.push("مبيعات منخفضة جدًا");
      if (baseline > 0 && sales >= Math.max(50000, baseline * 3.5)) reasons.push(`قفزة كبيرة عن وسيط نفس الشيفت (${money(baseline)} ج)`);
      if (Math.abs(sales - (net + storedExpenses)) > 1) reasons.push("إجمالي المبيعات لا يساوي الصافي + المصروفات المسجلة");
      if (Math.abs(storedExpenses - expenseItemsSum) > 1) reasons.push("إجمالي المصروفات لا يساوي مجموع البنود");
      const paymentAmount = (s.expenses || []).filter((e) => PAYMENT_METHOD_KEYWORDS.some((k) => `${e.category || ""} ${e.description || ""}`.includes(k))).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      if (sales > 20000 && paymentAmount / sales >= 0.8) reasons.push("تركيز مرتفع جدًا في طرق الدفع الإلكترونية — يحتاج تحقق فقط");
      if (reasons.length) shiftAnomalies.push({ ...s, reasons });
    });

    const invoiceDuplicateMap = new Map();
    scopedInvoices.forEach((inv) => {
      const key = getInvoiceCanonicalKey(inv);
      if (!key) return;
      if (!invoiceDuplicateMap.has(key)) invoiceDuplicateMap.set(key, []);
      invoiceDuplicateMap.get(key).push(inv);
    });
    const duplicateInvoiceGroups = [...invoiceDuplicateMap.values()].filter((rows) => rows.length > 1);
    const missingOfficialDate = scopedInvoices.filter((i) => !getInvoiceOfficialDate(i));
    const pendingInvoices = scopedInvoices.filter((i) => i.status === "انتظار المراجعة");
    const rejectedInvoices = scopedInvoices.filter((i) => i.status === "مرفوضة");
    const pendingPurchaseValue = pendingInvoices.reduce((sum, i) => sum + getInvoiceNetAmount(i, suppliers), 0);
    const approvedInvoices = scopedInvoices.filter(isInvoiceFinanciallyApproved);

    const dates = [];
    for (let d = new Date(`${from}T00:00:00`), end = new Date(`${to}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key <= today) dates.push(key);
    }
    const branches = branch === "all" ? BRANCHES : [branch];
    const dailyRows = [];
    dates.forEach((date) => branches.forEach((b) => {
      const ds = activeShifts.filter((s) => s.branch === b && s.shift_date === date);
      const dr = reviewShifts.filter((s) => s.branch === b && s.shift_date === date);
      const di = approvedInvoices.filter((i) => i.branch === b && getInvoiceEffectiveDate(i) === date);
      const dpi = pendingInvoices.filter((i) => i.branch === b && getInvoiceEffectiveDate(i) === date);
      const de = scopedExpenses.filter((e) => e.branch === b && (e.date || e.created_date?.slice(0, 10)) === date);
      const sales = ds.reduce((sum, s) => sum + (Number(s.total_sales) || 0), 0);
      const purchases = di.reduce((sum, i) => sum + getInvoiceNetAmount(i, suppliers), 0);
      const externalExpenses = de.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const shiftExpenses = ds.reduce((sum, s) => sum + realShiftExpenses(s), 0);
      const duplicateShifts = duplicateShiftGroups.filter((g) => g[0]?.branch === b && g[0]?.shift_date === date).length;
      const anomalies = shiftAnomalies.filter((s) => s.branch === b && s.shift_date === date).length;
      const inferredDates = missingOfficialDate.filter((i) => i.branch === b && getInvoiceEffectiveDate(i) === date).length;
      dailyRows.push({ date, branch: b, sales, purchases, ratio: sales > 0 ? purchases / sales * 100 : null, shiftCount: ds.length, reviewShifts: dr.length, pendingInvoices: dpi.length, pendingPurchaseValue: dpi.reduce((sum, i) => sum + getInvoiceNetAmount(i, suppliers), 0), externalExpenses, shiftExpenses, duplicateShifts, anomalies, inferredDates });
    }));

    const sales = activeShifts.reduce((sum, s) => sum + (Number(s.total_sales) || 0), 0);
    const purchases = approvedInvoices.reduce((sum, i) => sum + getInvoiceNetAmount(i, suppliers), 0);
    const selectedBranches = branch === "all" ? BRANCHES : [branch];
    const salesTarget = selectedBranches.reduce((sum, b) => sum + Number(targets.find((t) => t.branch === b)?.target_amount || 0), 0);
    const purchaseTarget = selectedBranches.reduce((sum, b) => sum + Number(purchaseTargets.find((t) => t.branch === b)?.target_amount || 0), 0);

    return { scopedShifts, scopedInvoices, activeShifts, reviewShifts, duplicateShiftGroups, shiftAnomalies, duplicateInvoiceGroups, missingOfficialDate, pendingInvoices, rejectedInvoices, pendingPurchaseValue, dailyRows, sales, purchases, ratio: sales > 0 ? purchases / sales * 100 : null, salesTarget, purchaseTarget };
  }, [shifts, invoicesRaw, expenses, suppliers, targets, purchaseTargets, from, to, branch, today]);

  const loading = loadingShifts || loadingInvoices || loadingExpenses;
  const totalIssues = data.reviewShifts.length + data.duplicateShiftGroups.length + data.shiftAnomalies.length + data.duplicateInvoiceGroups.length + data.missingOfficialDate.length + data.pendingInvoices.length + data.rejectedInvoices.length;

  const refreshAll = async () => Promise.all([refetchShifts(), refetchInvoices(), refetchExpenses()]);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-teal-600" /> مطابقة البيانات اليومية</h1>
          <p className="text-sm text-gray-500 mt-1">تدقيق المبيعات والمشتريات وحالات المراجعة والتكرار والشذوذ بدون تعديل تلقائي لأي سجل.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading} className="gap-2"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> تحديث الفحص</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">من</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">إلى</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">الفرع</label><select value={branch} onChange={(e) => setBranch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">كل الفروع</option>{BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
          <Button size="sm" variant="outline" onClick={() => { const c = cycleRangeFor(); setFrom(c.from); setTo(c.to); }}>الدورة الحالية 26→25</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-gray-500">المبيعات المعتمدة</p><p className="text-xl font-black mt-1">{money(data.sales)} ج</p><p className="text-[11px] text-gray-400">التارجت {money(data.salesTarget)} ج</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">صافي المشتريات المعتمد</p><p className="text-xl font-black mt-1">{money(data.purchases)} ج</p><p className="text-[11px] text-gray-400">السقف {money(data.purchaseTarget)} ج</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">نسبة الشراء للمبيعات</p><p className="text-xl font-black mt-1">{data.ratio === null ? "—" : `${data.ratio.toFixed(2)}%`}</p><p className="text-[11px] text-gray-400">المعتمد فقط</p></Card>
        <Card className={`p-4 ${totalIssues > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-xs text-gray-500">نقاط تحتاج مراجعة</p><p className="text-xl font-black mt-1">{totalIssues.toLocaleString("ar-EG")}</p><p className="text-[11px] text-gray-500">لا يتم تعديلها تلقائيًا</p></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="p-3">{qualityBadge(data.reviewShifts.length ? "warn" : "ok", `شيفتات مراجعة: ${data.reviewShifts.length}`)}</Card>
        <Card className="p-3">{qualityBadge(data.duplicateShiftGroups.length ? "bad" : "ok", `تكرار شيفت: ${data.duplicateShiftGroups.length}`)}</Card>
        <Card className="p-3">{qualityBadge(data.shiftAnomalies.length ? "warn" : "ok", `شيفتات شاذة: ${data.shiftAnomalies.length}`)}</Card>
        <Card className="p-3">{qualityBadge(data.duplicateInvoiceGroups.length ? "bad" : "ok", `تكرار فواتير: ${data.duplicateInvoiceGroups.length}`)}</Card>
        <Card className="p-3">{qualityBadge(data.missingOfficialDate.length ? "warn" : "ok", `تاريخ فاتورة مستنتج: ${data.missingOfficialDate.length}`)}</Card>
        <Card className="p-3">{qualityBadge((data.pendingInvoices.length + data.rejectedInvoices.length) ? "warn" : "ok", `مراجعة/مرفوضة: ${data.pendingInvoices.length}/${data.rejectedInvoices.length}`)}</Card>
      </div>

      {data.pendingInvoices.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">قيمة صافي المشتريات الموجودة حاليًا في «انتظار المراجعة»: <b>{money(data.pendingPurchaseValue)} ج</b>. تم فصلها عن رقم المشتريات المعتمد في هذه الصفحة.</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-bold text-gray-800">المطابقة اليومية حسب الفرع</h2><p className="text-xs text-gray-500 mt-1">الصف الأحمر/الأصفر يعني وجود سبب واضح للمراجعة في هذا اليوم، وليس حكمًا بأن الرقم خاطئ.</p></div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0"><tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">الفرع</th><th className="p-2 text-left">المبيعات</th><th className="p-2 text-left">المشتريات</th><th className="p-2 text-left">النسبة</th><th className="p-2 text-center">الشيفتات</th><th className="p-2 text-center">مراجعة</th><th className="p-2 text-center">مكرر</th><th className="p-2 text-center">شاذ</th><th className="p-2 text-center">فواتير مراجعة</th><th className="p-2 text-left">مصروفات مستقلة</th><th className="p-2 text-left">مصروفات شيفت حقيقية</th></tr></thead>
            <tbody>{data.dailyRows.map((r) => {
              const bad = r.duplicateShifts > 0;
              const warn = r.reviewShifts > 0 || r.anomalies > 0 || r.pendingInvoices > 0 || r.inferredDates > 0;
              return <tr key={`${r.date}-${r.branch}`} className={`border-t ${bad ? "bg-red-50" : warn ? "bg-amber-50" : ""}`}><td className="p-2 whitespace-nowrap">{r.date}</td><td className="p-2 whitespace-nowrap font-medium">{r.branch}</td><td className="p-2 text-left">{money(r.sales)}</td><td className="p-2 text-left">{money(r.purchases)}</td><td className="p-2 text-left">{r.ratio === null ? "—" : `${r.ratio.toFixed(1)}%`}</td><td className="p-2 text-center">{r.shiftCount}</td><td className="p-2 text-center">{r.reviewShifts || "—"}</td><td className="p-2 text-center">{r.duplicateShifts || "—"}</td><td className="p-2 text-center">{r.anomalies || "—"}</td><td className="p-2 text-center">{r.pendingInvoices || "—"}</td><td className="p-2 text-left">{money(r.externalExpenses)}</td><td className="p-2 text-left">{money(r.shiftExpenses)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4"><h2 className="font-bold text-gray-800 mb-3">الشيفتات غير الطبيعية</h2><div className="space-y-2 max-h-96 overflow-auto">{data.shiftAnomalies.slice().sort((a,b) => String(b.shift_date).localeCompare(String(a.shift_date))).map((s) => <div key={s.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs"><div className="font-bold">{s.shift_date} — {s.branch} — {s.shift_type} — {s.submitted_by}</div><div className="mt-1">المبيعات: {money(s.total_sales)} ج</div><ul className="mt-1 list-disc pr-4 text-amber-900">{s.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>)}{data.shiftAnomalies.length === 0 && <p className="text-sm text-emerald-600 flex gap-2 items-center"><CheckCircle2 className="w-4 h-4" /> لا توجد شذوذات حسب القواعد الحالية.</p>}</div></Card>

        <Card className="p-4"><h2 className="font-bold text-gray-800 mb-3">التكرارات وحالات التاريخ</h2><div className="space-y-2 max-h-96 overflow-auto">{data.duplicateShiftGroups.map((g) => <div key={`s-${g[0]?.branch}-${g[0]?.shift_date}-${g[0]?.shift_type}`} className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs"><b>شيفت مكرر:</b> {g[0]?.branch} — {g[0]?.shift_date} — {g[0]?.shift_type} ({g.length} سجلات)</div>)}{data.duplicateInvoiceGroups.map((g) => <div key={`i-${g[0]?.branch}-${getInvoiceEffectiveDate(g[0])}-${normalizeInvoiceNumber(g[0]?.system_invoice_number)}`} className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs"><b>فاتورة مكررة:</b> {normalizeInvoiceNumber(g[0]?.system_invoice_number)} — {g[0]?.branch} — {getInvoiceEffectiveDate(g[0])} ({g.length} سجلات)</div>)}{data.missingOfficialDate.slice(0, 30).map((i) => <div key={`d-${i.id}`} className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs"><b>بدون invoice_date رسمي:</b> {i.system_invoice_number || i.id} — {i.branch || "بدون فرع"} — التاريخ المستنتج {getInvoiceEffectiveDate(i) || "غير متاح"}</div>)}{data.duplicateShiftGroups.length === 0 && data.duplicateInvoiceGroups.length === 0 && data.missingOfficialDate.length === 0 && <p className="text-sm text-emerald-600">لا توجد تكرارات أو تواريخ مستنتجة في الفترة.</p>}</div></Card>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>قواعد الشذوذ مصممة لاكتشاف ما يحتاج مراجعة، لا لتغيير البيانات. أي سجل يتم اكتشافه يظل كما هو حتى تتم مطابقته مع المصدر الأصلي/B-Connect أو سجل الشيفت.</span></div>
    </div>
  );
}
