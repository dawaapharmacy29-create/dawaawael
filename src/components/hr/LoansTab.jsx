import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LoanFormDialog from "./LoanFormDialog";
import QuickAddEmployeeDialog from "./QuickAddEmployeeDialog";

const statusColor = {
  "نشطة": "bg-teal-100 text-teal-700 border-0",
  "مكتملة": "bg-green-100 text-green-700 border-0",
  "ملغاة": "bg-gray-100 text-gray-500 border-0",
};

export default function LoansTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["employee-loans"],
    queryFn: () => base44.entities.EmployeeLoan.list("-created_date", 500),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.EmployeeLoan.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmployeeLoan.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EmployeeLoan.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
  });

  const activeLoans = loans.filter((l) => l.status === "نشطة");
  const totalAmount = activeLoans.reduce((s, l) => s + (l.amount || 0), 0);
  const totalRemaining = activeLoans.reduce((s, l) => s + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  const filtered = loans.filter((l) => !search || l.employee_name?.includes(search));

  const handleSubmit = (data) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100"><Wallet className="w-5 h-5 text-teal-600" /></div>
          <div><p className="text-xs text-gray-500">سلف نشطة</p><p className="text-lg font-bold">{activeLoans.length}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">إجمالي السلف</p><p className="text-lg font-bold">{totalAmount.toLocaleString("ar-EG")}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-2 rounded-lg bg-orange-100"><AlertCircle className="w-5 h-5 text-orange-600" /></div>
          <div><p className="text-xs text-gray-500">متبقي للسداد</p><p className="text-lg font-bold text-orange-600">{totalRemaining.toLocaleString("ar-EG")}</p></div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="max-w-xs h-9" dir="rtl" />
        <div className="flex items-center gap-2">
          <QuickAddEmployeeDialog />
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4" /> إضافة سلفة</Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">لا توجد سلف</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>الموظف</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الأقساط</TableHead>
                    <TableHead>شهري</TableHead>
                    <TableHead>المسدد</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const remaining = (l.amount || 0) - (l.paid_amount || 0);
                    return (
                      <TableRow key={l.id} className="hover:bg-gray-50">
                        <TableCell className="font-semibold">{l.employee_name}</TableCell>
                        <TableCell className="font-bold">{(l.amount || 0).toLocaleString("ar-EG")}</TableCell>
                        <TableCell className="text-gray-600 text-sm">{l.date}</TableCell>
                        <TableCell className="text-gray-600">{l.installments_count || 1}</TableCell>
                        <TableCell className="text-gray-600">{(l.monthly_deduction || 0).toLocaleString("ar-EG")}</TableCell>
                        <TableCell className="text-green-600">{(l.paid_amount || 0).toLocaleString("ar-EG")}</TableCell>
                        <TableCell className={remaining > 0 ? "text-orange-600 font-semibold" : "text-gray-500"}>{remaining.toLocaleString("ar-EG")}</TableCell>
                        <TableCell><Badge className={statusColor[l.status] || "bg-gray-100"}>{l.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => { setEditing(l); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteMut.mutate(l.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((l) => {
                const remaining = (l.amount || 0) - (l.paid_amount || 0);
                return (
                  <div key={l.id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{l.employee_name}</span>
                      <Badge className={statusColor[l.status] || "bg-gray-100"}>{l.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                      <span>المبلغ: <b className="text-gray-800">{(l.amount || 0).toLocaleString("ar-EG")}</b></span>
                      <span>المتبقي: <b className="text-orange-600">{remaining.toLocaleString("ar-EG")}</b></span>
                      <span>القسط: {l.monthly_deduction || 0} × {l.installments_count || 1}</span>
                      <span>{l.date}</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(l); setDialogOpen(true); }}><Pencil className="w-3 h-3" /> تعديل</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-500" onClick={() => deleteMut.mutate(l.id)}><Trash2 className="w-3 h-3" /> حذف</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <LoanFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} initial={editing} employees={employees} />
    </div>
  );
}