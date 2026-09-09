import { useMemo, useState } from "react";
import { Target, TrendingUp, TrendingDown, MinusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtCurrency } from "@/lib/financial-report-utils";
import { currentMonthStr, monthLabel, buildBranchTargetsSummary } from "@/lib/financial-target-utils";

const STATUS_STYLES = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: TrendingUp },
  blue: { bg: "bg-blue-50", text: "text-blue-700", icon: MinusCircle },
  red: { bg: "bg-red-50", text: "text-red-700", icon: TrendingDown },
  gray: { bg: "bg-gray-50", text: "text-gray-500", icon: MinusCircle },
};

export default function FinancialTargetCard({ handovers, targets }) {
  const [open, setOpen] = useState(false);
  const month = currentMonthStr();
  const summary = useMemo(() => buildBranchTargetsSummary(handovers, targets, month), [handovers, targets, month]);
  const totalTarget = summary.reduce((s, b) => s + b.targetAmount, 0);
  const totalAchieved = summary.reduce((s, b) => s + b.achieved, 0);
  const percent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-right rounded-xl p-4 bg-gradient-to-br from-violet-500 to-violet-600 border border-black/5 shadow-sm hover:opacity-90 transition w-full"
      >
        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-2">
          <Target className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs mb-0.5 leading-tight text-white/80">التارجيت ({monthLabel(month)})</p>
        <p className="text-base md:text-lg font-extrabold text-white">{fmtCurrency(totalTarget)}</p>
        <p className="text-[11px] text-white/80 mt-0.5">{percent.toFixed(1)}% محقق حتى الآن</p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-right">تارجيت الفروع — {monthLabel(month)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {summary.map((b) => {
              const s = STATUS_STYLES[b.statusColor];
              const Icon = s.icon;
              return (
                <div key={b.branch} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-semibold text-gray-800">{b.branch}</span>
                    <Badge className={`${s.bg} ${s.text} border-0 flex items-center gap-1`}>
                      <Icon className="w-3 h-3" /> {b.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between flex-wrap gap-1 text-sm text-gray-500">
                    <span>المبيعات المسجلة: <span className="font-semibold text-gray-700">{fmtCurrency(b.achieved)}</span></span>
                    <span>التارجيت: <span className="font-semibold text-gray-700">{fmtCurrency(b.targetAmount)}</span></span>
                  </div>
                  {b.recordedDays > 0 && (
                    <p className="text-xs text-gray-400">
                      بمعدل يومي {fmtCurrency(b.dailyAvg)} على {b.recordedDays} يوم مسجل ← لو استمريت بنفس المعدل هتوصل لـ {fmtCurrency(b.projectedTotal)}
                    </p>
                  )}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.statusColor === "emerald" ? "bg-emerald-500" : b.statusColor === "blue" ? "bg-blue-500" : b.statusColor === "red" ? "bg-red-500" : "bg-gray-300"}`}
                      style={{ width: `${Math.min(b.percentOfTarget, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{b.percentOfTarget.toFixed(1)}% من التارجيت الشهري</p>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
