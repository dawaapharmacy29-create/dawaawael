import { TrendingUp, Wallet, ShoppingBag, CreditCard, AlertCircle, Banknote, Percent } from "lucide-react";
import { fmtCurrency } from "@/lib/financial-report-utils";

// النسبة المرجعية المستهدفة لنسبة المشتريات إلى المبيعات
const PURCHASE_RATIO_TARGET = 70;

const ROW1_KPIS = [
  { key: "totalSales", label: "إجمالي المبيعات", icon: TrendingUp, gradient: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", text: "text-emerald-700" },
  { key: "netSales", label: "صافي المبيعات", icon: Wallet, gradient: "from-teal-500 to-teal-600", bg: "bg-teal-50", text: "text-teal-700" },
  { key: "totalPurchases", label: "إجمالي المشتريات", icon: ShoppingBag, gradient: "from-blue-500 to-blue-600", bg: "bg-blue-50", text: "text-blue-700" },
];

const ROW2_KPIS = [
  { key: "totalPayments", label: "إجمالي المدفوعات", icon: CreditCard, gradient: "from-indigo-500 to-indigo-600", bg: "bg-indigo-50", text: "text-indigo-700" },
  { key: "currentDebts", label: "إجمالي الديون الحالية", icon: AlertCircle, iconBg: "bg-[#e63965]", bg: "bg-[#f9f2f5]", labelColor: "text-[#4a454d]", valueColor: "text-[#a6354b]" },
  { key: "supplierPayments", label: "الدفعات المسددة للموردين", icon: Banknote, gradient: "from-amber-500 to-amber-600", bg: "bg-amber-50", text: "text-amber-700" },
];

function KpiCard({ label, icon: Icon, gradient, bg, text, iconBg, labelColor, valueColor, value }) {
  const useSolid = !!iconBg;
  return (
    <div className={`rounded-xl p-4 ${bg} border border-black/5 shadow-sm`}>
      <div className={`w-9 h-9 rounded-lg ${useSolid ? iconBg : `bg-gradient-to-br ${gradient}`} flex items-center justify-center mb-2`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className={`text-xs mb-0.5 leading-tight ${labelColor || "text-gray-500"}`}>{label}</p>
      <p className={`text-sm md:text-base font-bold ${valueColor || text}`}>{value}</p>
    </div>
  );
}

export default function FinancialKpiCards({ data }) {
  const purchaseRatio = data.totalSales > 0 ? (data.totalPurchases / data.totalSales) * 100 : 0;
  const ratioIsHealthy = purchaseRatio <= PURCHASE_RATIO_TARGET;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ROW1_KPIS.map((kpi) => (
          <KpiCard key={kpi.key} {...kpi} value={fmtCurrency(data[kpi.key])} />
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROW2_KPIS.map((kpi) => (
          <KpiCard key={kpi.key} {...kpi} value={fmtCurrency(data[kpi.key])} />
        ))}
        <div className={`rounded-xl p-4 border border-black/5 shadow-sm ${ratioIsHealthy ? "bg-emerald-50" : "bg-red-50"}`}>
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ratioIsHealthy ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600"} flex items-center justify-center mb-2`}>
            <Percent className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs mb-0.5 leading-tight text-gray-500">نسبة المشتريات للمبيعات</p>
          <p className={`text-sm md:text-base font-bold ${ratioIsHealthy ? "text-emerald-700" : "text-red-700"}`}>{purchaseRatio.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-400 mt-0.5">النسبة المرجعية: {PURCHASE_RATIO_TARGET}%</p>
        </div>
      </div>
    </div>
  );
}
