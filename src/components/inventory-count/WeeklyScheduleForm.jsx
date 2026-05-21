import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Users } from "lucide-react";

const DAY_FIELDS = [
  { key: "saturday_employee", label: "السبت" },
  { key: "sunday_employee", label: "الأحد" },
  { key: "monday_employee", label: "الاثنين" },
  { key: "tuesday_employee", label: "الثلاثاء" },
  { key: "wednesday_employee", label: "الأربعاء" },
  { key: "thursday_employee", label: "الخميس" },
  { key: "friday_employee", label: "الجمعة" },
];

const defaultForm = (branch) => ({
  branch,
  saturday_employee: "",
  sunday_employee: "",
  monday_employee: "",
  tuesday_employee: "",
  wednesday_employee: "",
  thursday_employee: "",
  friday_employee: "",
  items_per_day: 20,
});

export default function WeeklyScheduleForm({ branch, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultForm(branch));

  const { data: schedules = [] } = useQuery({
    queryKey: ["weekly-schedule", branch],
    queryFn: () => base44.entities.WeeklySchedule.filter({ branch }),
  });

  const existing = schedules[0];

  useEffect(() => {
    if (existing) setForm({ ...defaultForm(branch), ...existing });
  }, [existing, branch]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      existing
        ? base44.entities.WeeklySchedule.update(existing.id, data)
        : base44.entities.WeeklySchedule.create(data),
    onSuccess: () => {
      qc.invalidateQueries(["weekly-schedule", branch]);
      onClose?.();
    },
  });

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-2 text-teal-700">
        <Users className="w-5 h-5" />
        <h3 className="font-bold text-base">جدول الموظفين الأسبوعي — {branch}</h3>
      </div>

      <div className="space-y-1">
        <Label>عدد الأصناف اليومي</Label>
        <Input
          type="number"
          min={1}
          max={200}
          className="w-32"
          value={form.items_per_day}
          onChange={e => setForm(p => ({ ...p, items_per_day: Number(e.target.value) }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {DAY_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 w-20 shrink-0">{label}</span>
            <Input
              placeholder={`موظف ${label}`}
              value={form[key] || ""}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              className="flex-1 h-8 text-sm"
            />
          </div>
        ))}
      </div>

      <Button
        className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
      >
        <Save className="w-4 h-4" />
        {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الجدول"}
      </Button>
    </div>
  );
}