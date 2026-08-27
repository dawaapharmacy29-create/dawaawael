import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Clock, Users } from "lucide-react";
import PermissionFormDialog from "./PermissionFormDialog";

const currentYear = new Date().getFullYear();
const statusColor = {
  "موافق": "bg-green-100 text-green-700 border-0",
  "بانتظار": "bg-yellow-100 text-yellow-700 border-0",
  "مرفوض": "bg-red-100 text-red-700 border-0",
};

export default function PermissionsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["employee-permissions"],
    queryFn: () => base44.entities.EmployeePermission.list("-created_date", 500),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.EmployeePermission.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-permissions"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EmployeePermission.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-permissions"] }),
  });

  const balances = useMemo(() => {
    const yearPerms = permissions.filter((p) => {
      if (p.status !== "موافق") return false;
      const d = p.date ? new Date(p.date) : null;
      return d && d.getFullYear() === currentYear;
    });
    return employees.map((emp) => {
      const used = yearPerms
        .filter((p) => p.employee_name === emp.name)
        .reduce((s, p) => s + (p.hours || 0), 0);
      const entitlement = emp.permission_hours_entitlement ?? 24;
      return { name: emp.name, entitlement, used, remaining: Math.max(entitlement - used, 0) };
    });
  }, [permissions, employees]);

  const yearCount = permissions.filter((p) => {
    const d = p.date ? new Date(p.date) : null;
    return d && d.getFullYear() === currentYear;
  }).length;

  const filtered = permissions.filter((p) => !search || p.employee_name?.includes(search));

  const handleSubmit = (data) => createMut.mutate(data);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><Clock className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">إذونات هذا العام</p><p className="text-lg font-bold">{yearCount}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100"><Users className="w-5 h-5 text-teal-600" /></div>
          <div><p className="text-xs text-gray-500">عدد الموظفين</p><p className="text-lg font-bold">{employees.length}</p></div>
        </Card>
      </div>

      {/* Balance Cards */}
      <div>
        <h3 className="font-semibold text-sm mb-2">رصيد الإذونات لكل موظف</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {balances.map((b) => {
            const pct = b.entitlement > 0 ? Math.min((b.used / b.entitlement) * 100, 100) : 0;
            const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-teal-500";
            return (
              <Card key={b.name} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{b.name}</span>
                  <Badge className="bg-teal-50 text-teal-700 border-0">{b.remaining} ساعة</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>المستخدم: {b.used} ساعة</span>
                    <span>الرصيد: {b.entitlement} ساعة</span>
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
        <h3 className="font-semibold text-sm">سجل الإذونات</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" /> إضافة إذن</Button>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">لا توجد إذونات</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.slice(0, 100).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{p.employee_name}</p>
                  <p className="text-xs text-gray-500">{p.date} • {p.type} ({p.hours} ساعة)</p>
                  {p.reason && <p className="text-xs text-gray-400 truncate">{p.reason}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusColor[p.status] || "bg-gray-100"}>{p.status}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <PermissionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} employees={employees} />
    </div>
  );
}