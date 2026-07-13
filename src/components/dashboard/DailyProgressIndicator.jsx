export default function DailyProgressIndicator({ startDate, endDate, currentAmount, targetAmount, height = "h-7", color = "bg-green-500" }) {
  if (!targetAmount || targetAmount <= 0) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  const totalDays = Math.max(Math.ceil((end - start) / 86400000) + 1, 1);
  const elapsedDays = Math.min(Math.max(Math.ceil((now - start) / 86400000) + 1, 1), totalDays);

  const timePercent = Math.min((elapsedDays / totalDays) * 100, 100);
  const actualPercent = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

  const expectedAmount = targetAmount * (timePercent / 100);
  const dailyAverage = elapsedDays > 0 ? currentAmount / elapsedDays : 0;
  const isBehind = currentAmount < expectedAmount;
  const remaining = Math.max(targetAmount - currentAmount, 0);

  const tubeColors = actualPercent >= 100
    ? { top: "#ef4444", bottom: "#b91c1c" }
    : actualPercent >= 80
    ? { top: "#fb923c", bottom: "#ea580c" }
    : { top: "#22c55e", bottom: "#15803d" };

  return (
    <div className="space-y-1">
      {/* Percentage + tube */}
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${actualPercent >= 100 ? "text-red-600" : actualPercent >= 80 ? "text-orange-500" : "text-green-600"}`}>
          {actualPercent.toFixed(1)}%
        </span>
        <div className={`relative flex-1 ${height} bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner`}>
          {/* Fill */}
          <div
            className="h-full rounded-full transition-all duration-500 relative"
            style={{
              width: `${actualPercent}%`,
              background: `linear-gradient(180deg, ${tubeColors.top} 0%, ${tubeColors.bottom} 100%)`,
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-full" />
          </div>

          {/* Daily progress marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-900"
            style={{ right: `calc(${timePercent}% - 1px)` }}
          />
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500">
        الخط الأسود = المعدل المتوقع ({timePercent.toFixed(0)}%)
      </p>
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">المتبقي للوصول للهدف {remaining.toLocaleString("ar-EG")} ج</span>
        <span className={isBehind ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
          {isBehind
            ? `الإنفاق أقل من المعدل بـ ${Math.round(expectedAmount - currentAmount).toLocaleString("ar-EG")} ج`
            : `الإنفاق أعلى من المعدل بـ ${Math.round(currentAmount - expectedAmount).toLocaleString("ar-EG")} ج`}
        </span>
      </div>
    </div>
  );
}