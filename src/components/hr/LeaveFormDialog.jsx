import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);

export default function LeaveFormDialog({ open, onOpenChange, onSubmit, employees }) {
  const [form, setForm] = useState({
    employee_name: "", branch: "", start_date: today(), end_date: today(), days: 1, type: "سنوية", status: "موافق", notes: "",
  });

  useEffect(() => {
    setForm({ employee_name: "", branch: "", start_date: today(), end_date: today(), days: 1, type: "سنوية", status: "موافق", notes: "" });
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) set("days", diff);
    }
  }, [form.start_date, form.end_date]);

  useEffect(() => {
    if (form.employee_name) {
      const emp = employees.find((e) => e.name === form.employee_name);
      if (emp?.branches?.[0]) set("branch", emp.branches[0]);
    }
  }, [form.employee_name]);

  const handleSubmit = () => {
    if (!form.employee_name || !form.start_date) return;
    onSubmit({ ...form, days: Number(form.days) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة إجازة</DialogTitle>
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
              <Label className="text-xs">من تاريخ *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">عدد الأيام (تلقائي)</Label>
              <Input type="number" value={form.days} onChange={(e) => set("days", e.target.value)} className="h-9" min="1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نوع الإجازة</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="سنوية">سنوية</SelectItem>
                  <SelectItem value="عرضية">عرضية</SelectItem>
                  <SelectItem value="مرضية">مرضية</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
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