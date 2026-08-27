import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);

export default function LoanFormDialog({ open, onOpenChange, onSubmit, initial, employees }) {
  const [form, setForm] = useState({
    employee_name: "", branch: "", amount: "", date: today(),
    installments_count: 1, monthly_deduction: 0, paid_amount: 0,
    status: "نشطة", notes: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({ ...initial });
    } else {
      setForm({ employee_name: "", branch: "", amount: "", date: today(), installments_count: 1, monthly_deduction: 0, paid_amount: 0, status: "نشطة", notes: "" });
    }
  }, [initial, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // auto-set branch from employee + calculate monthly deduction
  useEffect(() => {
    if (form.employee_name) {
      const emp = employees.find((e) => e.name === form.employee_name);
      if (emp?.branches?.[0] && !form.branch) set("branch", emp.branches[0]);
    }
  }, [form.employee_name]);

  useEffect(() => {
    const amount = Number(form.amount) || 0;
    const count = Number(form.installments_count) || 1;
    if (amount > 0 && count > 0) {
      setForm((f) => ({ ...f, monthly_deduction: Math.ceil(amount / count) }));
    }
  }, [form.amount, form.installments_count]);

  const handleSubmit = () => {
    if (!form.employee_name || !form.amount || !form.date) return;
    onSubmit({
      ...form,
      amount: Number(form.amount),
      installments_count: Number(form.installments_count),
      monthly_deduction: Number(form.monthly_deduction),
      paid_amount: Number(form.paid_amount) || 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{initial ? "تعديل سلفة" : "إضافة سلفة"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">الموظف *</Label>
            <Select value={form.employee_name} onValueChange={(v) => set("employee_name", v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">المبلغ *</Label>
              <Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تاريخ السلفة *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">عدد الأقساط</Label>
              <Input type="number" value={form.installments_count} onChange={(e) => set("installments_count", e.target.value)} className="h-9" min="1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">القسط الشهري (تلقائي)</Label>
              <Input type="number" value={form.monthly_deduction} readOnly className="h-9 bg-gray-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">المبلغ المسدد</Label>
              <Input type="number" value={form.paid_amount} onChange={(e) => set("paid_amount", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الحالة</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نشطة">نشطة</SelectItem>
                  <SelectItem value="مكتملة">مكتملة</SelectItem>
                  <SelectItem value="ملغاة">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Input value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button onClick={handleSubmit}>حفظ</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}