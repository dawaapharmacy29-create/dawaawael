import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Landmark, AlertTriangle, CheckCircle2, Clock3, Percent } from "lucide-react";
import { loadAllEntityFiltered } from "@/lib/entityPagination";
import { useUserRole } from "@/lib/useUserRole";
import { shiftFinancialView } from "@/lib/shiftFinancials";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });

function MiniCard({ label, value, icon: Icon, tone = "blue", hint }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <Card className={`p-3 border ${tones[tone] || tones.blue}`}><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] text-gray-500">{label}</p><p className="font-black text-lg mt-1">{value}</p>{hint && <p className="text-[10px] text-gray-500 mt-1">{hint}</p>}</div><Icon className="w-4 h-4"/></div></Card>;
}

export default function VisaSettlementMonitor({ from, to, branch = "الكل", deliveries = [] }) {
  const qc = useQueryClient();
  const { isManager } = useUserRole();
  const [editing, setEditing] = useState(null);
  const [settlement, setSettlement] = useState({ date: "", gross: "", fees: "" });

  const query = useMemo(() => ({
    payment_method: "visa",
    business_date: { $gte: from, $lte: to },
    ...(branch !== "الكل" ? { branch } : {}),
  }), [from, to, branch]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["shift-payment-reconciliation", "visa", from, to, branch],
    queryFn: () => loadAllEntityFiltered(base44.entities.ShiftPaymentReconciliation, query, "-business_date", 10000),
    enabled: Boolean(from && to),
    staleTime: 30000,
  });

  const visaShiftCount = useMemo(() => deliveries.filter((d) => {
    if (d.is_archived === true || d.status === "مراجعة") return false;
    if (!d.shift_date || d.shift_date < from || d.shift_date > to) return false;
    if (branch !== "الكل" && d.branch !== branch) return false;
    return shiftFinancialView(d).payments.visa > 0;
  }).length, [deliveries, from, to, branch]);

  const stats = useMemo(() => {
    const expected = rows.reduce((s, r) => s + Number(r.expected_amount || 0), 0);
    const terminal = rows.reduce((s, r) => s + Number(r.terminal_amount || 0), 0);
    const variance = rows.reduce((s, r) => s + Number(r.variance || 0), 0);
    const operations = rows.reduce((s, r) => s + Number(r.operation_count || 0), 0);
    const fees = rows.reduce((s, r) => s + Number(r.fees || 0), 0);
    const netReceived = rows.reduce((s, r) => s + Number(r.net_received || 0), 0);
    const mismatch = rows.filter((r) => r.settlement_status === "difference" || Math.abs(Number(r.variance || 0)) > 1);
    const unsettled = rows.filter((r) => r.settlement_status !== "settled");
    return { expected, terminal, variance, operations, fees, netReceived, mismatch, unsettled, avgTicket: operations > 0 ? expected / operations : 0 };
  }, [rows]);

  const saveSettlement = useMutation({
    mutationFn: async (row) => {
      const gross = Number(settlement.gross || 0);
      const fees = Number(settlement.fees || 0);
      const net = Math.max(0, gross - fees);
      return base44.entities.ShiftPaymentReconciliation.update(row.id, {
        settlement_status: "settled",
        settlement_date: settlement.date || row.business_date,
        gross_received: gross,
        fees,
        net_received: net,
        settlement_variance: net - Number(row.expected_amount || 0),
        reviewed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      setEditing(null);
      setSettlement({ date: "", gross: "", fees: "" });
      qc.invalidateQueries({ queryKey: ["shift-payment-reconciliation"] });
    },
  });

  const coverage = visaShiftCount > 0 ? (rows.length / visaShiftCount) * 100 : 100;

  return <div className="space-y-4" dir="rtl">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div><h3 className="font-black text-gray-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-700"/> مركز متابعة الفيزا</h3><p className="text-xs text-gray-500 mt-1">مطابقة POS ثم متابعة التسوية البنكية والعمولة وصافي المبلغ الداخل للحساب.</p></div>
      <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${coverage >= 99 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>تغطية المطابقة {coverage.toFixed(0)}%</div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
      <MiniCard label="فيزا متوقعة" value={`${fmt(stats.expected)} ج`} icon={CreditCard} tone="blue"/>
      <MiniCard label="تقرير POS" value={`${fmt(stats.terminal)} ج`} icon={Landmark} tone="violet"/>
      <MiniCard label="فرق POS" value={`${fmt(stats.variance)} ج`} icon={AlertTriangle} tone={Math.abs(stats.variance)>1?"red":"green"}/>
      <MiniCard label="حالات فرق" value={stats.mismatch.length} icon={AlertTriangle} tone={stats.mismatch.length?"red":"green"}/>
      <MiniCard label="تسويات معلقة" value={stats.unsettled.length} icon={Clock3} tone={stats.unsettled.length?"amber":"green"}/>
      <MiniCard label="عمولات البنك" value={`${fmt(stats.fees)} ج`} hint={`متوسط العملية ${fmt(stats.avgTicket)} ج`} icon={Percent} tone="amber"/>
    </div>

    {isLoading ? <div className="text-sm text-gray-400">جاري تحميل متابعة الفيزا...</div> : rows.length === 0 ? <Card className="p-5 text-center text-sm text-gray-400">لا توجد سجلات مطابقة فيزا في الفترة المحددة. السجلات الجديدة ستظهر هنا تلقائيًا.</Card> : (
      <div className="space-y-2">
        {rows.map((r) => {
          const bad = Math.abs(Number(r.variance || 0)) > 1;
          const isEdit = editing === r.id;
          return <Card key={r.id} className={`p-3 ${bad ? "border-red-200" : "border-gray-200"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div><div className="flex items-center gap-2 flex-wrap"><b className="text-sm">{r.business_date} — {r.branch} — {r.shift_type}</b><span className={`text-[10px] rounded-full px-2 py-0.5 ${r.settlement_status === "settled" ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>{r.settlement_status === "settled" ? "تمت التسوية" : bad ? "فرق يحتاج مراجعة" : "POS مطابق"}</span></div><p className="text-xs text-gray-500 mt-1">المتوقع {fmt(r.expected_amount)} · POS {fmt(r.terminal_amount)} · الفرق {fmt(r.variance)} · العمليات {Number(r.operation_count || 0)} {r.terminal_name ? `· ${r.terminal_name}` : ""} {r.batch_reference ? `· Batch ${r.batch_reference}` : ""}</p></div>
              {r.settlement_status === "settled" ? <div className="text-left text-xs"><p className="text-emerald-700 font-bold">صافي البنك {fmt(r.net_received)} ج</p><p className="text-gray-400">رسوم {fmt(r.fees)} ج</p></div> : isManager && <Button size="sm" variant="outline" onClick={() => { setEditing(isEdit ? null : r.id); setSettlement({ date: r.business_date || "", gross: String(r.expected_amount || ""), fees: "" }); }}>{isEdit ? "إلغاء" : "تسجيل التسوية"}</Button>}
            </div>
            {isEdit && <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3 rounded-lg bg-gray-50 p-3"><div><p className="text-[10px] text-gray-500 mb-1">تاريخ التسوية</p><Input type="date" value={settlement.date} onChange={(e)=>setSettlement((s)=>({...s,date:e.target.value}))}/></div><div><p className="text-[10px] text-gray-500 mb-1">إجمالي البنك قبل الرسوم</p><Input type="number" min="0" value={settlement.gross} onChange={(e)=>setSettlement((s)=>({...s,gross:e.target.value}))}/></div><div><p className="text-[10px] text-gray-500 mb-1">العمولة/الرسوم</p><Input type="number" min="0" value={settlement.fees} onChange={(e)=>setSettlement((s)=>({...s,fees:e.target.value}))}/></div><div className="flex items-end"><Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saveSettlement.isPending || Number(settlement.gross || 0)<=0} onClick={()=>saveSettlement.mutate(r)}><CheckCircle2 className="w-4 h-4"/> حفظ التسوية</Button></div></div>}
          </Card>;
        })}
      </div>
    )}
  </div>;
}
