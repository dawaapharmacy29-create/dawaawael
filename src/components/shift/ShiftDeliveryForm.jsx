import { useState, useMemo, useEffect, useRef } from "react";
import { getRecordedAt } from "@/lib/shiftUtils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Wallet, Plus, Trash2, Save, Loader2, Banknote, CreditCard, Smartphone, Landmark, CircleDollarSign } from "lucide-react";
import { assertDailyCloseOpen, currentShiftBusinessDate } from "@/lib/dailyCloseGuard";


const BRANCHES = ["دواء شكري", "دواء الشامي"];
const SHIFT_TYPES = ["صباحي", "مسائي", "ليلي"];
const normalizeShiftEmployeeName = (value = "") => String(value).trim().replace(/[\/\\]/g, " ").replace(/\s+/g, " ");
const SHIFT_DELIVERY_EXCLUDED_EMPLOYEES = new Set([
  "احمد وجيه",
  "محمود الغباري",
  "يوسف ماهر",
  "احمد السيد",
  "محمد الالفي",
  "محمد الديب",
  "محمد حافظ",
  "عبد الرحمن",
  "حسين",
  "مصطفي",
  "عم محمد سالم",
  "يوسف عيد",
  "اسلام السبع",
].map(normalizeShiftEmployeeName));
const PAYMENT_EXPENSE_NAMES = new Set(["انستا", "فيزا", "فودافون كاش", "فودافون", "Visa", "Insta"]);
const EXPENSE_SOURCES = [
  ["cash", "كاش"],
  ["insta", "إنستا باي"],
  ["vodafone", "فودافون كاش"],
  ["bank", "حساب بنكي"],
  ["other", "أخرى"],
];

