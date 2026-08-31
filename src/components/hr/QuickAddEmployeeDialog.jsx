import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

const BRANCHES = ["دواء شكري", "دواء الشامي"];

export default function QuickAddEmployeeDialog({ onAdded }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    branches: [],
    annual_leave_entitlement: 21,
    permission_hours_entitlement: 24,
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        role: "",
        phone: "",
        branches: [],
        annual_leave_entitlement: 21,
        permission_hours_entitlement: 24,
      });
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.TeamMember.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setOpen(false);
      onAdded?.(created);
    },
  });

  const toggleBranch = (b) => {
    setForm((f) => ({
      ...f,
      branches: f.branches.includes(b)
        ? f.branches.filter((x) => x !== b)
        : [...f.branches, b],
    }));
  };

  const canSubmit = form.name.trim() && form.branches.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMut.mutate({
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      phone: form.phone.trim() || undefined,
      branches: form.branches,
      annual_leave_entitlement: Number(form.annual_leave_entitlement) || 21,
      permission_hours_entitlement: Number(form.permission_hours_entitlement) || 24,
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-teal-200 text-teal-700 hover:bg-teal-50"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="w-4 h-4" /> إضافة موظف
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-600" />
              إضافة موظف جديد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">اسم الموظف *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اكتب الاسم..."
                dir="rtl"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">المسمى الوظيفي</Label>
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="مثال: صيدلي"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">رقم الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">الفرع *</Label>
              <div className="flex flex-wrap gap-2">
                {BRANCHES.map((b) => {
                  const active = form.branches.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBranch(b)}
                      className={
                        "px-3 py-1.5 rounded-md border text-sm transition-colors " +
                        (active
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")
                      }
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">رصيد الإجازات (يوم)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.annual_leave_entitlement}
                  onChange={(e) => setForm({ ...form, annual_leave_entitlement: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">رصيد الإذونات (ساعة)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.permission_hours_entitlement}
                  onChange={(e) => setForm({ ...form, permission_hours_entitlement: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            {createMut.isError && (
              <p className="text-xs text-red-500">
                حدث خطأ أثناء الإضافة: {createMut.error?.message || "حاول مرة أخرى"}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button
              disabled={!canSubmit || createMut.isPending}
              onClick={handleSubmit}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {createMut.isPending ? "جاري الحفظ..." : "حفظ الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}