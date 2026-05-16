import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

// Returns array of 7-day periods from 2025-01-01 up to today
function generate7DayPeriods() {
  const start = new Date("2025-01-01");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const periods = [];
  let cur = new Date(start);
  while (cur <= today) {
    const from = new Date(cur);
    const to = new Date(cur);
    to.setDate(to.getDate() + 6);
    periods.push({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      label: `${formatDateAr(from)} — ${formatDateAr(to)}`,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return periods.reverse(); // newest first
}

function formatDateAr(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

function getWeekLabel(fromStr) {
  const d = new Date(fromStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const PERIODS = generate7DayPeriods();
const DEFAULT_PERIOD_IDX = 0; // most recent

export default function MedicineSalesTab() {
  const qc = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  const canAdd = isAdmin || isManager;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(DEFAULT_PERIOD_IDX);
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ branch: "", dateFrom: today, dateTo: today, quantities: {}, balances: {} });
  const [filterBranch, setFilterBranch] = useState("الكل");

  const { data: items = [] } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["medicine-sales"],
    queryFn: () => base44.entities.MedicineSale.list("-week_start", 500),
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
    const today = new Date().toISOString().split("T")[0];
    setForm({ branch: "", dateFrom: today, dateTo: today, quantities: {}, balances: {} });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const salesArr = activeItems.map((item) => ({
      medicine_id: item.id,
      medicine_name: item.name,
      quantity: parseFloat(form.quantities[item.id] || 0),
      balance: parseFloat(form.balances[item.id] || 0),
    })).filter((s) => s.quantity > 0 || s.balance > 0);

    createMutation.mutate({
      branch: form.branch,
      week_start: form.dateFrom,
      week_label: `${form.dateFrom} → ${form.dateTo}`,
      sales: salesArr,
    });
  };

  // Filter by period (week_start in range)
  const filtered = useMemo(() => {
    const period = PERIODS[selectedPeriodIdx];
    return sales.filter((s) => {
      const inBranch = filterBranch === "الكل" || s.branch === filterBranch;
      const inPeriod = s.week_start >= period.from && s.week_start <= period.to;
      return inBranch && inPeriod;
    });
  }, [sales, filterBranch, selectedPeriodIdx]);

  const selectedPeriod = PERIODS[selectedPeriodIdx];

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
        <Card className="p-8 text-center text-gray-400">لا توجد سجلات لهذه الفترة</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-teal-100 text-teal-700 border-0 mb-1">{s.branch}</Badge>
                  <p className="text-sm text-gray-500">الفترة: {s.week_label}</p>
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-right px-2 py-1.5 text-gray-500 font-semibold">الصنف</th>
                      <th className="text-center px-2 py-1.5 text-gray-500 font-semibold">وحدات البيع</th>
                      <th className="text-center px-2 py-1.5 text-gray-500 font-semibold">الرصيد الفعلي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.sales || []).map((sale, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium text-gray-700">{sale.medicine_name}</td>
                        <td className="px-2 py-1.5 text-center text-blue-700 font-semibold">{sale.quantity ?? 0}</td>
                        <td className="px-2 py-1.5 text-center text-green-700 font-semibold">{sale.balance ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة مبيعات اللسته</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>الفرع *</Label>
              <Select value={form.branch} onValueChange={(v) => setForm((p) => ({ ...p, branch: v }))} required>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>من تاريخ *</Label>
                <Input
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setForm((p) => ({ ...p, dateFrom: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>إلى تاريخ *</Label>
                <Input
                  type="date"
                  value={form.dateTo}
                  min={form.dateFrom}
                  onChange={(e) => setForm((p) => ({ ...p, dateTo: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 border-b pb-1">
                <span>الصنف</span>
                <span className="text-center">وحدات البيع</span>
                <span className="text-center">الرصيد الفعلي</span>
              </div>
              {activeItems.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد أصناف — أضفها من تبويب إدارة الأصناف</p>
              ) : (
                activeItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm font-medium text-gray-700 truncate">{item.name}</span>
                    <Input
                      type="number" min="0" step="1"
                      value={form.quantities[item.id] || ""}
                      onChange={(e) => setForm((p) => ({ ...p, quantities: { ...p.quantities, [item.id]: e.target.value } }))}
                      className="h-8 text-center text-sm"
                      placeholder="0"
                    />
                    <Input
                      type="number" min="0" step="1"
                      value={form.balances[item.id] || ""}
                      onChange={(e) => setForm((p) => ({ ...p, balances: { ...p.balances, [item.id]: e.target.value } }))}
                      className="h-8 text-center text-sm"
                      placeholder="0"
                    />
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="gap-2 flex-row-reverse">
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={!form.branch || !form.dateFrom || !form.dateTo || createMutation.isPending}>
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