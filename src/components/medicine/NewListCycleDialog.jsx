import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const TODAY = new Date().toISOString().split("T")[0];

function formatDateAr(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

export default function NewListCycleDialog({ open, onOpenChange }) {
  const qc = useQueryClient();
  const [step, setStep] = useState("report"); // "report" | "confirm" | "done"
  const [newFrom, setNewFrom] = useState(TODAY);
  const [newTo, setNewTo]   = useState(TODAY);

  const { data: sales = [] } = useQuery({
    queryKey: ["medicine-sales"],
    queryFn: () => base44.entities.MedicineSale.list("-week_start", 500),
    staleTime: 15000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["report-settings"],
    queryFn: () => base44.entities.ReportSettings.list(),
    staleTime: 30000,
  });

  const salesRecords = sales.filter((r) => !r.record_type || r.record_type === "sales");
  const activeItems  = items.filter((i) => i.is_active !== false);

  // ── ملخص التقرير ──
  const report = useMemo(() => {
    const byBranch = {};
    BRANCHES.forEach((b) => { byBranch[b] = 0; });

    const byItem = {};
    activeItems.forEach((item) => { byItem[item.id] = { name: item.name, code: item.item_code, total: 0, byBranch: {} }; });

    salesRecords.forEach((s) => {
      (s.sales || []).forEach((sale) => {
        const qty = Number(sale.quantity) || 0;
        byBranch[s.branch] = (byBranch[s.branch] || 0) + qty;
        const key = sale.medicine_id;
        if (byItem[key]) {
          byItem[key].total += qty;
          byItem[key].byBranch[s.branch] = (byItem[key].byBranch[s.branch] || 0) + qty;
        }
      });
    });

    const grandTotal = Object.values(byBranch).reduce((a, b) => a + b, 0);
    return { byBranch, byItem: Object.values(byItem), grandTotal, recordsCount: salesRecords.length };
  }, [salesRecords, activeItems]);

  // ── Mutations ──
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      for (const s of sales) {
        await base44.entities.MedicineSale.delete(s.id);
      }
    },
  });

  const saveRangeMutation = useMutation({
    mutationFn: async ({ from, to }) => {
      const fromSetting = settings.find((s) => s.key === "medicine_display_from");
      const toSetting   = settings.find((s) => s.key === "medicine_display_to");
      if (fromSetting) await base44.entities.ReportSettings.update(fromSetting.id, { key: "medicine_display_from", value: from });
      else await base44.entities.ReportSettings.create({ key: "medicine_display_from", value: from });
      if (toSetting) await base44.entities.ReportSettings.update(toSetting.id, { key: "medicine_display_to", value: to });
      else await base44.entities.ReportSettings.create({ key: "medicine_display_to", value: to });
    },
  });

  const handleStart = async () => {
    await deleteAllMutation.mutateAsync();
    await saveRangeMutation.mutateAsync({ from: newFrom, to: newTo });
    qc.invalidateQueries({ queryKey: ["medicine-sales"] });
    qc.invalidateQueries({ queryKey: ["medicine-all-records"] });
    qc.invalidateQueries({ queryKey: ["medicine-balance-records"] });
    qc.invalidateQueries({ queryKey: ["report-settings"] });
    setStep("done");
  };

  const isPending = deleteAllMutation.isPending || saveRangeMutation.isPending;

  const handleClose = () => {
    setStep("report");
    setNewFrom(TODAY);
    setNewTo(TODAY);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* ── خطوة التقرير ── */}
        {step === "report" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-teal-700">
                <FileText className="w-5 h-5" /> تقرير اللستة الحالية قبل البدء
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* ملخص عام */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-teal-700">{report.grandTotal.toLocaleString("ar-EG")}</p>
                  <p className="text-xs text-gray-400">وحدة</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">عدد السجلات</p>
                  <p className="text-2xl font-bold text-blue-700">{report.recordsCount}</p>
                  <p className="text-xs text-gray-400">سجل مبيعات</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">عدد الأصناف</p>
                  <p className="text-2xl font-bold text-orange-700">{activeItems.length}</p>
                  <p className="text-xs text-gray-400">صنف نشط</p>
                </div>
              </div>

              {/* إجمالي لكل فرع */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">إجمالي مبيعات الفروع</h3>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCHES.map((b, i) => {
                    const colors = [
                      "bg-blue-50 border-blue-200 text-blue-700",
                      "bg-purple-50 border-purple-200 text-purple-700",
                    ][i];
                    return (
                      <div key={b} className={`rounded-lg border p-3 text-center ${colors}`}>
                        <p className="text-xs font-medium mb-1">{b}</p>
                        <p className="text-xl font-bold">{(report.byBranch[b] || 0).toLocaleString("ar-EG")}</p>
                        <p className="text-xs opacity-70">وحدة</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* جدول الأصناف */}
              {report.byItem.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">تفصيل كل صنف</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs" dir="rtl">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-right text-gray-500">الصنف</th>
                          <th className="px-3 py-2 text-right text-gray-500">الكود</th>
                          {BRANCHES.map((b) => (
                            <th key={b} className="px-3 py-2 text-center text-gray-500">{b}</th>
                          ))}
                          <th className="px-3 py-2 text-center text-teal-600 font-semibold">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byItem.map((item, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 font-medium text-gray-700">{item.name}</td>
                            <td className="px-3 py-2 font-mono text-teal-600 text-xs">{item.code || "—"}</td>
                            {BRANCHES.map((b) => (
                              <td key={b} className="px-3 py-2 text-center text-gray-600">
                                {(item.byBranch[b] || 0).toLocaleString("ar-EG")}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center font-bold text-teal-700">
                              {item.total.toLocaleString("ar-EG")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-row-reverse mt-2">
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setStep("confirm")}>
                التالي: بدء لستة جديدة
              </Button>
              <Button variant="outline" onClick={handleClose}>إلغاء</Button>
            </DialogFooter>
          </>
        )}

        {/* ── خطوة التأكيد ── */}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" /> تأكيد بدء لستة جديدة
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                <p className="font-semibold mb-1">⚠️ تحذير</p>
                <p>سيتم حذف جميع سجلات المبيعات الحالية ({report.recordsCount} سجل). هذا الإجراء لا يمكن التراجع عنه.</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">حدد فترة اللستة الجديدة:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>من تاريخ</Label>
                    <Input type="date" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>إلى تاريخ</Label>
                    <Input type="date" value={newTo} min={newFrom} onChange={(e) => setNewTo(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">هذه الفترة ستظهر للجميع في تبويب "أصناف اللسته"</p>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-row-reverse">
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={!newFrom || !newTo || isPending}
                onClick={handleStart}
              >
                {isPending ? "جاري التصفير..." : "تأكيد وبدء لستة جديدة"}
              </Button>
              <Button variant="outline" onClick={() => setStep("report")} disabled={isPending}>رجوع</Button>
            </DialogFooter>
          </>
        )}

        {/* ── خطوة النجاح ── */}
        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" /> تم بدء اللستة الجديدة بنجاح
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 space-y-1">
                <p>✅ تم حذف جميع سجلات المبيعات السابقة</p>
                <p>✅ تم ضبط فترة اللستة الجديدة</p>
                <p className="font-semibold mt-2">
                  الفترة الجديدة: {formatDateAr(newFrom)} — {formatDateAr(newTo)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleClose}>إغلاق</Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
