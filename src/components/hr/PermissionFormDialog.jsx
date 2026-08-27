import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);
const TYPE_HOURS = { "ساعة": 2, "نصف يوم": 4, "يوم كامل": 8 };

export default function PermissionFormDialog({ open, onOpenChange, onSubmit, employees }) {
  const [form, setForm] = useState({
    employee_name: "", branch: "", date: today(), type: "ساعة", hours: 2, reason: "", status: "موافق",
  });

  useEffect(() => {
    setForm({ employee_name: "", branch: "", date: today(), type: "ساعة", hours: 2, reason: "", status: "موافق" });
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTypeChange = (v) => {
    setForm((f) => ({ ...f, type: v, hours: TYPE_HOURS[v] || f.hours }));
  };

  useEffect(() => {
    if (form.employee_name) {
      const emp = employees.find((e) => e.name === form.employee_name);
      if (emp?.branches?.[0]) set("branch", emp.branches[0]);
    }
  }, [form.employee_name]);

  const handleSubmit = () => {
    if (!form.employee_name || !form.date) return;
    onSubmit({ ...form, hours: Number(form.hours) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة إذن</DialogTitle>
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
              <Label className="text-xs">التاريخ *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نوع الإذن</Label>
              <Select value={form.type} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ساعة">ساعة</SelectItem>
                  <SelectItem value="نصف يوم">نصف يوم</SelectItem>
                  <SelectItem value="يوم كامل">يوم كامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">عدد الساعات</Label>
              <Input type="number" value={form.hours} onChange={(e) => set("hours", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الحالة</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="موافق">موافق</SelectItem>
                  <SelectItem value="بانتظار">بانتظار</SelectItem>
                  <SelectItem value="مرفوض">مرفوض</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">السبب</Label>
            <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="سبب الإذن" className="h-9" />
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