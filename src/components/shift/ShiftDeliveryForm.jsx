import { useState, useMemo, useEffect } from "react";
import { getRecordedAt } from "@/lib/shiftUtils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Wallet, Plus, Trash2, Save, Loader2 } from "lucide-react";


const BRANCHES = ["دواء شكري", "دواء الشامي"];
const SHIFT_TYPES = ["صباحي", "مسائي", "ليلي"];

export default function ShiftDeliveryForm({ onSaved }) {
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
  const activeExpenseItems = expenseItems.filter((i) => i.is_active !== false);

  const [form, setForm] = useState({
    branch: "",
    shift_type: "",
    employee_map_id: "",
    pin: "",
    total_sales: "",
    notes: "",
  });
  const [expenses, setExpenses] = useState([{ description: "", amount: "", category: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // تاريخ ووقت التسجيل يظهر تلقائيًا ولا يمكن للمستخدم تعديله
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [expenses]
  );
  const netAmount = (parseFloat(form.total_sales) || 0) - totalExpenses;

  const updateExpense = (idx, field, value) => {
    setExpenses((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addExpense = () => {
    setExpenses((prev) => [...prev, { description: "", amount: "", category: "" }]);
  };

  const removeExpense = (idx) => {
    setExpenses((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setError("");
    if (!form.branch) return setError("الرجاء اختيار الفرع");
    if (!form.shift_type) return setError("الرجاء اختيار نوع الشيفت");
    if (!form.employee_map_id) return setError("الرجاء اختيار اسمك الرسمي");
    if (!form.pin) return setError("الرجاء إدخال الرقم السري الخاص بك");
    if (!form.total_sales || parseFloat(form.total_sales) <= 0) return setError("الرجاء إدخال إجمالي مبيعات الشيفت");

    const validExpenses = expenses
      .filter((e) => e.category || parseFloat(e.amount) > 0)
      .map((e) => ({
        description: e.description || "",
        amount: parseFloat(e.amount) || 0,
        category: e.category || "أخرى",
      }));

    setSaving(true);
    try {
      const selectedEmployee = employeeNameMap.find((m) => m.id === form.employee_map_id);
      if (!selectedEmployee?.admin_staff_id) {
        setError("اسم الموظف غير مربوط بحساب الإدارة");
        return;
      }

      // الإنشاء نفسه يتم على السيرفر بعد التحقق؛ لا يوجد مسار إنشاء مباشر من الواجهة.
      const saveRes = await base44.functions.invoke("createVerifiedShiftDelivery", {
        admin_staff_id: selectedEmployee.admin_staff_id,
        credential: form.pin,
        delivery: {
          branch: form.branch,
          shift_type: form.shift_type,
          total_sales: parseFloat(form.total_sales) || 0,
          expenses: validExpenses,
          notes: form.notes,
        },
      });
      const saved = saveRes?.data || {};
      if (!saved.success) {
        setError(saved.error || "تعذر التحقق من الهوية أو حفظ التسليم");
        return;
      }
      qc.invalidateQueries({ queryKey: ["shift-deliveries"] });
      setForm({
        branch: "",
        shift_type: "",
        employee_map_id: "",
        pin: "",
        total_sales: "",
        notes: "",
      });
      setExpenses([{ description: "", amount: "", category: "" }]);
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message || "حدث خطأ أثناء الحفظ");
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
              <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v, employee_map_id: "", pin: "" })}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Input value={getRecordedAt(now)} disabled className="bg-gray-50 text-gray-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-600">اسم الموظف <span className="text-red-500">*</span></Label>
              <Select value={form.employee_map_id} onValueChange={(v) => setForm({ ...form, employee_map_id: v, pin: "" })}>
                <SelectTrigger><SelectValue placeholder="اختر اسمك الرسمي" /></SelectTrigger>
                <SelectContent>
                  {employeeNameMap
                    .filter((m) => (m.identity_verification_enabled !== false && !!m.admin_staff_id) && (!form.branch || m.branch === "كل الفروع" || m.branch?.trim() === form.branch?.trim()))
                    .map((m) => <SelectItem key={m.id} value={m.id}>{m.canonical_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-600">الرقم السري الخاص بك <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                placeholder="أدخل الرقم السري من تطبيق الإدارة"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                className="text-lg tracking-widest"
                autoComplete="current-password"
              />
              <p className="text-[11px] text-gray-400">لن يتم قبول التسليم إلا إذا كان الرقم السري يخص الاسم المختار فعليًا. الموظف غير المرتبط بحساب في تطبيق الإدارة لا يظهر في قائمة التسليم.</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label className="text-sm text-gray-600">إجمالي مبيعات الشيفت (ج.م) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              placeholder="0"
              value={form.total_sales}
              onChange={(e) => setForm({ ...form, total_sales: e.target.value })}
              className="text-lg font-semibold"
            />
          </div>
        </div>

        {/* Section 2: Expenses */}
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

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

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