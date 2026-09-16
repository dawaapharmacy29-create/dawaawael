import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Clock3, UserRound, WalletCards, Banknote } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { assertDailyCloseOpen } from "@/lib/dailyCloseGuard";
import { shiftFinancialView } from "@/lib/shiftFinancials";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

const formatShiftDate = (value) => {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(d);
};

const formatRecordedTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  }).format(d);
};

const SHIFT_BADGE = {
  "صباحي": "bg-amber-100 text-amber-700",
  "مسائي": "bg-blue-100 text-blue-700",
  "ليلي": "bg-indigo-100 text-indigo-700",
};

export default function ShiftDeliveryDetail({ item, onClose }) {
  const qc = useQueryClient();
  const financial = shiftFinancialView(item);
  const { isAdmin, isManager } = useUserRole();

  const workflowMutation = useMutation({
    mutationFn: async (nextStatus) => {
      await assertDailyCloseOpen(item.branch, item.shift_date, "تغيير حالة دورة الشيفت");
      if (nextStatus === "approved" && Math.abs(financial.cashVariance) > 1 && !(item.notes || "").trim()) throw new Error("لا يمكن اعتماد شيفت به فرق كاش بدون سبب موثق");
      const res = await base44.functions.invoke("updateShiftDeliveryAdmin", { id: item.id, action: "update", updates: { workflow_status: nextStatus } });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر تحديث مرحلة الشيفت");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-deliveries"] });
      qc.invalidateQueries({ queryKey: ["daily-close-shifts"] });
      onClose();
    },
  });

  // ترحيل الشيفت لليوم السابق (احتساب لليوم السابق)
  const moveToPrevDay = useMutation({ 
    mutationFn: async (it) => {
      await assertDailyCloseOpen(it.branch, it.shift_date, "ترحيل تاريخ احتساب الشيفت");
      const baseDate = it.calculation_date || it.shift_date;
      if (baseDate) {
        const d = new Date(`${baseDate}T00:00:00`);
        d.setDate(d.getDate() - 1);
        const prevDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        await assertDailyCloseOpen(it.branch, prevDate, "ترحيل الشيفت إلى اليوم السابق");
      }
      const res = await base44.functions.invoke("updateShiftDeliveryAdmin", {
        id: it.id,
        action: "previous_calculation_day",
      });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر ترحيل تاريخ الاحتساب");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-deliveries"] });
      qc.invalidateQueries({ queryKey: ["daily-close-shifts"] });
      onClose();
    },
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <div className="border-b bg-slate-50/70 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge className={SHIFT_BADGE[item.shift_type] || "bg-gray-100"}>{item.shift_type}</Badge>
                <span className="text-lg font-black text-slate-900">{item.branch}</span>
              </div>
              <Badge className={item.workflow_status === "closed" ? "bg-emerald-100 text-emerald-800" : item.workflow_status === "approved" ? "bg-blue-100 text-blue-800" : item.workflow_status === "under_review" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}>
                {({submitted:"تم التسليم",under_review:"تحت المراجعة",approved:"معتمد",closed:"مقفول"})[item.workflow_status || "submitted"]}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg bg-white border px-3 py-2">
              <UserRound className="w-4 h-4 text-slate-400" />
              <div><p className="text-slate-400">الموظف</p><p className="font-bold text-slate-800">{item.submitted_by || "—"}</p></div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white border px-3 py-2">
              <CalendarClock className="w-4 h-4 text-slate-400" />
              <div><p className="text-slate-400">تاريخ الشيفت</p><p className="font-bold text-slate-800">{formatShiftDate(item.shift_date)}</p></div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white border px-3 py-2">
              <Clock3 className="w-4 h-4 text-slate-400" />
              <div><p className="text-slate-400">وقت التسليم</p><p className="font-black text-slate-900">{formatRecordedTime(item.recorded_at)}</p></div>
            </div>
          </div>
          {isManager && item.calculation_date && item.calculation_date !== item.shift_date && (
            <p className="mt-2 text-[11px] text-amber-700">يُحتسب محاسبيًا على {formatShiftDate(item.calculation_date)}</p>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
              <p className="text-[11px] text-gray-500">إجمالي المبيعات</p>
              <p className="font-black text-blue-700 text-lg">{fmt(item.total_sales)} ج</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
              <p className="text-[11px] text-gray-500">نقدي للمحاسب</p>
              <p className="font-black text-emerald-700 text-lg">{fmt(financial.expectedCash)} ج</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-center">
              <p className="text-[11px] text-gray-500">إجمالي التحويلات</p>
              <p className="font-black text-violet-700 text-lg">{fmt(financial.electronicTotal)} ج</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
              <p className="text-[11px] text-gray-500">مصروفات الشيفت</p>
              <p className="font-black text-red-600 text-lg">{fmt(financial.realExpenseTotal)} ج</p>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2"><WalletCards className="w-4 h-4 text-violet-600"/><p className="text-sm font-bold text-gray-800">تفاصيل التحصيل</p></div>
              {financial.legacy && <Badge className="bg-amber-100 text-amber-800">بيانات قديمة مستنتجة</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              {[["كاش", financial.payments.cash],["فيزا", financial.payments.visa],["إنستا باي", financial.payments.insta],["فودافون كاش", financial.payments.vodafone],["تحويل", financial.payments.other]].map(([label,value]) => <div key={label} className="rounded-lg bg-slate-50 p-2"><p className="text-gray-400">{label}</p><p className="font-bold text-gray-800">{fmt(value)} ج</p></div>)}
            </div>
            {!financial.legacy && Math.abs(financial.cashVariance) > 1 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center justify-between">
                <span>فرق الكاش المسجل</span><b>{fmt(financial.cashVariance)} ج</b>
              </div>
            )}
          </div>

          {financial.realExpenses.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">بنود المصروفات</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الوصف</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead className="text-left">القيمة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financial.realExpenses.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{e.description || "—"}</TableCell>
                        <TableCell className="text-sm">{e.category || "—"}</TableCell>
                        <TableCell className="text-sm font-medium text-red-600">{fmt(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {item.notes && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">ملاحظات</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{item.notes}</p>
            </div>
          )}

          {isManager && item.workflow_status !== "closed" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {item.workflow_status !== "approved" && <Button variant="outline" className="text-blue-700 border-blue-300" onClick={() => workflowMutation.mutate("approved")} disabled={workflowMutation.isPending}>اعتماد الشيفت</Button>}
              {item.workflow_status === "approved" && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => workflowMutation.mutate("closed")} disabled={workflowMutation.isPending}>إقفال الشيفت</Button>}
              {item.workflow_status === "under_review" && <Button variant="outline" className="text-amber-700 border-amber-300" onClick={() => workflowMutation.mutate("submitted")} disabled={workflowMutation.isPending}>إرجاعه كمسلم للمراجعة</Button>}
            </div>
          )}

          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => moveToPrevDay.mutate(item)}
              disabled={moveToPrevDay.isPending}
              className="w-full text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <CalendarClock className="w-4 h-4" />
              ترحيل الشيفت لليوم السابق
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}