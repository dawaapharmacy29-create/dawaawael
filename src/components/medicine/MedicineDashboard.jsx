import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Award, CalendarRange, Pencil } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

const TODAY = new Date().toISOString().split("T")[0];

function formatDateAr(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];
const branchColor = {
  "فرع زكريا": "bg-blue-50 border-blue-200 text-blue-700",
  "فرع بسيسة": "bg-purple-50 border-purple-200 text-purple-700",
  "فرع المنشية": "bg-orange-50 border-orange-200 text-orange-700",
};

export default function MedicineDashboard() {
  const qc = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  const canSetRange = isAdmin || isManager;
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [rangeForm, setRangeForm] = useState({ from: "", to: "" });

  const { data: settings = [] } = useQuery({
    queryKey: ["report-settings"],
    queryFn: () => base44.entities.ReportSettings.list(),
    staleTime: 30000,
  });

  const displayFrom = settings.find((s) => s.key === "medicine_display_from")?.value || "";
  const displayTo = settings.find((s) => s.key === "medicine_display_to")?.value || "";
  const fromSettingId = settings.find((s) => s.key === "medicine_display_from")?.id;
  const toSettingId = settings.find((s) => s.key === "medicine_display_to")?.id;

  const saveRangeMutation = useMutation({
    mutationFn: async ({ from, to }) => {
      if (fromSettingId) {
        await base44.entities.ReportSettings.update(fromSettingId, { key: "medicine_display_from", value: from });
      } else {
        await base44.entities.ReportSettings.create({ key: "medicine_display_from", value: from });
      }
      if (toSettingId) {
        await base44.entities.ReportSettings.update(toSettingId, { key: "medicine_display_to", value: to });
      } else {
        await base44.entities.ReportSettings.create({ key: "medicine_display_to", value: to });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-settings"] });
      setRangeDialogOpen(false);
    },
  });

  const openRangeDialog = () => {
    setRangeForm({ from: displayFrom || TODAY, to: displayTo || TODAY });
    setRangeDialogOpen(true);
  };

  const { data: items = [] } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["medicine-sales"],
    queryFn: () => base44.entities.MedicineSale.list("-week_start", 500),
    staleTime: 15000,
  });

  // سجلات الرصيد الفعلي فقط — نفلتر محلياً
  const balanceRecords = sales.filter((r) => r.record_type === "balance");

  const activeItems = items.filter((i) => i.is_active !== false);

  // أحدث رصيد فعلي لكل صنف في كل فرع — من سجلات الرصيد فقط
  const latestBalances = {};
  const sortedBalanceRecords = [...balanceRecords].sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
  BRANCHES.forEach((branch) => {
    activeItems.forEach((item) => {
      if (!latestBalances[item.id]) latestBalances[item.id] = {};
      const found = sortedBalanceRecords.find(
        (s) => s.branch === branch && (s.sales || []).some((x) => x.medicine_id === item.id || x.medicine_name === item.name)
      );
      if (found) {
        const saleEntry = (found.sales || []).find((x) => x.medicine_id === item.id || x.medicine_name === item.name);
        const bal = saleEntry?.balance;
        latestBalances[item.id][branch] = (bal !== undefined && bal !== null) ? bal : "—";
      } else {
        latestBalances[item.id][branch] = "—";
      }
    });
  });

  // إجمالي مبيعات كل صنف
  const itemTotals = activeItems.map((item) => {
    let total = 0;
    let byBranch = {};
    sales.forEach((s) => {
      (s.sales || []).forEach((sale) => {
        if (sale.medicine_name === item.name || sale.medicine_id === item.id) {
          total += sale.quantity || 0;
          byBranch[s.branch] = (byBranch[s.branch] || 0) + (sale.quantity || 0);
        }
      });
    });
    // أكثر فرع مبيعاً
    const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { item, total, byBranch, topBranch };
  });

  // إجمالي مبيعات كل فرع عبر جميع الأصناف
  const branchTotals = BRANCHES.map((b) => ({
    branch: b,
    total: sales.reduce((sum, s) => {
      if (s.branch !== b) return sum;
      return sum + (s.sales || []).reduce((ss, sale) => ss + (sale.quantity || 0), 0);
    }, 0),
  }));
  const topBranch = [...branchTotals].sort((a, b) => b.total - a.total)[0]?.branch;

  return (
    <div className="space-y-6">
      {/* Display range bar */}
      <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 gap-3">
        <div className="flex items-center gap-2 text-sm text-teal-800">
          <CalendarRange className="w-4 h-4" />
          {displayFrom && displayTo ? (
            <span>عرض الفترة: <strong>{formatDateAr(displayFrom)}</strong> — <strong>{formatDateAr(displayTo)}</strong></span>
          ) : (
            <span className="text-teal-600">لم يتم تحديد فترة عرض بعد</span>
          )}
        </div>
        {canSetRange && (
          <Button size="sm" variant="outline" onClick={openRangeDialog} className="text-teal-700 border-teal-300 hover:bg-teal-100 gap-1 h-7 text-xs">
            <Pencil className="w-3 h-3" /> تغيير الفترة
          </Button>
        )}
      </div>

      {/* Set display range dialog */}
      <Dialog open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>تحديد فترة العرض</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">تحديد هذه الفترة يؤثر على ما يراه جميع المستخدمين في خانة أصناف اللسته.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>من تاريخ</Label>
                <Input type="date" value={rangeForm.from} onChange={(e) => setRangeForm((p) => ({ ...p, from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>إلى تاريخ</Label>
                <Input type="date" value={rangeForm.to} min={rangeForm.from} onChange={(e) => setRangeForm((p) => ({ ...p, to: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!rangeForm.from || !rangeForm.to || saveRangeMutation.isPending}
              onClick={() => saveRangeMutation.mutate({ from: rangeForm.from, to: rangeForm.to })}
            >
              {saveRangeMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setRangeDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* وسام الفرع الأكثر مبيعاً */}
      {topBranch && (
        <Card className={`p-4 border-2 flex items-center gap-4 ${branchColor[topBranch]}`}>
          <Award className="w-10 h-10 text-yellow-500 shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-500">🏆 الفرع الأكثر مبيعاً</p>
            <p className="text-xl font-bold">{topBranch}</p>
            <p className="text-sm">{branchTotals.find((b) => b.branch === topBranch)?.total?.toLocaleString("ar-EG")} وحدة إجمالي</p>
          </div>
        </Card>
      )}

      {/* جدول الرصيد الفعلي الإجمالي */}
      {activeItems.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">الرصيد الفعلي الإجمالي (آخر تسجيل)</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" dir="rtl">
              <thead className="bg-teal-700 text-white">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold">الصنف</th>
                  {BRANCHES.map((b) => (
                    <th key={b} className="px-3 py-2 text-center font-semibold">{b}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item, idx) => {
                  const branchVals = BRANCHES.map((b) => latestBalances[item.id]?.[b]);
                  const numericVals = branchVals.filter((v) => v !== "—" && v !== undefined && v !== null);
                  const total = numericVals.length > 0 ? numericVals.reduce((s, v) => s + Number(v), 0) : "—";
                  return (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                      {BRANCHES.map((b) => {
                        const val = latestBalances[item.id]?.[b];
                        return (
                          <td key={b} className="px-3 py-2 text-center">
                            <span className={`font-semibold ${val === "—" ? "text-gray-300" : "text-teal-700"}`}>{val ?? "—"}</span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-bold text-gray-800">
                        {total === "—" ? "—" : total.toLocaleString("ar-EG")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* إجمالي مبيعات كل صنف */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">إجمالي مبيعات كل صنف</h2>
        {activeItems.length === 0 ? (
          <Card className="p-8 text-center text-gray-400">لا توجد أصناف بعد — أضفها من تبويب "إدارة الأصناف"</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemTotals.map(({ item, total, byBranch, topBranch: tb }) => (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <span className="text-lg font-bold text-teal-600">{total.toLocaleString("ar-EG")}</span>
                </div>
                <div className="space-y-1.5">
                  {BRANCHES.map((b) => {
                    const qty = byBranch[b] || 0;
                    const pct = total > 0 ? Math.round((qty / total) * 100) : 0;
                    return (
                      <div key={b}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className={`font-medium ${b === tb ? "text-teal-700" : "text-gray-600"}`}>
                            {b} {b === tb && "🥇"}
                          </span>
                          <span className="text-gray-500">{qty} وحدة</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}