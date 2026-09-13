import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, TrendingUp, Receipt, FileText, Pencil, Check, Banknote } from "lucide-react";

const fmt = (n, digits = 0) => (Number(n) || 0).toLocaleString("ar-EG", { maximumFractionDigits: digits });
const pct = (value, target) => target > 0 ? (Number(value || 0) / Number(target)) * 100 : 0;

function ProgressBar({ value, target, className = "bg-teal-500" }) {
  const percent = pct(value, target);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{target > 0 ? `${Math.round(percent)}%` : "—"}</span>
        <span>{target > 0 ? `المستهدف: ${fmt(target)} ج` : "لم يُحدد مستهدف"}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
        <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export default function DashboardStatsCards({
  totalSales,
  salesTargetAmount,
  totalPurchases,
  purchaseTargetAmount,
  purchaseRatio,
  totalCashPurchases,
  totalExpenses,
  invoiceCount,
  canEditSalesTarget,
  editingSalesTarget,
  salesTargetInput,
  onSalesTargetInputChange,
  onStartEditSalesTarget,
  onSaveSalesTarget,
  isSavingSalesTarget,
}) {
  const salesRemaining = Math.max((salesTargetAmount || 0) - (totalSales || 0), 0);
  const purchaseRemaining = Math.max((purchaseTargetAmount || 0) - (totalPurchases || 0), 0);
  const targetPurchaseRatio = salesTargetAmount > 0 && purchaseTargetAmount > 0
    ? (purchaseTargetAmount / salesTargetAmount) * 100
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4 border-green-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100"><TrendingUp className="w-6 h-6 text-green-700" /></div>
              <div>
                <p className="text-xs text-gray-500">المبيعات خلال الفترة</p>
                <h3 className="font-bold text-gray-800">تارجت المبيعات</h3>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-green-700">{fmt(totalSales, 2)} ج</p>
          </div>

          <ProgressBar value={totalSales} target={salesTargetAmount} className="bg-green-500" />

          <div className="flex items-end justify-between gap-3 border-t pt-3">
            <div className="text-sm text-gray-600">
              {salesTargetAmount > 0 ? <span>المتبقي للتارجت: <b>{fmt(salesRemaining)} ج</b></span> : <span>لم يحدد تارجت مبيعات لهذه الدورة</span>}
            </div>
            {editingSalesTarget ? (
              <div className="flex items-center gap-1">
                <Input type="number" value={salesTargetInput} onChange={(e) => onSalesTargetInputChange(e.target.value)} className="h-8 w-32 text-sm" placeholder="تارجت المبيعات" />
                <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={onSaveSalesTarget} disabled={isSavingSalesTarget}>
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            ) : canEditSalesTarget ? (
              <button onClick={onStartEditSalesTarget} className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                <Pencil className="w-3 h-3" /> تعديل تارجت المبيعات
              </button>
            ) : null}
          </div>
        </Card>

        <Card className="p-5 space-y-4 border-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100"><ShoppingCart className="w-6 h-6 text-blue-700" /></div>
              <div>
                <p className="text-xs text-gray-500">صافي المشتريات خلال الفترة</p>
                <h3 className="font-bold text-gray-800">سقف المشتريات</h3>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-blue-700">{fmt(totalPurchases, 2)} ج</p>
          </div>

          <ProgressBar value={totalPurchases} target={purchaseTargetAmount} className="bg-blue-500" />

          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">المتبقي من سقف الشراء</p>
              <p className="font-bold text-gray-800">{purchaseTargetAmount > 0 ? `${fmt(purchaseRemaining)} ج` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">نسبة شراء / بيع</p>
              <p className={`font-bold ${targetPurchaseRatio !== null && purchaseRatio > targetPurchaseRatio ? "text-red-600" : "text-teal-700"}`}>
                {Number.isFinite(purchaseRatio) ? `${purchaseRatio.toFixed(1)}%` : "—"}
                {targetPurchaseRatio !== null && <span className="text-[11px] font-normal text-gray-400"> / مستهدف {targetPurchaseRatio.toFixed(1)}%</span>}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SmallCard label="مشتريات الكاش" value={totalCashPurchases} icon={Banknote} iconClass="bg-purple-100 text-purple-600" />
        <SmallCard label="المصروفات" value={totalExpenses} icon={Receipt} iconClass="bg-orange-100 text-orange-600" />
        <SmallCard label="إجمالي الفواتير" value={invoiceCount} icon={FileText} iconClass="bg-teal-100 text-teal-600" isCurrency={false} />
        <SmallCard label="نسبة تحقيق المبيعات" value={pct(totalSales, salesTargetAmount)} icon={TrendingUp} iconClass="bg-green-100 text-green-700" isCurrency={false} suffix="%" />
      </div>
    </div>
  );
}

function SmallCard({ label, value, icon: Icon, iconClass, isCurrency = true, suffix = "" }) {
  return (
    <Card className="p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-xl font-bold text-gray-800">
          {isCurrency ? `${fmt(value)} ج` : `${fmt(value, 1)}${suffix}`}
        </p>
      </div>
      <div className={`p-2.5 rounded-full shrink-0 ${iconClass}`}><Icon className="w-5 h-5" /></div>
    </Card>
  );
}
