import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Loader2, CalendarClock } from "lucide-react";
import { assertDailyCloseOpen } from "@/lib/dailyCloseGuard";
import { shiftFinancialView } from "@/lib/shiftFinancials";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const SHIFT_TYPES = ["صباحي", "مسائي", "ليلي"];
const PAYMENT_EXPENSE_NAMES = new Set(["انستا", "فيزا", "فودافون كاش", "فودافون", "Visa", "Insta"]);

export default function ShiftDeliveryEditDialog({ item, onClose }) {
  const qc = useQueryClient();

  const { data: expenseItems = [] } = useQuery({
    queryKey: ["expense-items"],
    queryFn: () => base44.entities.ExpenseItem.list(),
    staleTime: 60000,
  });
  const activeExpenseItems = expenseItems.filter((i) => i.is_active !== false && !PAYMENT_EXPENSE_NAMES.has((i.name || "").trim()));
  const initialFinancial = useMemo(() => shiftFinancialView(item), [item]);

  const [form, setForm] = useState({
    shift_type: item.shift_type || "",
    shift_date: item.shift_date || "",
    total_sales: item.total_sales || "",
    notes: item.notes || "",
    calculation_date: item.calculation_date || item.shift_date || "",
  });
  const [payments, setPayments] = useState({
    cash: initialFinancial.payments.cash || "",
    visa: initialFinancial.payments.visa || "",
    insta: initialFinancial.payments.insta || "",
    vodafone: initialFinancial.payments.vodafone || "",
    other: initialFinancial.payments.other || "",
  });
  const [cashHandover, setCashHandover] = useState(item.cash_handover ?? "");
  const [expenses, setExpenses] = useState(
    initialFinancial.realExpenses.length > 0
      ? initialFinancial.realExpenses.map((e) => ({ description: e.description || "", amount: e.amount || "", category: e.category || "" }))
      : [{ description: "", amount: "", category: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const paymentTotal = useMemo(() => Object.values(payments).reduce((sum, v) => sum + (parseFloat(v) || 0), 0), [payments]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [expenses]);
  const expectedCashHandover = Math.max(0, (parseFloat(payments.cash) || 0) - totalExpenses);
  const actualCashHandover = parseFloat(cashHandover) || 0;
  const cashVariance = actualCashHandover - expectedCashHandover;
  const netAmount = paymentTotal - totalExpenses;

  const updateExpense = (idx, field, value) => {
    setExpenses((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addExpense = () => setExpenses((prev) => [...prev, { description: "", amount: "", category: "" }]);

  const removeExpense = (idx) => setExpenses((prev) => prev.filter((_, i) => i !== idx));

  const setPreviousDay = () => {
    const base = form.calculation_date || item.shift_date;
    if (!base) return;
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    const prevDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setForm((f) => ({ ...f, calculation_date: prevDay }));
  };

  const handleSave = async () => {
    setError("");
    if (!form.shift_type) return setError("الرجاء اختيار نوع الشيفت");
    if (paymentTotal <= 0) return setError("الرجاء إدخال تفصيل المبيعات حسب وسيلة التحصيل");
    if ((parseFloat(payments.cash) || 0) > 0 && cashHandover === "") return setError("الرجاء إدخال الكاش الفعلي المسلم");
    if (Math.abs(cashVariance) > 1 && !(form.notes || "").trim()) return setError(`يوجد فرق كاش ${cashVariance.toFixed(2)} ج — اكتب سبب الفرق في الملاحظات`);

    const validExpenses = expenses
      .filter((e) => e.category || parseFloat(e.amount) > 0)
      .map((e) => ({
        description: e.description || "",
        amount: parseFloat(e.amount) || 0,
        category: e.category || "أخرى",
      }));

    setSaving(true);
    try {
      await assertDailyCloseOpen(item.branch, item.shift_date, "تعديل تسليم الشيفت");
      const targetDate = form.calculation_date || item.shift_date;
      if (targetDate && targetDate !== item.shift_date) {
        await assertDailyCloseOpen(item.branch, targetDate, "تغيير تاريخ احتساب الشيفت");
      }
      const updateRes = await base44.functions.invoke("updateShiftDeliveryAdmin", {
        id: item.id,
        action: "update",
        updates: {
          shift_type: form.shift_type,
          calculation_date: form.calculation_date || item.shift_date,
          total_sales: paymentTotal,
          cash_sales: parseFloat(payments.cash) || 0,
          visa_sales: parseFloat(payments.visa) || 0,
          insta_sales: parseFloat(payments.insta) || 0,
          vodafone_sales: parseFloat(payments.vodafone) || 0,
          other_sales: parseFloat(payments.other) || 0,
          payment_breakdown_total: paymentTotal,
          cash_handover: actualCashHandover,
          cash_variance: cashVariance,
          total_expenses: totalExpenses,
          net_amount: netAmount,
          expenses: validExpenses,
          workflow_status: Math.abs(cashVariance) > 1 ? "under_review" : (item.workflow_status || "submitted"),
          notes: form.notes,
        },
      });
      const result = updateRes?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر تعديل تسليم الشيفت");
      qc.invalidateQueries({ queryKey: ["shift-deliveries"] });
      qc.invalidateQueries({ queryKey: ["daily-close-shifts"] });
      onClose();
    } catch (e) {
      setError(e.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل تسليم الشيفت</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Shift Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">بيانات الشفت</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">الفرع (مثبت عند التحقق)</Label>
                <Input value={item.branch || ""} disabled className="bg-gray-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">نوع الشيفت <span className="text-red-500">*</span></Label>
                <Select value={form.shift_type} onValueChange={(v) => setForm({ ...form, shift_type: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                  <SelectContent>
                    {SHIFT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">تاريخ وساعة التسجيل (تلقائي — غير قابل للتعديل)</Label>
                <Input value={item.recorded_at || item.shift_date || ""} disabled className="bg-gray-50 text-gray-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">تاريخ الاحتساب</Label>
                <Input
                  type="date"
                  value={form.calculation_date}
                  onChange={(e) => setForm({ ...form, calculation_date: e.target.value })}
                  className="bg-amber-50 text-gray-700"
                />
                <Button type="button" variant="outline" size="sm" onClick={setPreviousDay} className="w-full text-amber-700 border-amber-300 hover:bg-amber-50 gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" /> تسجيله لليوم السابق
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">الموظف المسؤول (هوية متحقق منها)</Label>
                <Input value={item.submitted_by || ""} disabled className="bg-gray-50" />
                <p className="text-[11px] text-gray-400">لا يمكن تغيير هوية صاحب التسليم بعد التحقق والحفظ.</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
              <div><h4 className="text-sm font-bold text-blue-900">تفصيل المبيعات حسب وسيلة التحصيل</h4>{initialFinancial.legacy && <p className="text-[11px] text-amber-700 mt-1">السجل قديم؛ تم استنتاج وسائل الدفع من البنود القديمة للمراجعة قبل الحفظ.</p>}</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[["cash","كاش"],["visa","فيزا"],["insta","إنستا"],["vodafone","فودافون كاش"],["other","أخرى"]].map(([key,label]) => <div key={key} className="space-y-1"><Label className="text-xs">{label}</Label><Input type="number" min="0" value={payments[key]} onChange={(e)=>setPayments((p)=>({...p,[key]:e.target.value}))} placeholder="0" className="h-9"/></div>)}
              </div>
              <div className="flex justify-between border-t pt-2"><span className="text-sm font-semibold">إجمالي المبيعات</span><span className="font-black text-blue-700">{fmt(paymentTotal)} ج.م</span></div>
            </div>
          </div>

          {/* Expenses */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-sm font-semibold text-gray-700">مصروفات الشفت</h3>
              <Button type="button" variant="outline" size="sm" onClick={addExpense} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <Plus className="w-4 h-4" /> إضافة بند
              </Button>
            </div>
            <div className="space-y-3">
              {expenses.map((exp, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => removeExpense(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                      disabled={expenses.length === 1}
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

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
            <h3 className="text-sm font-bold text-emerald-900">مطابقة الكاش</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="rounded-lg bg-white p-3 border"><p className="text-xs text-gray-500">الكاش المتوقع</p><p className="font-bold">{fmt(expectedCashHandover)} ج.م</p></div><div className="space-y-1"><Label className="text-xs">الكاش الفعلي المسلم</Label><Input type="number" min="0" value={cashHandover} onChange={(e)=>setCashHandover(e.target.value)} className="bg-white"/></div><div className={`rounded-lg p-3 border ${Math.abs(cashVariance)<=1?"bg-emerald-50":"bg-red-50"}`}><p className="text-xs text-gray-500">فرق الكاش</p><p className={`font-black ${Math.abs(cashVariance)<=1?"text-emerald-700":"text-red-700"}`}>{fmt(cashVariance)} ج.م</p></div></div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">إجمالي المصروفات</span>
              <span className="text-lg font-bold text-gray-800">{fmt(totalExpenses)} ج.م</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-semibold text-gray-700">صافي التسليم</span>
              <span className="text-2xl font-bold text-indigo-600">{fmt(netAmount)} ج.م</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm text-gray-600">ملاحظات</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية" />
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}