export default function ShiftDeliveryForm({ onSaved, initialDraft = null }) {
  const qc = useQueryClient();

  const { data: expenseItems = [] } = useQuery({
    queryKey: ["expense-items"],
    queryFn: () => base44.entities.ExpenseItem.list(),
    staleTime: 60000,
  });
  const { data: employeeNameMap = [] } = useQuery({
    queryKey: ["employee-name-map"],
    queryFn: () => base44.entities.EmployeeNameMap.filter({ is_active: true }, "canonical_name"),
    staleTime: 60000,
  });
  const activeExpenseItems = expenseItems.filter((i) => i.is_active !== false && !PAYMENT_EXPENSE_NAMES.has((i.name || "").trim()));

  const [form, setForm] = useState({
    branch: "",
    shift_type: "",
    employee_map_id: "",
    total_sales: "",
    notes: "",
  });
  const [payments, setPayments] = useState({ cash: "", visa: "", insta: "", vodafone: "", other: "" });
  const [advancedCollection, setAdvancedCollection] = useState(false);
  const [visaControl, setVisaControl] = useState({ terminalAmount: "", operationCount: "", terminalName: "", batchReference: "" });
  const [cashHandover, setCashHandover] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [liveExpenseForm, setLiveExpenseForm] = useState({ category: "", amount: "", note: "", payment_source: "cash" });
  const [liveExpenseSaving, setLiveExpenseSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftState, setDraftState] = useState("");
  const [draftBusinessDate, setDraftBusinessDate] = useState("");
  const draftIdRef = useRef(null);
  const draftKeyRef = useRef("");
  const retryCountRef = useRef(0);
  const submissionTokenRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `shift-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!initialDraft?.id) return;
    setForm({
      branch: initialDraft.branch || "",
      shift_type: initialDraft.shift_type || "",
      employee_map_id: initialDraft.employee_map_id || "",
      total_sales: initialDraft.total_sales || "",
      notes: initialDraft.notes || "",
    });
    const draftTotal = Number(initialDraft.total_sales || 0);
    const draftOther = Number(initialDraft.other_sales || 0);
    const legacySimpleOtherOnly =
      Number(initialDraft.cash_sales || 0) === 0 &&
      Number(initialDraft.visa_sales || 0) === 0 &&
      Number(initialDraft.insta_sales || 0) === 0 &&
      Number(initialDraft.vodafone_sales || 0) === 0 &&
      draftOther > 0 &&
      Math.abs(draftOther - draftTotal) <= 0.01;
    const hasDetailedBreakdown = Number(initialDraft.visa_sales || 0) > 0 || Number(initialDraft.insta_sales || 0) > 0 || Number(initialDraft.vodafone_sales || 0) > 0 || (draftOther > 0 && !legacySimpleOtherOnly);
    setAdvancedCollection(hasDetailedBreakdown);
    setPayments({
      cash: initialDraft.cash_sales || "",
      visa: initialDraft.visa_sales || "",
      insta: initialDraft.insta_sales || "",
      vodafone: initialDraft.vodafone_sales || "",
      other: legacySimpleOtherOnly ? "" : (initialDraft.other_sales || ""),
    });
    setVisaControl({
      terminalAmount: initialDraft.visa_terminal_amount || "",
      operationCount: initialDraft.visa_operation_count || "",
      terminalName: initialDraft.visa_terminal_name || "",
      batchReference: initialDraft.visa_batch_reference || "",
    });
    setCashHandover(initialDraft.cash_handover ?? "");
    setExpenses(Array.isArray(initialDraft.expenses) && initialDraft.expenses.length > 0 ? initialDraft.expenses.map((e) => ({ ...e, payment_source: e.payment_source || "cash" })) : []);
    setDraftBusinessDate(initialDraft.business_date || "");
    draftIdRef.current = initialDraft.id;
    draftKeyRef.current = initialDraft.draft_key || "";
    retryCountRef.current = Number(initialDraft.retry_count || 0);
    if (initialDraft.submission_token) submissionTokenRef.current = initialDraft.submission_token;
    setDraftState(`تم استعادة المسودة المحفوظة${initialDraft.last_error ? ` — آخر خطأ: ${initialDraft.last_error}` : ""}`);
  }, [initialDraft]);

  // تاريخ ووقت التسجيل يظهر تلقائيًا ولا يمكن للمستخدم تعديله
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const simpleTotal = parseFloat(form.total_sales) || 0;
  const collectionDetailsTotal = useMemo(() =>
    (parseFloat(payments.visa) || 0) +
    (parseFloat(payments.insta) || 0) +
    (parseFloat(payments.vodafone) || 0) +
    (parseFloat(payments.other) || 0),
  [payments.visa, payments.insta, payments.vodafone, payments.other]);
  const derivedCashSales = Math.max(0, simpleTotal - collectionDetailsTotal);
  const paymentTotal = simpleTotal;
  const liveBusinessDate = draftBusinessDate || (form.shift_type ? currentShiftBusinessDate(form.shift_type) : "");
  const { data: liveExpenseEvents = [] } = useQuery({
    queryKey: ["shift-expense-events", form.branch, liveBusinessDate, form.shift_type],
    queryFn: () => base44.entities.ShiftExpenseEvent.filter({ branch: form.branch, business_date: liveBusinessDate, shift_type: form.shift_type, status: "posted" }, "occurred_at", 300),
    enabled: Boolean(form.branch && form.shift_type && liveBusinessDate),
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
  const liveExpenseTotal = useMemo(() => liveExpenseEvents.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [liveExpenseEvents]);
  const closingExpenseTotal = useMemo(() => expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [expenses]);
  const totalExpenses = liveExpenseTotal + closingExpenseTotal;
  const cashFundedExpenses = useMemo(() => liveExpenseEvents.filter((e) => (e.payment_source || "cash") === "cash").reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + expenses.filter((e) => (e.payment_source || "cash") === "cash").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [liveExpenseEvents, expenses]);
  const instaFundedExpenses = useMemo(() => liveExpenseEvents.filter((e) => e.payment_source === "insta").reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + expenses.filter((e) => e.payment_source === "insta").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [liveExpenseEvents, expenses]);
  const vodafoneFundedExpenses = useMemo(() => liveExpenseEvents.filter((e) => e.payment_source === "vodafone").reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + expenses.filter((e) => e.payment_source === "vodafone").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [liveExpenseEvents, expenses]);
  const expectedCashHandover = Math.max(0, derivedCashSales - cashFundedExpenses);
  // في الواجهة المبسطة الصافي النقدي يُحسب تلقائيًا من الإجمالي والتفاصيل والمصروفات.
  const actualCashHandover = expectedCashHandover;
  const cashVariance = 0;
  const visaTerminalAmount = parseFloat(visaControl.terminalAmount) || 0;
  const visaVariance = visaTerminalAmount - (parseFloat(payments.visa) || 0);
  const netAmount = paymentTotal - totalExpenses;
  const treasuryNet = netAmount;

  useEffect(() => {
    if (!form.branch || !form.shift_type || !form.employee_map_id) return;
    const hasMeaningfulDraftData =
      (parseFloat(form.total_sales) || 0) > 0 ||
      collectionDetailsTotal > 0 ||
      expenses.some((e) => (parseFloat(e.amount) || 0) > 0 || (e.category || "").trim() || (e.description || "").trim()) ||
      (form.notes || "").trim().length > 0;
    // لا ننشئ مسودة لمجرد اختيار الفرع/الشيفت/الاسم؛ لازم يكون المستخدم بدأ إدخال بيانات فعلية.
    if (!hasMeaningfulDraftData && !draftIdRef.current) return;
    const businessDate = draftBusinessDate || currentShiftBusinessDate(form.shift_type);
    const draftKey = `${form.branch}|${businessDate}|${form.shift_type}|${form.employee_map_id}`;
    if (draftKeyRef.current !== draftKey) {
      draftKeyRef.current = draftKey;
      draftIdRef.current = null;
    }
    const timer = setTimeout(async () => {
      try {
        setDraftState("جاري حفظ المسودة...");
        const payload = {
          draft_key: draftKey,
          branch: form.branch,
          business_date: businessDate,
          shift_type: form.shift_type,
          employee_map_id: form.employee_map_id,
          employee_name: employeeNameMap.find((m) => m.id === form.employee_map_id)?.canonical_name || "",
          total_sales: paymentTotal,
          cash_sales: derivedCashSales,
          visa_sales: parseFloat(payments.visa) || 0,
          insta_sales: parseFloat(payments.insta) || 0,
          vodafone_sales: parseFloat(payments.vodafone) || 0,
          other_sales: parseFloat(payments.other) || 0,
          cash_handover: actualCashHandover,
          cash_variance: cashVariance,
          visa_terminal_amount: visaTerminalAmount,
          visa_operation_count: parseInt(visaControl.operationCount, 10) || 0,
          visa_terminal_name: visaControl.terminalName || "",
          visa_batch_reference: visaControl.batchReference || "",
          expenses: expenses.map((e) => ({ description: e.description || "", amount: parseFloat(e.amount) || 0, category: e.category || "", payment_source: e.payment_source || "cash" })), 
          notes: form.notes || "",
          status: "draft",
          last_saved_at: new Date().toISOString(),
          submission_token: submissionTokenRef.current,
        };
        if (!draftIdRef.current) {
          const existing = await base44.entities.ShiftDraft.filter({ draft_key: draftKey, status: "draft" }, "-updated_date", 1);
          if (existing[0]) draftIdRef.current = existing[0].id;
        }
        if (draftIdRef.current) await base44.entities.ShiftDraft.update(draftIdRef.current, payload);
        else {
          const created = await base44.entities.ShiftDraft.create(payload);
          draftIdRef.current = created.id;
        }
        setDraftState("تم حفظ المسودة تلقائيًا");
      } catch {
        setDraftState("تعذر حفظ المسودة — البيانات ما زالت موجودة على الشاشة");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [form.branch, form.shift_type, form.employee_map_id, form.notes, payments, expenses, paymentTotal, employeeNameMap, cashHandover, cashVariance, draftBusinessDate, visaControl, visaTerminalAmount]);

  const updateExpense = (idx, field, value) => {
    setExpenses((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addExpense = () => {
    setExpenses((prev) => [...prev, { description: "", amount: "", category: "", payment_source: "cash" }]);
  };

  const removeExpense = (idx) => {
    setExpenses((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLiveExpense = async () => {
    setError("");
    if (!form.branch || !form.shift_type || !liveBusinessDate) return setError("اختر الفرع ونوع الشيفت أولًا قبل تسجيل مصروف أثناء الشيفت");
    if (!liveExpenseForm.category) return setError("اختر بند المصروف");
    const amount = parseFloat(liveExpenseForm.amount) || 0;
    if (amount <= 0) return setError("قيمة المصروف يجب أن تكون أكبر من صفر");
    setLiveExpenseSaving(true);
    try {
      await assertDailyCloseOpen(form.branch, liveBusinessDate, "تسجيل مصروف أثناء الشيفت");
      const selectedEmployee = employeeNameMap.find((m) => m.id === form.employee_map_id);
      await base44.entities.ShiftExpenseEvent.create({
        branch: form.branch,
        business_date: liveBusinessDate,
        shift_type: form.shift_type,
        employee_map_id: form.employee_map_id || "",
        employee_name: selectedEmployee?.canonical_name || "",
        category: liveExpenseForm.category,
        amount,
        note: liveExpenseForm.note || "",
        payment_source: liveExpenseForm.payment_source || "cash",
        occurred_at: new Date().toISOString(),
        status: "posted",
        source: "during_shift",
      });
      setLiveExpenseForm({ category: "", amount: "", note: "", payment_source: "cash" });
      qc.invalidateQueries({ queryKey: ["shift-expense-events", form.branch, liveBusinessDate, form.shift_type] });
    } catch (e) {
      setError(e.message || "تعذر تسجيل المصروف");
    } finally {
      setLiveExpenseSaving(false);
    }
  };

  const voidLiveExpense = async (event) => {
    const reason = window.prompt("سبب إلغاء حركة المصروف (لن يتم حذفها):");
    if (!reason?.trim()) return;
    try {
      await assertDailyCloseOpen(event.branch, event.business_date, "إلغاء حركة مصروف أثناء الشيفت");
      await base44.entities.ShiftExpenseEvent.update(event.id, { status: "voided", void_reason: reason.trim() });
      qc.invalidateQueries({ queryKey: ["shift-expense-events", form.branch, liveBusinessDate, form.shift_type] });
    } catch (e) {
      setError(e.message || "تعذر إلغاء الحركة");
    }
  };

  const handleSave = async () => {
    setError("");
    if (!form.branch) return setError("الرجاء اختيار الفرع");
    if (!form.shift_type) return setError("الرجاء اختيار نوع الشيفت");
    if (!form.employee_map_id) return setError("الرجاء اختيار اسمك الرسمي");
    if (paymentTotal <= 0) return setError("الرجاء إدخال إجمالي مبيعات الشيفت");
    if (collectionDetailsTotal > paymentTotal + 0.01) return setError("تفاصيل التحصيل لا يمكن أن تكون أكبر من إجمالي المبيعات");

    const liveExpenses = liveExpenseEvents.map((e) => ({
      description: `${e.note || ""}${e.note ? " — " : ""}مسجل أثناء الشيفت ${e.occurred_at ? new Date(e.occurred_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : ""}`.trim(),
      amount: Number(e.amount) || 0,
      category: e.category || "أخرى",
      payment_source: e.payment_source || "cash",
    }));
    const closingExpenses = expenses
      .filter((e) => e.category || parseFloat(e.amount) > 0)
      .map((e) => ({ description: e.description || "", amount: parseFloat(e.amount) || 0, category: e.category || "أخرى", payment_source: e.payment_source || "cash" }));
    const validExpenses = [...liveExpenses, ...closingExpenses];

    setSaving(true);
    try {
      const businessDate = draftBusinessDate || currentShiftBusinessDate(form.shift_type);
      await assertDailyCloseOpen(form.branch, businessDate, "تسجيل تسليم شيفت جديد");
      const selectedEmployee = employeeNameMap.find((m) => m.id === form.employee_map_id);
      if (!selectedEmployee?.admin_staff_id) {
        setError("اسم الموظف غير مربوط بحساب الإدارة");
        return;
      }

      if (draftIdRef.current) {
        await base44.entities.ShiftDraft.update(draftIdRef.current, { status: "submitting", last_saved_at: new Date().toISOString() });
      }

      // الإنشاء نفسه يتم على السيرفر بعد التحقق؛ لا يوجد مسار إنشاء مباشر من الواجهة.
      const saveRes = await base44.functions.invoke("createVerifiedShiftDelivery", {
        admin_staff_id: selectedEmployee.admin_staff_id,
        delivery: {
          branch: form.branch,
          shift_type: form.shift_type,
          business_date: businessDate,
          total_sales: paymentTotal,
          cash_sales: derivedCashSales,
          visa_sales: parseFloat(payments.visa) || 0,
          insta_sales: parseFloat(payments.insta) || 0,
          vodafone_sales: parseFloat(payments.vodafone) || 0,
          other_sales: parseFloat(payments.other) || 0,
          payment_breakdown_total: paymentTotal,
          cash_handover: actualCashHandover,
          cash_variance: 0,
          idempotency_key: submissionTokenRef.current,
          workflow_status: "submitted",
          expenses: validExpenses,
          notes: form.notes,
        },
      });
      const saved = saveRes?.data || {};
      if (!saved.success) {
        const message = saved.error || "تعذر التحقق من الهوية أو حفظ التسليم";
        if (draftIdRef.current) {
          retryCountRef.current += 1;
          await base44.entities.ShiftDraft.update(draftIdRef.current, { status: "draft", last_error: message, retry_count: retryCountRef.current, last_saved_at: new Date().toISOString() });
          qc.invalidateQueries({ queryKey: ["shift-drafts-active"] });
        }
        setError(message);
        return;
      }
      const savedShiftId = saved.record?.id || saved.id || "";
      if (draftIdRef.current) {
        await base44.entities.ShiftDraft.update(draftIdRef.current, {
          status: "submitted",
          submitted_shift_id: savedShiftId,
          last_saved_at: new Date().toISOString(),
        });
      }
      if (savedShiftId && liveExpenseEvents.length > 0) {
        await Promise.allSettled(liveExpenseEvents.map((event) => base44.entities.ShiftExpenseEvent.update(event.id, { status: "linked", linked_shift_id: savedShiftId })));
        qc.invalidateQueries({ queryKey: ["shift-expense-events"] });
      }
      let visaTrackingWarning = "";
      if (visaControl.terminalAmount !== "" && (parseFloat(payments.visa) || 0) > 0) {
        try {
          const payload = {
            shift_id: savedShiftId,
            branch: form.branch,
            business_date: businessDate,
            shift_type: form.shift_type,
            payment_method: "visa",
            expected_amount: parseFloat(payments.visa) || 0,
            terminal_amount: visaTerminalAmount,
            operation_count: parseInt(visaControl.operationCount, 10) || 0,
            variance: visaVariance,
            terminal_name: visaControl.terminalName || "",
            batch_reference: visaControl.batchReference || "",
            settlement_status: Math.abs(visaVariance) <= 1 ? "matched" : "difference",
            notes: Math.abs(visaVariance) > 1 ? (form.notes || "فرق فيزا يحتاج مراجعة") : "",
          };
          const existingVisa = savedShiftId ? await base44.entities.ShiftPaymentReconciliation.filter({ shift_id: savedShiftId, payment_method: "visa" }, "-updated_date", 1) : [];
          if (existingVisa[0]) await base44.entities.ShiftPaymentReconciliation.update(existingVisa[0].id, payload);
          else await base44.entities.ShiftPaymentReconciliation.create(payload);
          qc.invalidateQueries({ queryKey: ["shift-payment-reconciliation"] });
        } catch (visaError) {
          visaTrackingWarning = "تم حفظ الشيفت، لكن تعذر حفظ متابعة الفيزا بسبب الاتصال. لا تعِد إرسال الشيفت؛ راجع مركز متابعة الفيزا.";
          if (draftIdRef.current) {
            try { await base44.entities.ShiftDraft.update(draftIdRef.current, { status: "submitted", submitted_shift_id: savedShiftId, last_error: visaTrackingWarning, last_saved_at: new Date().toISOString() }); } catch {}
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["shift-deliveries"] });
      qc.invalidateQueries({ queryKey: ["daily-close-shifts"] });
      qc.invalidateQueries({ queryKey: ["shift-drafts-active"] });
      setForm({
        branch: "",
        shift_type: "",
        employee_map_id: "",
        total_sales: "",
        notes: "",
      });
      setPayments({ cash: "", visa: "", insta: "", vodafone: "", other: "" });
      setAdvancedCollection(false);
      setVisaControl({ terminalAmount: "", operationCount: "", terminalName: "", batchReference: "" });
      setCashHandover("");
      setExpenses([]);
      setLiveExpenseForm({ category: "", amount: "", note: "", payment_source: "cash" });
      setDraftState("");
      setDraftBusinessDate("");
      draftIdRef.current = null;
      draftKeyRef.current = "";
      retryCountRef.current = 0;
      submissionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `shift-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (visaTrackingWarning) window.alert(visaTrackingWarning);
      if (onSaved) onSaved();
    } catch (e) {
      const serverError = e?.response?.data?.error || e?.data?.error;
      const message = serverError || e?.message || "حدث خطأ أثناء الحفظ";

      if (draftIdRef.current) {
        try {
          retryCountRef.current += 1;
          await base44.entities.ShiftDraft.update(draftIdRef.current, {
            status: "draft",
            last_error: message,
            retry_count: retryCountRef.current,
            last_saved_at: new Date().toISOString(),
          });
          qc.invalidateQueries({ queryKey: ["shift-drafts-active"] });
        } catch {}
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">تسليم شفت جديد</h2>
          <p className="text-sm text-gray-500">أدخل بيانات الشفت والمصروفات</p>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        {/* Section 1: Shift Details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">بيانات الشفت</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-600">الفرع <span className="text-red-500">*</span></Label>
              <Select value={form.branch} disabled={!!initialDraft} onValueChange={(v) => { setDraftBusinessDate(""); setForm({ ...form, branch: v, employee_map_id: "" }); }}> 
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-600">نوع الشيفت <span className="text-red-500">*</span></Label>
              <Select value={form.shift_type} disabled={!!initialDraft} onValueChange={(v) => { setDraftBusinessDate(""); setForm({ ...form, shift_type: v }); }}>
                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {!initialDraft && (
                <p className="text-[11px] text-gray-500">اختر نوع الشيفت يدويًا. يمكن تسجيل نفس النوع أكثر من مرة لنفس اليوم عند الحاجة لتصحيح خطأ.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-600">تاريخ وساعة التسجيل (تلقائي — غير قابل للتعديل)</Label>
              <Input value={getRecordedAt(now)} disabled className="bg-gray-50 text-gray-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-600">اسم الموظف <span className="text-red-500">*</span></Label>
              <Select value={form.employee_map_id} disabled={!!initialDraft} onValueChange={(v) => setForm({ ...form, employee_map_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر اسمك الرسمي" /></SelectTrigger>
                <SelectContent>
                  {employeeNameMap
                    .filter((m) => {
                      const canonical = normalizeShiftEmployeeName(m.canonical_name);
                      const aliases = Array.isArray(m.aliases) ? m.aliases.map(normalizeShiftEmployeeName) : [];
                      const isDeliveryExcluded = SHIFT_DELIVERY_EXCLUDED_EMPLOYEES.has(canonical) || aliases.some((name) => SHIFT_DELIVERY_EXCLUDED_EMPLOYEES.has(name));
                      return !isDeliveryExcluded &&
                        (m.identity_verification_enabled !== false && !!m.admin_staff_id) &&
                        (!form.branch || m.branch === "كل الفروع" || m.branch?.trim() === form.branch?.trim());
                    })
                    .map((m) => <SelectItem key={m.id} value={m.id}>{m.canonical_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px] space-y-1.5">
                <Label className="text-sm font-bold text-slate-800">إجمالي مبيعات الشيفت *</Label>
                <Input type="number" min="0" step="0.01" value={form.total_sales} onChange={(e) => setForm((f) => ({ ...f, total_sales: e.target.value }))} placeholder="0.00" className="h-12 bg-white text-lg font-bold" />
              </div>
              <Button type="button" variant="outline" onClick={() => setAdvancedCollection((v) => !v)} className="h-12 border-indigo-200 text-indigo-700 bg-white">
                <Plus className={`w-4 h-4 transition-transform ${advancedCollection ? "rotate-45" : ""}`} />
                {advancedCollection ? "إخفاء التفاصيل" : "إضافة تفاصيل"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">إجمالي المبيعات هو الرقم الأساسي. تفاصيل التحصيل اختيارية وتُخصم منه تلقائيًا لإظهار الصافي المتبقي.</p>

            {advancedCollection && (
              <div className="space-y-3 border-t border-indigo-100 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key:"insta", label:"إنستا باي", Icon:Landmark },
                    { key:"vodafone", label:"فودافون كاش", Icon:Smartphone },
                    { key:"visa", label:"فيزا", Icon:CreditCard },
                    { key:"other", label:"تحويل", Icon:Wallet },
                  ].map(({key,label,Icon}) => (
                    <div key={key} className="rounded-xl border bg-white p-3">
                      <div className="flex items-center gap-2 mb-2 text-slate-600"><Icon className="w-4 h-4"/><Label className="text-xs font-bold">{label}</Label></div>
                      <Input type="number" min="0" value={payments[key]} onChange={(e) => setPayments((p) => ({ ...p, [key]: e.target.value }))} placeholder="0" className="h-10 bg-white" />
                    </div>
                  ))}
                </div>
                <div className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${collectionDetailsTotal > paymentTotal ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي التفاصيل</p>
                    <p className="font-bold text-gray-800">{fmt(collectionDetailsTotal)} ج</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-500">الصافي قبل المصروفات</p>
                    <p className={`text-xl font-black ${collectionDetailsTotal > paymentTotal ? "text-red-600" : "text-emerald-700"}`}>{fmt(paymentTotal - collectionDetailsTotal)} ج</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Expenses */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <div><h3 className="text-sm font-semibold text-gray-700">المصروفات</h3><p className="text-[11px] text-gray-400 mt-0.5">أضف أي مصروفات تخص الشيفت. اتركها فارغة لو مفيش مصروفات.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={addExpense} className="text-blue-600 border-blue-200 hover:bg-blue-50">
              <Plus className="w-4 h-4" /> إضافة بند
            </Button>
          </div>
          <div className="space-y-3">
            {expenses.length === 0 && <p className="text-xs text-gray-400 py-1">لا توجد مصروفات — إضافة المصروفات اختيارية.</p>}
            {expenses.map((exp, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => removeExpense(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Select value={exp.category} onValueChange={(v) => updateExpense(idx, "category", v)}>
                    <SelectTrigger className="flex-1 w-1/2"><SelectValue placeholder="اختر بند المصروف" /></SelectTrigger>
                    <SelectContent>
                      {activeExpenseItems.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="القيمة"
                    value={exp.amount}
                    onChange={(e) => updateExpense(idx, "amount", e.target.value)}
                    className="flex-1 w-1/2"
                  />

                </div>
                <Input
                  placeholder="تسجيل ملاحظة"
                  value={exp.description}
                  onChange={(e) => updateExpense(idx, "description", e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gray-700">الصافي</p>
            <p className="text-[11px] text-gray-400">إجمالي المبيعات − تفاصيل التحصيل − المصروفات</p>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800">{fmt(paymentTotal)} ج مبيعات</p>
            {collectionDetailsTotal > 0 && <p className="text-sm text-blue-600">− {fmt(collectionDetailsTotal)} ج تفاصيل تحصيل</p>}
            {totalExpenses > 0 && <p className="text-sm text-red-600">− {fmt(totalExpenses)} ج مصروفات</p>}
            <p className="text-xl font-black text-indigo-700">= {fmt(paymentTotal - collectionDetailsTotal - totalExpenses)} ج</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm text-gray-600">ملاحظات الشيفت</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="سبب فرق الكاش أو أي ملاحظة مهمة..." />
          {draftState && <p className="text-[11px] text-gray-500">{draftState}</p>}
        </div>

        {error && <p className="text-sm text-red-600 text-center font-medium">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التسليم
        </Button>
      </Card>
    </div>
  );
}