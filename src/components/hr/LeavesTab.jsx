import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, CalendarDays, Users } from "lucide-react";
import LeaveFormDialog from "./LeaveFormDialog";
import QuickAddEmployeeDialog from "./QuickAddEmployeeDialog";

const currentYear = new Date().getFullYear();
const statusColor = {
  "موافق": "bg-green-100 text-green-700 border-0",
  "بانتظار": "bg-yellow-100 text-yellow-700 border-0",
  "مرفوض": "bg-red-100 text-red-700 border-0",
};
const typeColor = {
  "سنوية": "bg-teal-50 text-teal-700 border-0",
  "عرضية": "bg-blue-50 text-blue-700 border-0",
  "مرضية": "bg-orange-50 text-orange-700 border-0",
  "أخرى": "bg-gray-100 text-gray-600 border-0",
};

export default function LeavesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["employee-leaves"],
    queryFn: () => base44.entities.EmployeeLeave.list("-created_date", 500),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.EmployeeLeave.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-leaves"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EmployeeLeave.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-leaves"] }),
  });

  const balances = useMemo(() => {
    const yearLeaves = leaves.filter((l) => {
      if (l.status !== "موافق") return false;
      const d = l.start_date ? new Date(l.start_date) : null;
      return d && d.getFullYear() === currentYear;
    });
    return employees.map((emp) => {
      const taken = yearLeaves
        .filter((l) => l.employee_name === emp.name)
        .reduce((s, l) => s + (l.days || 0), 0);
      const entitlement = emp.annual_leave_entitlement ?? 21;
      return { name: emp.name, entitlement, taken, remaining: Math.max(entitlement - taken, 0) };
    });
  }, [leaves, employees]);

  const yearCount = leaves.filter((l) => {
    const d = l.start_date ? new Date(l.start_date) : null;
    return d && d.getFullYear() === currentYear;
  }).length;

  const yearDays = leaves
    .filter((l) => {
      if (l.status !== "موافق") return false;
      const d = l.start_date ? new Date(l.start_date) : null;
      return d && d.getFullYear() === currentYear;
    })
    .reduce((s, l) => s + (l.days || 0), 0);

  const filtered = leaves.filter((l) => !search || l.employee_name?.includes(search));

  const handleSubmit = (data) => createMut.mutate(data);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100"><CalendarDays className="w-5 h-5 text-teal-600" /></div>
          <div><p className="text-xs text-gray-500">إجازات هذا العام</p><p className="text-lg font-bold">{yearCount}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><CalendarDays className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">إجمالي الأيام</p><p className="text-lg font-bold">{yearDays}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100"><Users className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-gray-500">عدد الموظفين</p><p className="text-lg font-bold">{employees.length}</p></div>
        </Card>
      </div>

      {/* Balance Cards */}
      <div>
        <h3 className="font-semibold text-sm mb-2">رصيد الإجازات السنوية لكل موظف</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {balances.map((b) => {
            const pct = b.entitlement > 0 ? Math.min((b.taken / b.entitlement) * 100, 100) : 0;
            const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-teal-500";
            return (
              <Card key={b.name} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{b.name}</span>
                  <Badge className="bg-teal-50 text-teal-700 border-0">متبقي {b.remaining} يوم</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>المستخدم: {b.taken} يوم</span>
                    <span>الرصيد: {b.entitlement} يوم</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
          {balances.length === 0 && <p className="text-sm text-gray-400 col-span-full">لا يوجد موظفون</p>}
        </div>
      </div>

      {/* Records */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">سجل الإجازات</h3>
        <div className="flex items-center gap-2">
          <QuickAddEmployeeDialog />
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" /> إضافة إجازة</Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">لا توجد إجازات</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.slice(0, 100).map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm">{l.employee_name}</p>
                    <Badge className={typeColor[l.type] || "bg-gray-100"}>{l.type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{l.start_date} → {l.end_date} • {l.days} يوم</p>
                  {l.notes && <p className="text-xs text-gray-400 truncate">{l.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusColor[l.status] || "bg-gray-100"}>{l.status}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteMut.mutate(l.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <LeaveFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} employees={employees} />
    </div>
  );
}