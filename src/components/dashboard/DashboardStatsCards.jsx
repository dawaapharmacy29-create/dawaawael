import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Users, Receipt, FileText, Pencil, Check } from "lucide-react";

const fmt = (n, digits = 0) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: digits });

const fmtLabel = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export default function DashboardStatsCards({
  totalPayments,
  totalCashPurchases,
  totalExpenses,
  invoiceCount,
  targetAmount,
  startDate,
  endDate,
  canEditTarget,
  editingTarget,
  targetInput,
  onTargetInputChange,
  onStartEditTarget,
  onSaveTarget,
  isSavingTarget,
}) {
  // حساب المعدل المتوقع حسب الوقت المنقضي من الفترة
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const totalDays = Math.max(Math.ceil((end - start) / 86400000) + 1, 1);
  const elapsedDays = Math.min(Math.max(Math.ceil((now - start) / 86400000) + 1, 1), totalDays);
  const timePercent = Math.min((elapsedDays / totalDays) * 100, 100);
  const actualPercent = targetAmount > 0 ? (totalPayments / targetAmount) * 100 : 0;
  const expectedAmount = targetAmount * (timePercent / 100);
  const remaining = Math.max(targetAmount - totalPayments, 0);

  let statusLine = null;
  if (targetAmount > 0) {
    if (actualPercent >= 100) {
      statusLine = <p className="text-sm font-medium text-red-600">تجاوز الهدف الشهري</p>;
    } else if (totalPayments < expectedAmount) {
      statusLine = (
        <p className="text-sm font-medium text-blue-600">
          أقل من المعدل المتوقع بـ {fmt(expectedAmount - totalPayments)} ج
        </p>
      );
    } else {
      statusLine = <p className="text-sm font-medium text-green-600">✓ معدل الإنفاق ماشي بالمعدل المطلوب</p>;
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* الكارت الكبير: إجمالي قيمة المدفوعات */}
      <Card className="md:col-span-2 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-700">إجمالي قيمة المدفوعات</h3>
        </div>

        <p className="text-3xl md:text-4xl font-extrabold text-gray-800">
          {fmt(totalPayments, 2)} <span className="text-xl font-bold">ج</span>
        </p>

        {targetAmount > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-green-700">{Math.round(actualPercent)}%</span>
              <span className="text-gray-500">المستهدف: {fmt(targetAmount)} ج</span>
            </div>
            <div className="relative">
              <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-700"
                  style={{ width: `${Math.min(actualPercent, 100)}%` }}
                />
              </div>
              {/* الخط الأسود = المعدل المتوقع */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-gray-900"
                style={{ right: `calc(${Math.min(timePercent, 100)}% - 1px)` }}
              >
                <div className="absolute -top-0.5 right-1/2 translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-gray-900" />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              الخط الأسود = المعدل المتوقع حتى {fmtLabel(endDate)} ({Math.round(timePercent)}%)
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">لم يحدد هدف شهري</p>
        )}

        <div className="flex items-end justify-between flex-wrap gap-3 border-t pt-3">
          <div className="space-y-1">
            {targetAmount > 0 && (
              <p className="text-sm text-gray-600">
                المتبقي للوصول للهدف: <span className="font-bold text-gray-800">{fmt(remaining)} ج</span>
              </p>
            )}
            {statusLine}
          </div>

          {editingTarget ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={targetInput}
                onChange={(e) => onTargetInputChange(e.target.value)}
                className="h-8 w-32 text-sm"
                placeholder="قيمة الهدف"
              />
              <Button
                size="icon"
                className="h-8 w-8 bg-teal-600 hover:bg-teal-700 shrink-0"
                onClick={onSaveTarget}
                disabled={isSavingTarget}
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          ) : canEditTarget ? (
            <button
              onClick={onStartEditTarget}
              className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
            >
              <Pencil className="w-3 h-3" /> تعديل الهدف
            </button>
          ) : targetAmount > 0 ? (
            <p className="text-xs text-gray-400">مجموع أهداف الفروع</p>
          ) : null}
        </div>
      </Card>

      {/* الكروت الصغيرة */}
      <div className="flex flex-col gap-4">
        <SmallCard
          label="مشتريات الكاش"
          value={totalCashPurchases}
          icon={Users}
          iconClass="bg-purple-100 text-purple-600"
        />
        <div className="grid grid-cols-2 gap-4 flex-1">
          <SmallCard
            label="المصروفات"
            value={totalExpenses}
            icon={Receipt}
            iconClass="bg-orange-100 text-orange-600"
          />
          <SmallCard
            label="إجمالي الفواتير"
            value={invoiceCount}
            icon={FileText}
            iconClass="bg-teal-100 text-teal-600"
            isCurrency={false}
          />
        </div>
      </div>
    </div>
  );
}

function SmallCard({ label, value, icon: Icon, iconClass, isCurrency = true }) {
  return (
    <Card className="p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-xl font-bold text-gray-800">
          {isCurrency ? `${fmt(value)} ج` : fmt(value)}
        </p>
      </div>
      <div className={`p-2.5 rounded-full shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </Card>
  );
}