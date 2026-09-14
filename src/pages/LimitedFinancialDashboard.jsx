import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, ArrowUpRight, ArrowDownRight, ShieldCheck, Building2 } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
const pctChange = (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : null;

function Kpi({ title, value, period, previous, icon: Icon, tone = "emerald" }) {
  const change = pctChange(Number(value || 0), Number(previous || 0));
  const positive = change !== null && change >= 0;
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50/50 text-blue-700",
  };
  return (
    <Card className={`p-5 border ${tones[tone] || tones.emerald}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-2xl font-black mt-1">{fmt(value)} ج</p>
          <p className="text-[11px] text-gray-500 mt-1">{period}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-2.5 border"><Icon className="w-5 h-5" /></div>
      </div>
      <div className="mt-4 pt-3 border-t border-current/10 flex items-center justify-between text-xs">
        <span className="text-gray-500">الدورة السابقة: <b className="text-gray-700">{fmt(previous)} ج</b></span>
        {change !== null && (
          <span className={`flex items-center gap-1 font-bold ${positive ? "text-emerald-700" : "text-red-600"}`}>
            {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  );
}

export default function LimitedFinancialDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["limited-financial-summary"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getLimitedFinancialSummary", {});
      const payload = res?.data || {};
      if (!payload.success) throw new Error(payload.error || "تعذر تحميل الملخص المالي");
      return payload;
    },
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div className="min-h-[55vh] flex items-center justify-center text-sm text-gray-500"><div className="w-6 h-6 border-3 border-gray-200 border-t-teal-600 rounded-full animate-spin ml-2" /> جاري تحميل الملخص المسموح...</div>;
  }

  if (error || !data) {
    return <div dir="rtl" className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-red-800">{error?.message || "تعذر تحميل الملخص المالي"}</Card></div>;
  }

  const current = data.current || {};
  const previous = data.previous || {};
  const branches = data.scope?.branches || [];
  const currentLabel = `${current.period?.from || "—"} ← ${current.period?.to || "—"}`;
  const previousLabel = `${previous.period?.from || "—"} ← ${previous.period?.to || "—"}`;

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الملخص المالي المحدود</h1>
          <p className="text-sm text-gray-500 mt-1">المبيعات والمشتريات للدورة الحالية والسابقة فقط، بدون ذمم موردين أو مصروفات أو تفاصيل فواتير.</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> {branches.join(" + ") || "نطاق غير محدد"}
        </div>
      </div>

      <Card className="p-4 border-teal-200 bg-teal-50/60 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-700 mt-0.5" />
        <div><p className="font-bold text-teal-900 text-sm">عرض مالي محدود وآمن</p><p className="text-xs text-teal-800 mt-1">هذه الشاشة تستقبل من السيرفر أرقامًا مجمعة فقط؛ لا يتم إرسال تفاصيل الموردين أو الفواتير أو المصروفات إلى المتصفح.</p></div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Kpi title="مبيعات الدورة الحالية" value={current.sales} previous={previous.sales} period={currentLabel} icon={TrendingUp} tone="emerald" />
        <Kpi title="مشتريات الدورة الحالية" value={current.purchases} previous={previous.purchases} period={currentLabel} icon={ShoppingCart} tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4"><p className="text-xs text-gray-500">مبيعات الدورة السابقة</p><p className="text-xl font-black text-emerald-700 mt-1">{fmt(previous.sales)} ج</p><p className="text-[11px] text-gray-400 mt-1">{previousLabel}</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">مشتريات الدورة السابقة</p><p className="text-xl font-black text-blue-700 mt-1">{fmt(previous.purchases)} ج</p><p className="text-[11px] text-gray-400 mt-1">{previousLabel}</p></Card>
      </div>
    </div>
  );
}
