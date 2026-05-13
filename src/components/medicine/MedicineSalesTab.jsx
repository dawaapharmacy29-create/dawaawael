import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

function getWeekLabel(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split("T")[0];
}

export default function MedicineSalesTab() {
  const qc = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  const canAdd = isAdmin || isManager;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ branch: "", week_start: getMonday(new Date().toISOString().split("T")[0]), quantities: {} });
  const [filterBranch, setFilterBranch] = useState("الكل");

  const { data: items = [] } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["medicine-sales"],
    queryFn: () => base44.entities.MedicineSale.list("-week_start", 200),
    staleTime: 15000,
  });

  const activeItems = items.filter((i) => i.is_active !== false);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MedicineSale.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medicine-sales"] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MedicineSale.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicine-sales"] }),
  });

  const openDialog = () => {
    setForm({ branch: "", week_start: getMonday(new Date().toISOString().split("T")[0]), quantities: {} });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const salesArr = activeItems.map((item) => ({
      medicine_id: item.id,
      medicine_name: item.name,
      quantity: parseFloat(form.quantities[item.id] || 0),
    })).filter((s) => s.quantity > 0);

    createMutation.mutate({
      branch: form.branch,
      week_start: form.week_start,
      week_label: getWeekLabel(form.week_start),
      sales: salesArr,
    });
  };

  const filtered = filterBranch === "الكل" ? sales : sales.filter((s) => s.branch === filterBranch);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {["الكل", ...BRANCHES].map((b) => (
            <button key={b} onClick={() => setFilterBranch(b)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterBranch === b ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"}`}>
              {b}
            </button>
          ))}
        </div>
        {canAdd && (
          <Button onClick={openDialog} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="w-4 h-4" /> إضافة مبيعات اللسته
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-gray-400">جاري التحميل...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">لا توجد سجلات بعد</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-teal-100 text-teal-700 border-0 mb-1">{s.branch}</Badge>
                  <p className="text-sm text-gray-500">الأسبوع: {s.week_label} — من {s.week_start}</p>
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(s.sales || []).map((sale, i) => (
                  <span key={i} className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium">
                    {sale.medicine_name}: {sale.quantity} وحدة
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>إضافة مبيعات اللسته</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>الفرع *</Label>
              <Select value={form.branch} onValueChange={(v) => setForm((p) => ({ ...p, branch: v }))} required>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>تاريخ بداية الأسبوع *</Label>
              <Input type="date" value={form.week_start} onChange={(e) => setForm((p) => ({ ...p, week_start: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>عدد الوحدات المباعة</Label>
              {activeItems.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد أصناف — أضفها من تبويب إدارة الأصناف</p>
              ) : (
                activeItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-medium text-gray-700">{item.name}</span>
                    <Input
                      type="number" min="0" step="1"
                      value={form.quantities[item.id] || ""}
                      onChange={(e) => setForm((p) => ({ ...p, quantities: { ...p.quantities, [item.id]: e.target.value } }))}
                      className="w-24 h-8 text-center"
                      placeholder="0"
                    />
                  </div>
                ))
              )}
            </div>
            <DialogFooter className="gap-2 flex-row-reverse">
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={!form.branch || createMutation.isPending}>
                {createMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}