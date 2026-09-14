import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Banknote, Building2, CreditCard, Gauge, Receipt, Smartphone, TrendingUp, WalletCards, Landmark } from "lucide-react";
import VisaSettlementMonitor from "./VisaSettlementMonitor";
import { aggregateShiftFinancials, shiftFinancialView } from "@/lib/shiftFinancials";
import { cycleRangeFor, cairoTodayKey } from "@/lib/smart-commerce-analytics";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const SHIFTS = ["صباحي", "مسائي", "ليلي"];
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });

function Kpi({ title, value, subtitle, icon: Icon, tone="blue" }) {
  const tones = { blue:"bg-blue-50 border-blue-200 text-blue-700", green:"bg-emerald-50 border-emerald-200 text-emerald-700", red:"bg-rose-50 border-rose-200 text-rose-700", amber:"bg-amber-50 border-amber-200 text-amber-700", purple:"bg-purple-50 border-purple-200 text-purple-700", teal:"bg-teal-50 border-teal-200 text-teal-700" };
  return <Card className={`p-3 border ${tones[tone] || tones.blue}`}><div className="flex justify-between items-start gap-2"><div><p className="text-xs text-gray-500">{title}</p><p className="text-xl font-black mt-1">{value}</p>{subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}</div><Icon className="w-5 h-5 opacity-80"/></div></Card>;
}

