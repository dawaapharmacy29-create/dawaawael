import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, AlertTriangle, Building2, CalendarRange, CreditCard, FileText, HandCoins, Target, TrendingUp, WalletCards } from "lucide-react";
import { loadInvoicesByFinancialDate } from "@/lib/invoiceRangeLoader";
import { getInvoiceCanonicalKey } from "@/lib/invoiceIdentity";
import { isInvoiceFinanciallyApproved, getInvoiceCreditAmount } from "@/lib/purchaseCalculations";
import { cairoTodayKey, cycleRangeFor } from "@/lib/smart-commerce-analytics";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const money = (n) => `${Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const paymentSigned = (p) => p.status === "reversed" ? 0 : (p.transaction_type === "reversal" ? -1 : 1) * (Number(p.amount) || 0);

function addMonths(dateKey, months) {
  const [y,m,d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1 + months, Math.min(d || 1, 28));
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function monthStart(dateKey) { return `${dateKey.slice(0,7)}-01`; }
function monthLabel(key) {
  const [y,m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}
function invoiceGross(inv) { return Math.max(0, (Number(inv.total_value) || 0) - (Number(inv.returned_value) || 0)); }

function Metric({ title, value, subtitle, icon: Icon, tone="blue" }) {
  const cls = { blue:"bg-blue-50 border-blue-200 text-blue-700", teal:"bg-teal-50 border-teal-200 text-teal-700", emerald:"bg-emerald-50 border-emerald-200 text-emerald-700", amber:"bg-amber-50 border-amber-200 text-amber-700", rose:"bg-rose-50 border-rose-200 text-rose-700", violet:"bg-violet-50 border-violet-200 text-violet-700" }[tone];
  return <Card className={`p-4 border ${cls}`}><div className="flex items-center justify-between gap-2"><p className="text-xs text-gray-600 font-semibold">{title}</p><Icon className="w-5 h-5"/></div><p className="text-xl font-black mt-2">{value}</p>{subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}</Card>;
}

export default function SupplierIntelligence() {
  const today = cairoTodayKey();
  const cycle = cycleRangeFor(today);
  const [supplierName, setSupplierName] = useState("");
  const [branch, setBranch] = useState("all");
  const [from, setFrom] = useState(cycle.from);
  const [to, setTo] = useState(today);

  const { data: suppliers = [] } = useQuery({ queryKey:["suppliers"], queryFn:()=>base44.entities.Supplier.list("name"), staleTime:300000 });
  const selectedSupplier = suppliers.find((s) => s.name === supplierName) || null;
  const enabled = Boolean(supplierName && from && to);
  const branchFilter = branch === "all" ? {} : { branch };

  const historyFrom = useMemo(() => monthStart(addMonths(today, -11)), [today]);
  const queryFrom = from < historyFrom ? from : historyFrom;

  const { data: invoicesRaw = [], isLoading: loadingInvoices } = useQuery({
    queryKey:["supplier-intelligence-invoices", supplierName, branch, queryFrom, to],
    queryFn:()=>loadInvoicesByFinancialDate(base44.entities.PurchaseInvoice, { from:queryFrom, to, extraFilter:{ supplier_name:supplierName, ...branchFilter }, sort:"invoice_date", maxRows:30000 }),
    enabled,
    staleTime:120000,
  });
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey:["supplier-intelligence-payments", supplierName, queryFrom, to],
    queryFn:async()=>{
      const rows=[]; const PAGE=500;
      for(let offset=0; rows.length<20000; offset+=PAGE){
        const batch=await base44.entities.SupplierPayment.filter({ supplier_name:supplierName, payment_date:{ $gte:queryFrom, $lte:to } }, "payment_date", PAGE, offset);
        rows.push(...batch); if(batch.length<PAGE) break;
      }
      return rows;
    },
    enabled,
    staleTime:120000,
  });
  const { data: openCreditInvoices = [] } = useQuery({
    queryKey:["supplier-intelligence-open-credit", supplierName, branch],
    queryFn:async()=>{
      const rows=[]; const PAGE=500;
      for(let offset=0; rows.length<30000; offset+=PAGE){
        const batch=await base44.entities.PurchaseInvoice.filter({ supplier_name:supplierName, payment_type:"آجل", ...branchFilter }, "-invoice_date", PAGE, offset);
        rows.push(...batch); if(batch.length<PAGE) break;
      }
      return rows.filter(isInvoiceFinanciallyApproved);
    },
    enabled:Boolean(supplierName),
    staleTime:120000,
  });
  const { data: allSupplierPayments = [] } = useQuery({
    queryKey:["supplier-intelligence-all-payments", supplierName],
    queryFn:async()=>{
      const rows=[]; const PAGE=500;
      for(let offset=0; rows.length<20000; offset+=PAGE){
        const batch=await base44.entities.SupplierPayment.filter({ supplier_name:supplierName }, "-payment_date", PAGE, offset);
        rows.push(...batch); if(batch.length<PAGE) break;
      }
      return rows;
    },
    enabled:Boolean(supplierName),
    staleTime:120000,
  });
  const { data: debts = [] } = useQuery({
    queryKey:["supplier-intelligence-debt", supplierName],
    queryFn:()=>base44.entities.SupplierDebt.filter({ supplier_name:supplierName }, "branch", 20),
    enabled:Boolean(supplierName),
    staleTime:300000,
  });

  const approved = useMemo(() => invoicesRaw.filter(isInvoiceFinanciallyApproved).filter((i)=>(i.transaction_type || "external_purchase") !== "internal_transfer"), [invoicesRaw]);
  const periodInvoices = useMemo(() => approved.filter((i)=>{ const d=(i.invoice_date || i.created_date?.slice(0,10) || ""); return d>=from && d<=to; }), [approved,from,to]);
  const scopedPayments = useMemo(() => payments.filter((p)=>(branch==="all" || !p.branch || p.branch===branch)), [payments,branch]);
  const periodPayments = useMemo(() => scopedPayments.filter((p)=>p.payment_date>=from && p.payment_date<=to), [scopedPayments,from,to]);

  const summary = useMemo(() => {
    const billedPurchases = periodInvoices.reduce((s,i)=>s+(Number(i.total_value)||0),0);
    const withdrawals = periodInvoices.reduce((s,i)=>s+invoiceGross(i),0);
    const returns = periodInvoices.reduce((s,i)=>s+(Number(i.returned_value)||0),0);
    const creditPurchases = periodInvoices.reduce((s,i)=>s+getInvoiceCreditAmount(i),0);
    const paid = periodPayments.reduce((s,p)=>s+paymentSigned(p),0);
    const avgInvoice = periodInvoices.length ? withdrawals/periodInvoices.length : 0;
    const monthKeys = [...new Set(periodInvoices.map(i=>(i.invoice_date || i.created_date?.slice(0,7) || "").slice(0,7)).filter(Boolean))];
    const avgMonthly = monthKeys.length ? withdrawals/monthKeys.length : 0;
    return { billedPurchases, withdrawals, returns, creditPurchases, paid, avgInvoice, avgMonthly, invoiceCount:periodInvoices.length, monthCount:monthKeys.length, netMovement:creditPurchases-paid };
  }, [periodInvoices,periodPayments]);

  const currentBalanceDetails = useMemo(() => {
    const remainingInvoices = openCreditInvoices.reduce((s,inv)=>s+Math.max(0, invoiceGross(inv)-(Number(inv.paid_value)||0)),0);
    const debtRows = debts.filter((d)=>branch==="all" || d.branch===branch);
    const oldDebt = debtRows.reduce((s,d)=>s+(Number(d.initial_debt)||0),0);
    const adjustment = debtRows.reduce((s,d)=>s+(Number(d.adjustment)||0),0);
    const generalRows = allSupplierPayments.filter((p)=>!p.invoice_id && p.allocation_type!=="multi_invoice");
    const attributedGeneral = generalRows.filter((p)=>branch==="all" || p.branch===branch).reduce((s,p)=>s+paymentSigned(p),0);
    const unassignedGeneral = branch === "all" ? 0 : generalRows.filter((p)=>!p.branch).reduce((s,p)=>s+paymentSigned(p),0);
    return {
      remainingInvoices: round2(remainingInvoices), oldDebt: round2(oldDebt), adjustment: round2(adjustment),
      generalPayments: round2(attributedGeneral), unassignedGeneral: round2(unassignedGeneral),
      balance: round2(remainingInvoices + oldDebt + adjustment - attributedGeneral),
    };
  }, [openCreditInvoices,debts,allSupplierPayments,branch]);
  const currentBalance = currentBalanceDetails.balance;

  const quality = useMemo(() => {
    const rawPeriod = invoicesRaw.filter((i)=>{ const d=(i.invoice_date || i.created_date?.slice(0,10) || ""); return d>=from && d<=to && (i.transaction_type || "external_purchase") !== "internal_transfer"; });
    const pending = rawPeriod.filter((i)=>i.status === "انتظار المراجعة");
    const rejected = rawPeriod.filter((i)=>i.status === "مرفوضة");
    const approvedRows = rawPeriod.filter(isInvoiceFinanciallyApproved);
    const zeroRows = approvedRows.filter((i)=>invoiceGross(i)<=0.009);
    const groups = new Map();
    approvedRows.forEach((i)=>{ const key=getInvoiceCanonicalKey(i); if(!key)return; if(!groups.has(key))groups.set(key,[]); groups.get(key).push(i); });
    const duplicateGroups = [...groups.values()].filter((rows)=>rows.length>1);
    const positiveValues = approvedRows.map(invoiceGross).filter((v)=>v>0).sort((a,b)=>a-b);
    const median = positiveValues.length ? positiveValues[Math.floor(positiveValues.length/2)] : 0;
    const extremeRows = approvedRows.filter((i)=>{ const v=invoiceGross(i); return v>0 && median>0 && v>=Math.max(50000,median*5); });
    return {
      pendingCount:pending.length, pendingValue:round2(pending.reduce((s,i)=>s+invoiceGross(i),0)),
      rejectedCount:rejected.length, zeroCount:zeroRows.length, duplicateGroups, extremeRows, median,
      issueCount:pending.length+rejected.length+zeroRows.length+duplicateGroups.length+extremeRows.length,
    };
  }, [invoicesRaw,from,to]);

  const branchComparison = useMemo(() => BRANCHES.map((b) => {
    const rows = periodInvoices.filter((i)=>i.branch===b);
    const purchases = rows.reduce((s,i)=>s+invoiceGross(i),0);
    const branchOpen = openCreditInvoices.filter((i)=>i.branch===b).reduce((s,i)=>s+Math.max(0,invoiceGross(i)-(Number(i.paid_value)||0)),0);
    const debtRows = debts.filter((d)=>d.branch===b);
    const legacy = debtRows.reduce((s,d)=>s+(Number(d.initial_debt)||0)+(Number(d.adjustment)||0),0);
    const branchGeneral = allSupplierPayments.filter((p)=>!p.invoice_id && p.allocation_type!=="multi_invoice" && p.branch===b).reduce((s,p)=>s+paymentSigned(p),0);
    return { branch:b, purchases:round2(purchases), invoiceCount:rows.length, avgInvoice:rows.length?purchases/rows.length:0, currentBalance:round2(branchOpen+legacy-branchGeneral) };
  }), [periodInvoices,openCreditInvoices,debts,allSupplierPayments]);

  const monthly = useMemo(() => {
    const map=new Map();
    for(let i=0;i<12;i++){ const key=addMonths(today,-i).slice(0,7); map.set(key,{ month:key,purchases:0,payments:0,invoices:0,avgInvoice:0 }); }
    approved.forEach(inv=>{ const key=(inv.invoice_date || inv.created_date?.slice(0,7) || "").slice(0,7); if(!map.has(key)) return; const r=map.get(key); r.purchases+=invoiceGross(inv); r.invoices+=1; });
    scopedPayments.forEach(p=>{ const key=(p.payment_date||"").slice(0,7); if(!map.has(key)) return; map.get(key).payments+=paymentSigned(p); });
    return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(r=>({...r,avgInvoice:r.invoices?r.purchases/r.invoices:0}));
  }, [approved,scopedPayments,today]);

  const negotiation = useMemo(() => {
    const calc=(n)=>{ const rows=monthly.slice(-n); const total=rows.reduce((s,r)=>s+r.purchases,0); const active=rows.filter(r=>r.purchases>0).length; return { total, avg:active?total/active:0, active }; };
    const m3=calc(3), m6=calc(6), m12=calc(12);
    const activeRows=monthly.filter(r=>r.purchases>0);
    const best=activeRows.length ? [...activeRows].sort((a,b)=>b.purchases-a.purchases)[0] : null;
    const last3=monthly.slice(-3).reduce((s,r)=>s+r.purchases,0);
    const prev3=monthly.slice(-6,-3).reduce((s,r)=>s+r.purchases,0);
    const trend=prev3>0 ? ((last3-prev3)/prev3)*100 : null;
    return {m3,m6,m12,best,trend};
  }, [monthly]);

  const setPreset=(months)=>{ setFrom(monthStart(addMonths(today, -(months-1)))); setTo(today); };
  const loading = loadingInvoices || loadingPayments;

  return <div dir="rtl" className="p-4 md:p-6 space-y-5">
    <div><h1 className="text-2xl font-black text-gray-900 flex items-center gap-2"><TrendingUp className="w-6 h-6 text-teal-600"/> تحليل الموردين والتفاوض</h1><p className="text-sm text-gray-500 mt-1">اعرف رصيد المورد وحجم المسحوبات والمدفوعات ومتوسط التعامل وتاريخ العلاقة قبل أي تفاوض على الخصم.</p></div>

    <Card className="p-4"><div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
      <div><Label>المورد</Label><select value={supplierName} onChange={e=>setSupplierName(e.target.value)} className="w-full h-10 border rounded-md px-3 bg-white text-sm"><option value="">اختر المورد</option>{suppliers.filter(s=>s.is_active!==false && (s.supplier_type||"external_supplier")==="external_supplier").map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
      <div><Label>الفرع</Label><select value={branch} onChange={e=>setBranch(e.target.value)} className="w-full h-10 border rounded-md px-3 bg-white text-sm"><option value="all">كل الفروع</option>{BRANCHES.map(b=><option key={b}>{b}</option>)}</select></div>
      <div><Label>من</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
      <div><Label>إلى</Label><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
    </div><div className="flex flex-wrap gap-2 mt-3"><Button size="sm" variant="outline" onClick={()=>{setFrom(cycle.from);setTo(today)}}>الدورة الحالية</Button><Button size="sm" variant="outline" onClick={()=>setPreset(3)}>آخر 3 شهور</Button><Button size="sm" variant="outline" onClick={()=>setPreset(6)}>آخر 6 شهور</Button><Button size="sm" variant="outline" onClick={()=>setPreset(12)}>آخر 12 شهر</Button></div></Card>

    {!supplierName ? <Card className="p-12 text-center text-gray-400"><Target className="w-10 h-10 mx-auto mb-2 opacity-30"/><p>اختر موردًا لتظهر الصورة المالية والتفاوضية كاملة.</p></Card> : loading ? <Card className="p-10 text-center text-gray-400">جاري تجهيز تحليل المورد...</Card> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric title={currentBalance >= 0 ? "الرصيد الحالي علينا" : "رصيد لصالحنا عند المورد"} value={money(Math.abs(currentBalance))} subtitle="رصيد حالي مستقل عن الفترة المختارة" icon={HandCoins} tone={currentBalance>=0?"rose":"emerald"}/>
        <Metric title="صافي مسحوبات الفترة" value={money(summary.withdrawals)} subtitle={`${summary.invoiceCount.toLocaleString("ar-EG")} فاتورة · قبل المرتجعات ${money(summary.billedPurchases)}`} icon={WalletCards} tone="teal"/>
        <Metric title="المشتريات الآجل في الفترة" value={money(summary.creditPurchases)} subtitle="الجزء الذي يكوّن مديونية" icon={FileText} tone="amber"/>
        <Metric title="المدفوع في الفترة" value={money(summary.paid)} subtitle="بعد حركات العكس Reversal" icon={CreditCard} tone="emerald"/>
        <Metric title="متوسط قيمة الفاتورة" value={money(summary.avgInvoice)} subtitle="صافي بعد المرتجع" icon={Activity} tone="blue"/>
        <Metric title="متوسط المسحوبات الشهري" value={money(summary.avgMonthly)} subtitle={`${summary.monthCount.toLocaleString("ar-EG")} شهر فيه تعامل`} icon={CalendarRange} tone="violet"/>
        <Metric title="صافي حركة الآجل بالفترة" value={money(summary.netMovement)} subtitle="آجل الفترة − الدفعات" icon={TrendingUp} tone={summary.netMovement>0?"rose":"emerald"}/>
        <Metric title="المرتجعات في الفترة" value={money(summary.returns)} subtitle="خصومات من إجمالي الفواتير" icon={FileText} tone="amber"/>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3"><HandCoins className="w-5 h-5 text-rose-600"/><h2 className="font-black text-gray-800">تركيب الرصيد الحالي</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg bg-blue-50 border p-3"><p className="text-xs text-gray-500">متبقي الفواتير الآجل المعتمدة</p><p className="font-black text-blue-700 text-lg">{money(currentBalanceDetails.remainingInvoices)}</p></div>
          <div className="rounded-lg bg-amber-50 border p-3"><p className="text-xs text-gray-500">مديونية افتتاحية</p><p className="font-black text-amber-700 text-lg">{money(currentBalanceDetails.oldDebt)}</p></div>
          <div className="rounded-lg bg-violet-50 border p-3"><p className="text-xs text-gray-500">تسويات الرصيد</p><p className="font-black text-violet-700 text-lg">{money(currentBalanceDetails.adjustment)}</p></div>
          <div className="rounded-lg bg-emerald-50 border p-3"><p className="text-xs text-gray-500">دفعات عامة مخصومة</p><p className="font-black text-emerald-700 text-lg">{money(currentBalanceDetails.generalPayments)}</p></div>
        </div>
        {branch !== "all" && Math.abs(currentBalanceDetails.unassignedGeneral) > 0.009 && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><b>تنبيه دقة:</b> يوجد {money(currentBalanceDetails.unassignedGeneral)} دفعات قديمة لهذا المورد بدون فرع محدد. لم أنسبها لهذا الفرع تلقائيًا حتى لا يتم خصمها مرتين. تظهر ضمن الرصيد الإجمالي لكل الفروع فقط.</div>}
      </Card>

      {quality.issueCount > 0 && <Card className="p-4 border-amber-300 bg-amber-50"><div className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5"/><div className="flex-1"><h2 className="font-black text-amber-900">جودة بيانات المورد قبل اعتماد أرقام التفاوض</h2><p className="text-xs text-amber-800 mt-1">الفواتير المعلقة لا تدخل في المسحوبات المعتمدة. التكرارات والقيم الشاذة لا تُحذف تلقائيًا وتحتاج مطابقة مع المصدر.</p><div className="flex flex-wrap gap-2 mt-3 text-xs"><span className="rounded-full bg-white border px-2 py-1">انتظار مراجعة: {quality.pendingCount} · {money(quality.pendingValue)}</span><span className="rounded-full bg-white border px-2 py-1">مرفوضة: {quality.rejectedCount}</span><span className="rounded-full bg-white border px-2 py-1">قيمة صفر: {quality.zeroCount}</span><span className="rounded-full bg-white border px-2 py-1">مجموعات تكرار محتملة: {quality.duplicateGroups.length}</span><span className="rounded-full bg-white border px-2 py-1">قيم شاذة مرتفعة: {quality.extremeRows.length}</span></div>{quality.duplicateGroups.length>0 && <div className="mt-2 text-xs text-red-800">أمثلة تكرار: {quality.duplicateGroups.slice(0,5).map(g=>`${g[0]?.system_invoice_number} — ${g[0]?.branch} — ${g[0]?.invoice_date}`).join(" | ")}</div>}{quality.extremeRows.length>0 && <div className="mt-1 text-xs text-amber-900">أعلى قيم تحتاج تحقق: {quality.extremeRows.slice().sort((a,b)=>invoiceGross(b)-invoiceGross(a)).slice(0,5).map(i=>`${i.system_invoice_number}: ${money(invoiceGross(i))}`).join(" | ")}</div>}</div></div></Card>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-black text-gray-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600"/> مقارنة الفروع مع المورد</h2><p className="text-xs text-gray-500 mt-1">رصيد كل فرع لا ينسب إليه أي دفعة قديمة غير محدد لها فرع.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-right">الفرع</th><th className="p-3 text-left">مسحوبات الفترة</th><th className="p-3 text-center">الفواتير</th><th className="p-3 text-left">متوسط الفاتورة</th><th className="p-3 text-left">الرصيد الحالي المنسوب للفرع</th></tr></thead><tbody>{branchComparison.map(r=><tr key={r.branch} className="border-t"><td className="p-3 font-bold">{r.branch}</td><td className="p-3 text-left font-bold text-teal-700">{money(r.purchases)}</td><td className="p-3 text-center">{r.invoiceCount.toLocaleString("ar-EG")}</td><td className="p-3 text-left">{money(r.avgInvoice)}</td><td className={`p-3 text-left font-black ${r.currentBalance>=0?"text-rose-700":"text-emerald-700"}`}>{r.currentBalance>=0?money(r.currentBalance):`لصالحنا ${money(Math.abs(r.currentBalance))}`}</td></tr>)}</tbody></table></div>
      </Card>

      <Card className="p-4"><div className="flex items-center gap-2 mb-3"><Target className="w-5 h-5 text-purple-600"/><h2 className="font-black text-gray-800">قوة التفاوض مع {selectedSupplier?.name || supplierName}</h2></div><div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm"><div className="rounded-lg bg-purple-50 border p-3"><p className="text-xs text-gray-500">متوسط آخر 3 شهور النشطة</p><p className="font-black text-purple-700 text-lg">{money(negotiation.m3.avg)}</p><p className="text-[11px] text-gray-400">إجمالي {money(negotiation.m3.total)}</p></div><div className="rounded-lg bg-blue-50 border p-3"><p className="text-xs text-gray-500">متوسط آخر 6 شهور النشطة</p><p className="font-black text-blue-700 text-lg">{money(negotiation.m6.avg)}</p><p className="text-[11px] text-gray-400">إجمالي {money(negotiation.m6.total)}</p></div><div className="rounded-lg bg-teal-50 border p-3"><p className="text-xs text-gray-500">متوسط آخر 12 شهر النشطة</p><p className="font-black text-teal-700 text-lg">{money(negotiation.m12.avg)}</p><p className="text-[11px] text-gray-400">إجمالي {money(negotiation.m12.total)}</p></div><div className="rounded-lg bg-amber-50 border p-3"><p className="text-xs text-gray-500">أعلى شهر تعامل</p><p className="font-black text-amber-700 text-lg">{negotiation.best ? money(negotiation.best.purchases) : "—"}</p><p className="text-[11px] text-gray-400">{negotiation.best ? monthLabel(negotiation.best.month) : "لا توجد بيانات"}</p></div></div>{negotiation.trend!==null && <p className={`mt-3 text-sm font-bold ${negotiation.trend>=0?"text-emerald-700":"text-red-700"}`}>اتجاه آخر 3 شهور مقارنة بالـ3 السابقة: {negotiation.trend>=0?"+":""}{negotiation.trend.toLocaleString("ar-EG",{maximumFractionDigits:1})}%</p>}</Card>

      <Card className="overflow-hidden"><div className="p-4 border-b"><h2 className="font-black text-gray-800">تاريخ التعامل الشهري — آخر 12 شهر</h2><p className="text-xs text-gray-500">مفيد لتحديد حجم التعامل المتوقع والتفاوض على خصم/بونص أعلى.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-right">الشهر</th><th className="p-3 text-left">المسحوبات</th><th className="p-3 text-left">المدفوع</th><th className="p-3 text-center">الفواتير</th><th className="p-3 text-left">متوسط الفاتورة</th></tr></thead><tbody>{monthly.map(r=><tr key={r.month} className="border-t"><td className="p-3 font-medium">{monthLabel(r.month)}</td><td className="p-3 text-left font-bold text-teal-700">{money(r.purchases)}</td><td className="p-3 text-left font-bold text-emerald-700">{money(r.payments)}</td><td className="p-3 text-center">{r.invoices.toLocaleString("ar-EG")}</td><td className="p-3 text-left">{money(r.avgInvoice)}</td></tr>)}</tbody></table></div></Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="overflow-hidden"><div className="p-4 border-b"><h2 className="font-black text-gray-800">فواتير الفترة ({periodInvoices.length})</h2></div><div className="max-h-[420px] overflow-auto"><table className="w-full text-xs"><thead className="bg-gray-50 sticky top-0"><tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">الفرع</th><th className="p-2 text-right">الفاتورة</th><th className="p-2 text-left">الصافي</th><th className="p-2 text-left">المدفوع</th><th className="p-2 text-left">المتبقي</th></tr></thead><tbody>{periodInvoices.slice().sort((a,b)=>String(b.invoice_date||"").localeCompare(String(a.invoice_date||""))).map(i=>{const gross=invoiceGross(i),remaining=Math.max(0,gross-(Number(i.paid_value)||0));return <tr key={i.id} className="border-t"><td className="p-2">{i.invoice_date||i.created_date?.slice(0,10)}</td><td className="p-2">{i.branch}</td><td className="p-2 font-mono">{i.system_invoice_number||"—"}</td><td className="p-2 text-left">{money(gross)}</td><td className="p-2 text-left text-emerald-700">{money(i.paid_value)}</td><td className="p-2 text-left font-bold text-rose-700">{money(remaining)}</td></tr>})}</tbody></table></div></Card>
        <Card className="overflow-hidden"><div className="p-4 border-b"><h2 className="font-black text-gray-800">دفعات الفترة ({periodPayments.length})</h2></div><div className="max-h-[420px] overflow-auto"><table className="w-full text-xs"><thead className="bg-gray-50 sticky top-0"><tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">الفرع</th><th className="p-2 text-right">الوسيلة</th><th className="p-2 text-right">المرجع</th><th className="p-2 text-left">المبلغ</th></tr></thead><tbody>{periodPayments.slice().sort((a,b)=>String(b.payment_date||"").localeCompare(String(a.payment_date||""))).map(p=><tr key={p.id} className="border-t"><td className="p-2">{p.payment_date}</td><td className="p-2">{p.branch||"عام"}</td><td className="p-2">{p.payment_method||"قديم"}</td><td className="p-2">{p.reference_number||p.invoice_number||"—"}</td><td className={`p-2 text-left font-bold ${p.transaction_type==="reversal"?"text-red-700":"text-emerald-700"}`}>{p.transaction_type==="reversal"?"-":"+"}{money(p.amount)}</td></tr>)}</tbody></table></div></Card>
      </div>
    </>}
  </div>;
}
