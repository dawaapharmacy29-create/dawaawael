import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, BarChart3, Building2, CalendarRange, Gauge,
  ShoppingCart, Target, TrendingDown, TrendingUp, WalletCards,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getInvoiceNetAmount } from "@/lib/purchaseCalculations";
import {
  ANALYTICS_BRANCHES, cairoTodayKey, cycleRangeFor, calendarMonthRange,
  previousComparableRange, clampRangeToToday, summarizePeriod, growth, average,
  buildDailyComparison, targetForRange, daysInclusive,
} from "@/lib/smart-commerce-analytics";

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });
const fmtPct = (n) => n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toLocaleString("ar-EG", { maximumFractionDigits: 1 })}%`;
const money = (n) => `${fmt(n)} ج`;
const shortMoney = (n) => Number(n || 0) >= 1_000_000 ? `${(Number(n) / 1_000_000).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} مليون` : money(n);
const monthLabel = (key) => { if (!key) return ""; const [y,m] = key.slice(0,7).split("-").map(Number); return `${MONTHS_AR[m-1]} ${y}`; };

function Trend({ value, label = "مقارنة بالفترة السابقة" }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-xs text-gray-400">لا توجد فترة سابقة مكتملة للمقارنة</span>;
  const positive = value >= 0;
  return <span className={`inline-flex items-center gap-1 text-xs font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
    {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{fmtPct(value)} {label}
  </span>;
}