export default function ShiftOperationsAnalytics({ deliveries = [] }) {
  const cycle = cycleRangeFor(cairoTodayKey());
  const [branch, setBranch] = useState("الكل");
  const [shift, setShift] = useState("الكل");
  const [from, setFrom] = useState(cycle.from);
  const [to, setTo] = useState(cycle.to);

  const filtered = useMemo(() => deliveries.filter((r) => r.is_archived !== true && r.status !== "مراجعة" && r.shift_date >= from && r.shift_date <= to && (branch === "الكل" || r.branch === branch) && (shift === "الكل" || r.shift_type === shift)), [deliveries, from, to, branch, shift]);
  const agg = useMemo(() => aggregateShiftFinancials(filtered), [filtered]);
  const days = useMemo(() => new Set(filtered.map((r)=>r.shift_date).filter(Boolean)).size || 1, [filtered]);

  const expenseCategories = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => shiftFinancialView(r).realExpenses.forEach((e) => {
      const k = (e.category || "أخرى").trim() || "أخرى";
      map.set(k, (map.get(k) || 0) + (Number(e.amount) || 0));
    }));
    return [...map.entries()].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total);
  }, [filtered]);

  const byShift = useMemo(() => SHIFTS.map((type) => {
    const rows = filtered.filter((r)=>r.shift_type===type);
    const a = aggregateShiftFinancials(rows);
    return { type, ...a, avgSales: rows.length ? a.sales/rows.length : 0, expenseRate:a.sales ? a.expenses/a.sales*100 : 0 };
  }), [filtered]);

  const electronic = agg.visa + agg.insta + agg.vodafone + agg.other;
  const electronicShare = agg.sales ? electronic/agg.sales*100 : 0;
  const expenseRate = agg.sales ? agg.expenses/agg.sales*100 : 0;

  return <div className="space-y-5" dir="rtl">
    <div className="flex items-end gap-2 flex-wrap">
      <div className="space-y-1"><p className="text-xs text-gray-500">من</p><input type="date" className="h-9 rounded-md border px-2 text-sm" value={from} onChange={(e)=>setFrom(e.target.value)}/></div>
      <div className="space-y-1"><p className="text-xs text-gray-500">إلى</p><input type="date" className="h-9 rounded-md border px-2 text-sm" value={to} onChange={(e)=>setTo(e.target.value)}/></div>
      <Select value={branch} onValueChange={setBranch}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="الكل">كل الفروع</SelectItem>{BRANCHES.map((b)=><SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
      <Select value={shift} onValueChange={setShift}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="الكل">كل الشيفتات</SelectItem>{SHIFTS.map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
    </div>

    {agg.legacyCount > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">يوجد {agg.legacyCount.toLocaleString("ar-EG")} شيفت قديم بدون تفصيل مستقل لطرق التحصيل. تم استنتاج إنستا/فيزا/فودافون من البنود القديمة لأغراض التحليل فقط، بدون تعديل البيانات الأصلية.</div>}

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi title="إجمالي المبيعات" value={`${fmt(agg.sales)} ج`} subtitle={`متوسط يومي ${fmt(agg.sales/days)} ج`} icon={TrendingUp} tone="green"/>
      <Kpi title="المصروفات الحقيقية" value={`${fmt(agg.expenses)} ج`} subtitle={`${expenseRate.toFixed(2)}% من المبيعات`} icon={Receipt} tone="red"/>
      <Kpi title="صافي الخزينة/التشغيل" value={`${fmt(agg.treasuryNet)} ج`} subtitle={`المبيعات كلها − المصروفات الحقيقية`} icon={WalletCards} tone="blue"/>
      <Kpi title="التحصيل الإلكتروني" value={`${fmt(electronic)} ج`} subtitle={`${electronicShare.toFixed(1)}% من المبيعات — داخل قيمة الخزينة`} icon={CreditCard} tone="purple"/>
      <Kpi title="الكاش" value={`${fmt(agg.cash)} ج`} subtitle={`مصروف كاش ${fmt(agg.expenseCash)} · متوقع تسليم ${fmt(agg.expectedCash)} ج`} icon={Banknote} tone="teal"/>
      <Kpi title="الفيزا" value={`${fmt(agg.visa)} ج`} subtitle={`${agg.sales ? (agg.visa/agg.sales*100).toFixed(1) : 0}% من المبيعات`} icon={CreditCard} tone="blue"/>
      <Kpi title="إنستا باي" value={`${fmt(agg.insta)} ج`} subtitle={`صافي القناة ${fmt(agg.insta-agg.expenseInsta)} ج`} icon={Landmark} tone="purple"/>
      <Kpi title="فودافون كاش" value={`${fmt(agg.vodafone)} ج`} subtitle={`صافي القناة ${fmt(agg.vodafone-agg.expenseVodafone)} ج`} icon={Smartphone} tone="red"/>
      <Kpi title="فرق الكاش المسجل" value={`${fmt(agg.cashVariance)} ج`} subtitle="للسجلات ذات المطابقة الجديدة" icon={Gauge} tone={Math.abs(agg.cashVariance)>1?"red":"green"}/>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4"><h3 className="font-black text-gray-800 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600"/> مقارنة أنواع الشيفت</h3><div className="space-y-3">{byShift.map((s)=><div key={s.type} className="rounded-lg border p-3"><div className="flex justify-between"><b>{s.type}</b><span className="text-xs text-gray-500">{s.count} شيفت</span></div><div className="grid grid-cols-3 gap-2 text-xs mt-2"><div><span className="text-gray-400">مبيعات</span><p className="font-bold">{fmt(s.sales)}</p></div><div><span className="text-gray-400">متوسط</span><p className="font-bold">{fmt(s.avgSales)}</p></div><div><span className="text-gray-400">مصروف%</span><p className="font-bold">{s.expenseRate.toFixed(2)}%</p></div></div></div>)}</div></Card>
      <Card className="p-4"><h3 className="font-black text-gray-800 mb-3 flex items-center gap-2"><Receipt className="w-5 h-5 text-rose-600"/> أعلى بنود المصروفات</h3>{expenseCategories.length===0?<p className="text-sm text-gray-400">لا توجد مصروفات في الفترة</p>:<div className="space-y-2">{expenseCategories.slice(0,10).map((e,i)=><div key={e.name} className="flex justify-between items-center border-b pb-2 last:border-0"><span className="text-sm"><b className="text-gray-400 ml-2">#{i+1}</b>{e.name}</span><span className="font-black text-rose-700">{fmt(e.total)} ج</span></div>)}</div>}</Card>
    </div>

    <Card className="p-4"><h3 className="font-black text-gray-800 mb-3 flex items-center gap-2"><Building2 className="w-5 h-5 text-teal-600"/> توزيع وسائل التحصيل</h3><div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">{[["كاش",agg.cash],["فيزا",agg.visa],["إنستا",agg.insta],["فودافون",agg.vodafone],["أخرى",agg.other]].map(([k,v])=><div key={k} className="rounded-lg bg-gray-50 border p-3"><p className="text-xs text-gray-500">{k}</p><p className="font-black mt-1">{fmt(v)} ج</p><p className="text-[11px] text-gray-400">{agg.sales ? (v/agg.sales*100).toFixed(1) : 0}%</p></div>)}</div><div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><b>قاعدة الحساب:</b> كاش + فيزا + إنستا + فودافون + أخرى = إجمالي المبيعات الفعلية. المصروفات الحقيقية فقط هي التي تُخصم للوصول إلى صافي الخزينة/التشغيل.</div></Card>

    <VisaSettlementMonitor from={from} to={to} branch={branch} deliveries={deliveries} />
  </div>;
}
