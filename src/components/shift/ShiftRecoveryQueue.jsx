import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, AlertTriangle, CheckCircle2, Archive } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");

export default function ShiftRecoveryQueue({ drafts = [], onResume }) {
  const qc = useQueryClient();
  const activeDrafts = useMemo(() => drafts.filter((d) => ["draft", "submitting"].includes(d.status)), [drafts]);

  const abandonMut = useMutation({
    mutationFn: (id) => base44.entities.ShiftDraft.update(id, { status: "abandoned", last_saved_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-drafts-active"] }),
  });

  const now = Date.now();
  const rows = activeDrafts
    .map((d) => {
      const savedAt = d.last_saved_at || d.updated_date || d.created_date;
      const ageMinutes = savedAt ? Math.max(0, Math.round((now - new Date(savedAt).getTime()) / 60000)) : null;
      const stuck = d.status === "submitting" && ageMinutes !== null && ageMinutes >= 5;
      return { ...d, ageMinutes, stuck };
    })
    .sort((a, b) => String(b.last_saved_at || b.updated_date || "").localeCompare(String(a.last_saved_at || a.updated_date || "")));

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-gray-800">استعادة الشيفتات غير المكتملة</h2>
        <p className="text-sm text-gray-500 mt-1">أي مسودة لم تصل إلى حالة submitted تظل هنا حتى تستكمل أو تُعلَّم كمتروكة. لا يتم حذف المسودات ماليًا.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-emerald-700">لا توجد شيفتات معلقة أو مسودات تحتاج استعادة.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {rows.map((draft) => (
            <Card key={draft.id} className={`p-4 space-y-3 ${draft.stuck || draft.last_error ? "border-amber-300 bg-amber-50/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-800">{draft.branch} — {draft.shift_type}</p>
                    <Badge className={draft.status === "submitting" ? "bg-amber-100 text-amber-700 border-0" : "bg-blue-100 text-blue-700 border-0"}>{draft.status === "submitting" ? "كان جاري الإرسال" : "مسودة"}</Badge>
                    {draft.stuck && <Badge className="bg-red-100 text-red-700 border-0">إرسال عالق</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">التاريخ التشغيلي: {draft.business_date || "—"} · الموظف: {draft.employee_name || "—"}</p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-black text-blue-700">{fmt(draft.total_sales)} ج</p>
                  <p className="text-[10px] text-gray-400">{draft.ageMinutes === null ? "وقت غير محدد" : `آخر حفظ منذ ${draft.ageMinutes} دقيقة`}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white border p-2"><p className="text-gray-400">كاش</p><b>{fmt(draft.cash_sales)}</b></div>
                <div className="rounded-lg bg-white border p-2"><p className="text-gray-400">إلكتروني</p><b>{fmt((draft.visa_sales || 0) + (draft.insta_sales || 0) + (draft.vodafone_sales || 0) + (draft.other_sales || 0))}</b></div>
                <div className="rounded-lg bg-white border p-2"><p className="text-gray-400">محاولات</p><b>{draft.retry_count || 0}</b></div>
              </div>

              {draft.last_error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span><b>آخر خطأ:</b> {draft.last_error}</span></div>}

              <div className="flex gap-2">
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => onResume?.(draft)}><RotateCcw className="w-4 h-4" /> استكمال المسودة</Button>
                <Button variant="outline" className="text-gray-600" disabled={abandonMut.isPending} onClick={() => abandonMut.mutate(draft.id)}><Archive className="w-4 h-4" /> تعليم كمتروكة</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