function KpiCard({ title, value, subtitle, trend, icon: Icon, tone = "teal" }) {
  const styles = {
    teal: "bg-teal-50 border-teal-200 text-teal-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return <Card className={`p-4 border ${styles[tone] || styles.teal}`}>
    <div className="flex items-center justify-between gap-2 mb-2"><p className="text-xs font-semibold text-gray-600">{title}</p><Icon className="w-5 h-5" /></div>
    <p className="text-2xl font-black">{value}</p>
    {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
    {trend !== undefined && <div className="mt-2"><Trend value={trend} /></div>}
  </Card>;
}

function RatioStatus({ ratio, baseline }) {
  if (ratio === null) return { label: "لا توجد مبيعات كافية", tone: "gray", delta: null };
  const delta = baseline > 0 ? ratio - baseline : 0;
  if (baseline > 0 && delta >= 7) return { label: "الشراء أسرع من المعتاد", tone: "red", delta };
  if (baseline > 0 && delta <= -7) return { label: "الشراء أقل من المعتاد", tone: "green", delta };
  return { label: "معدل الشراء متوازن", tone: "blue", delta };
}

export default function SmartCommerceAnalytics() {
  const today = cairoTodayKey();
  const [mode, setMode] = useState("cycle");
  const [branch, setBranch] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { data: handovers = [], isLoading: salesLoading } = useQuery({
    queryKey: ["smart-analytics-handovers"],
    queryFn: () => base44.entities.ShiftDelivery.list("-shift_date", 3000),
    staleTime: 30000,
  });
  const { data: invoices = [], isLoading: purchaseLoading } = useQuery({
    queryKey: ["smart-analytics-purchases"],
    queryFn: () => base44.entities.PurchaseInvoice.list("-invoice_date", 5000),
    staleTime: 30000,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["smart-analytics-suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    staleTime: 60000,
  });
  const { data: targets = [] } = useQuery({
    queryKey: ["smart-analytics-targets"],
    queryFn: () => base44.entities.TargetGoal.list(),
    staleTime: 60000,
  });

  const fullRange = useMemo(() => {
    if (mode === "month") return calendarMonthRange(today);
    if (mode === "custom") return { from: customFrom || today, to: customTo || today };
    return cycleRangeFor(today);
  }, [mode, customFrom, customTo, today]);
  const currentRange = useMemo(() => clampRangeToToday(fullRange, today), [fullRange, today]);
  const prevRange = useMemo(() => previousComparableRange(currentRange, 1), [currentRange]);
  const prevRanges = useMemo(() => [1,2,3].map((i) => previousComparableRange(currentRange, i)), [currentRange]);

  const current = useMemo(() => summarizePeriod({ handovers, invoices, suppliers, ...currentRange, branch }), [handovers, invoices, suppliers, currentRange, branch]);
  const previous = useMemo(() => summarizePeriod({ handovers, invoices, suppliers, ...prevRange, branch }), [handovers, invoices, suppliers, prevRange, branch]);
  const previous3 = useMemo(() => prevRanges.map((r) => summarizePeriod({ handovers, invoices, suppliers, ...r, branch })), [handovers, invoices, suppliers, prevRanges, branch]);
  const salesGrowth = growth(current.sales, previous.sales);
  const purchaseGrowth = growth(current.purchases, previous.purchases);
  const avg3Sales = average(previous3.map((x) => x.sales));
  const avg3Purchases = average(previous3.map((x) => x.purchases));
  const avg3Ratio = average(previous3.map((x) => x.ratio).filter((x) => x !== null));
  const ratioStatus = RatioStatus({ ratio: current.ratio, baseline: avg3Ratio });
  const elapsedDays = daysInclusive(currentRange.from, currentRange.to);
  const totalPeriodDays = daysInclusive(fullRange.from, fullRange.to);
  const projectedSales = elapsedDays > 0 ? (current.sales / elapsedDays) * totalPeriodDays : 0;
  const projectedPurchases = elapsedDays > 0 ? (current.purchases / elapsedDays) * totalPeriodDays : 0;
  const dailyComparison = useMemo(() => buildDailyComparison({ handovers, invoices, suppliers, currentRange, previousRange: prevRange, branch }), [handovers, invoices, suppliers, currentRange, prevRange, branch]);

  const branchRows = useMemo(() => ANALYTICS_BRANCHES.map((b) => {
    const now = summarizePeriod({ handovers, invoices, suppliers, ...currentRange, branch: b });
    const prev = summarizePeriod({ handovers, invoices, suppliers, ...prevRange, branch: b });
    const target = targetForRange(targets, b, fullRange);
    const projected = elapsedDays > 0 ? (now.sales / elapsedDays) * totalPeriodDays : 0;
    return {
      branch: b, ...now, salesGrowth: growth(now.sales, prev.sales), purchaseGrowth: growth(now.purchases, prev.purchases),
      target, achievedPct: target > 0 ? (now.sales / target) * 100 : null,
      projected, projectedPct: target > 0 ? (projected / target) * 100 : null,
    };
  }), [handovers, invoices, suppliers, targets, currentRange, prevRange, fullRange, elapsedDays, totalPeriodDays]);

  const todaySummary = useMemo(() => summarizePeriod({ handovers, invoices, suppliers, from: today, to: today, branch }), [handovers, invoices, suppliers, today, branch]);
  const yesterdayKey = useMemo(() => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }, [today]);
  const yesterdaySummary = useMemo(() => summarizePeriod({ handovers, invoices, suppliers, from: yesterdayKey, to: yesterdayKey, branch }), [handovers, invoices, suppliers, yesterdayKey, branch]);

  const topSuppliers = useMemo(() => {
    const map = {};
    invoices.filter((i) => i.invoice_date >= currentRange.from && i.invoice_date <= currentRange.to && (branch === "all" || i.branch === branch)).forEach((i) => {
      const name = i.supplier_name || "غير محدد";
      map[name] = (map[name] || 0) + getInvoiceNetAmount(i, suppliers);
    });
    return Object.entries(map).map(([name,total]) => ({ name,total })).sort((a,b) => b.total-a.total).slice(0,5);
  }, [invoices, suppliers, currentRange, branch]);

  const loading = salesLoading || purchaseLoading;
  const periodTitle = mode === "cycle" ? `الدورة ${currentRange.from} ← ${fullRange.to}` : mode === "month" ? monthLabel(currentRange.from) : `${currentRange.from} ← ${currentRange.to}`;

  if (loading) return <div className="p-10 text-center text-gray-400" dir="rtl">جاري تجهيز التحليلات الذكية...</div>;

  return <div dir="rtl" className="p-4 md:p-6 space-y-6">
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2"><BarChart3 className="w-7 h-7 text-teal-600" /> تحليلات المبيعات والمشتريات</h1>
        <p className="text-sm text-gray-500 mt-1">متابعة يومية وشهرية ذكية لمسار البيع والشراء والتارجت — {periodTitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[{k:"cycle",l:"الدورة 26 → 25"},{k:"month",l:"الشهر الميلادي"},{k:"custom",l:"فترة مخصصة"}].map((x) => <Button key={x.k} size="sm" variant={mode===x.k?"default":"outline"} onClick={()=>setMode(x.k)}>{x.l}</Button>)}
        <select value={branch} onChange={(e)=>setBranch(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white"><option value="all">كل الفروع</option>{ANALYTICS_BRANCHES.map((b)=><option key={b} value={b}>{b}</option>)}</select>
      </div>
    </div>

    {mode === "custom" && <Card className="p-3 flex flex-wrap gap-3 items-center"><CalendarRange className="w-4 h-4 text-gray-400"/><span className="text-xs text-gray-500">من</span><input type="date" value={customFrom} onChange={(e)=>setCustomFrom(e.target.value)} className="border rounded px-2 py-1 text-sm"/><span className="text-xs text-gray-500">إلى</span><input type="date" value={customTo} onChange={(e)=>setCustomTo(e.target.value)} className="border rounded px-2 py-1 text-sm"/></Card>}

    {current.reviewRecords > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-2 text-amber-800"><AlertTriangle className="w-5 h-5 shrink-0"/><div><p className="font-bold text-sm">يوجد {current.reviewRecords.toLocaleString("ar-EG")} سجل تسليم تحت المراجعة</p><p className="text-xs mt-1">تم استبعاد قيمتها ({money(current.reviewSales)}) من مؤشرات المبيعات التنفيذية حتى لا تتضخم التقارير. السجلات نفسها محفوظة ولم تُحذف.</p></div></div>}

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard title="مبيعات الفترة حتى الآن" value={shortMoney(current.sales)} subtitle={`السابق: ${money(previous.sales)} · متوسط 3 دورات: ${money(avg3Sales)}`} trend={salesGrowth} icon={TrendingUp} tone="teal" />
      <KpiCard title="صافي المشتريات حتى الآن" value={shortMoney(current.purchases)} subtitle={`السابق: ${money(previous.purchases)} · متوسط 3 دورات: ${money(avg3Purchases)}`} trend={purchaseGrowth} icon={ShoppingCart} tone="blue" />
      <KpiCard title="نسبة المشتريات إلى المبيعات" value={current.ratio === null ? "—" : `${current.ratio.toLocaleString("ar-EG", {maximumFractionDigits:1})}%`} subtitle={`المعتاد آخر 3 دورات: ${avg3Ratio ? avg3Ratio.toLocaleString("ar-EG", {maximumFractionDigits:1}) : "—"}%`} icon={Gauge} tone={ratioStatus.tone === "red" ? "rose" : ratioStatus.tone === "green" ? "emerald" : "violet"} />
      <KpiCard title="المتوقع بنهاية الفترة" value={shortMoney(projectedSales)} subtitle={`مشتريات متوقعة: ${money(projectedPurchases)} · ${elapsedDays} يوم مسجل من ${totalPeriodDays}`} icon={Target} tone="amber" />
    </div>

    <Card className={`p-4 border ${ratioStatus.tone === "red" ? "border-red-300 bg-red-50" : ratioStatus.tone === "green" ? "border-emerald-300 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><p className="font-black text-gray-800 flex items-center gap-2"><Gauge className="w-5 h-5"/> مؤشر سرعة الشراء: {ratioStatus.label}</p><p className="text-xs text-gray-500 mt-1">المؤشر يقارن نسبة الشراء/البيع الحالية بمتوسط نفس المدة في آخر 3 دورات، وليس بتارجت المبيعات بشكل خاطئ.</p></div>
        <div className="text-left"><p className="text-xl font-black">{current.ratio === null ? "—" : `${current.ratio.toLocaleString("ar-EG", {maximumFractionDigits:1})}%`}</p>{ratioStatus.delta !== null && <p className="text-xs text-gray-500">فرق عن المعتاد: {fmtPct(ratioStatus.delta)}</p>}</div>
      </div>
    </Card>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="p-4"><p className="text-xs text-gray-500">مبيعات اليوم</p><p className="text-2xl font-black text-teal-700 mt-1">{money(todaySummary.sales)}</p><Trend value={growth(todaySummary.sales, yesterdaySummary.sales)} label="مقارنة بأمس"/></Card>
      <Card className="p-4"><p className="text-xs text-gray-500">مشتريات اليوم</p><p className="text-2xl font-black text-blue-700 mt-1">{money(todaySummary.purchases)}</p><Trend value={growth(todaySummary.purchases, yesterdaySummary.purchases)} label="مقارنة بأمس"/></Card>
    </div>

    <Card className="p-4">
      <div className="mb-4"><h2 className="font-black text-gray-800">المسار اليومي — الفترة الحالية مقابل السابقة</h2><p className="text-xs text-gray-500">المبيعات والمشتريات لكل يوم بنفس ترتيب أيام الفترة للمقارنة العادلة</p></div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={dailyComparison} margin={{top:10,right:5,left:5,bottom:5}}>
          <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day" tick={{fontSize:11}}/><YAxis tickFormatter={(v)=>fmt(v)} tick={{fontSize:10}} width={65}/>
          <Tooltip formatter={(v,n)=>[money(v), n === "sales" ? "مبيعات الفترة الحالية" : n === "prevSales" ? "مبيعات الفترة السابقة" : n === "purchases" ? "مشتريات الفترة الحالية" : "مشتريات الفترة السابقة"]} labelFormatter={(d)=>`اليوم رقم ${d}`}/>
          <Bar dataKey="sales" fill="#0d9488" radius={[4,4,0,0]}/><Bar dataKey="prevSales" fill="#99f6e4" radius={[4,4,0,0]}/>
          <Line type="monotone" dataKey="purchases" stroke="#2563eb" strokeWidth={3} dot={{r:2}}/><Line type="monotone" dataKey="prevPurchases" stroke="#93c5fd" strokeWidth={2} strokeDasharray="5 4" dot={false}/>
          {avg3Sales > 0 && <ReferenceLine y={avg3Sales / Math.max(elapsedDays,1)} stroke="#f59e0b" strokeDasharray="4 4" label={{value:"متوسط مبيعات 3 دورات",fontSize:10,fill:"#b45309"}}/>}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>

    <Card className="overflow-hidden">
      <div className="p-4 border-b"><h2 className="font-black text-gray-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-violet-600"/> مقارنة الفروع والتارجت</h2></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>{["الفرع","المبيعات","نمو المبيعات","المشتريات","نمو المشتريات","شراء/بيع","التارجت","المتوقع نهاية الفترة"].map((h)=><th key={h} className="p-3 text-right text-xs text-gray-500">{h}</th>)}</tr></thead><tbody>{branchRows.map((r)=><tr key={r.branch} className="border-t"><td className="p-3 font-bold">{r.branch}</td><td className="p-3 font-bold text-teal-700">{money(r.sales)}</td><td className={`p-3 font-bold ${r.salesGrowth !== null && r.salesGrowth < 0 ? "text-red-600":"text-emerald-600"}`}>{fmtPct(r.salesGrowth)}</td><td className="p-3 font-bold text-blue-700">{money(r.purchases)}</td><td className={`p-3 font-bold ${r.purchaseGrowth !== null && r.purchaseGrowth > 0 ? "text-amber-600":"text-gray-600"}`}>{fmtPct(r.purchaseGrowth)}</td><td className="p-3">{r.ratio===null?"—":`${r.ratio.toLocaleString("ar-EG",{maximumFractionDigits:1})}%`}</td><td className="p-3">{r.target>0?<><div className="font-bold">{r.achievedPct?.toLocaleString("ar-EG",{maximumFractionDigits:1})}%</div><div className="text-[10px] text-gray-400">{money(r.sales)} من {money(r.target)}</div></>:"غير محدد"}</td><td className={`p-3 font-bold ${r.projectedPct !== null && r.projectedPct < 90 ? "text-red-600":"text-emerald-600"}`}>{r.projectedPct===null?money(r.projected):`${r.projectedPct.toLocaleString("ar-EG",{maximumFractionDigits:0})}% · ${money(r.projected)}`}</td></tr>)}</tbody></table></div>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4"><h2 className="font-black text-gray-800 mb-3 flex items-center gap-2"><WalletCards className="w-5 h-5 text-purple-600"/> أعلى الموردين في الفترة</h2>{topSuppliers.length===0?<p className="text-sm text-gray-400">لا توجد مشتريات في الفترة</p>:<div className="space-y-2">{topSuppliers.map((s,i)=><div key={s.name} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2"><div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">{i+1}</div><span className="flex-1 text-sm font-semibold truncate">{s.name}</span><span className="font-bold text-purple-700">{money(s.total)}</span></div>)}</div>}</Card>
      <Card className="p-4"><h2 className="font-black text-gray-800 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-teal-600"/> قراءة إدارية سريعة</h2><div className="space-y-2 text-sm text-gray-700"><p>• متوسط المبيعات اليومي الحالي: <b>{money(current.avgSales)}</b> مقابل <b>{money(previous.avgSales)}</b> في الفترة السابقة.</p><p>• متوسط المشتريات في أيام الشراء: <b>{money(current.avgPurchases)}</b>.</p><p>• التوقع الحالي لنهاية الفترة: مبيعات <b>{money(projectedSales)}</b> ومشتريات <b>{money(projectedPurchases)}</b>.</p><p>• الفرق عن متوسط مبيعات آخر 3 دورات لنفس المدة: <b className={growth(current.sales,avg3Sales)>=0?"text-emerald-600":"text-red-600"}>{fmtPct(growth(current.sales,avg3Sales))}</b>.</p><p>• حالة الشراء الحالية: <b>{ratioStatus.label}</b>.</p></div></Card>
    </div>
  </div>;
}
