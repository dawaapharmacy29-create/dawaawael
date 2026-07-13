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
    <div className="space-y-2">
      {/* Tube container */}
      <div className={`relative w-full ${height} bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner`}>
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-500 relative"
          style={{
            width: `${actualPercent}%`,
            background: `linear-gradient(180deg, ${tubeColors.top} 0%, ${tubeColors.bottom} 100%)`,
          }}
        >
          {/* Shine */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-full" />
        </div>

        {/* Percentage centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-800 drop-shadow-sm">{actualPercent.toFixed(0)}% من الهدف</span>
        </div>

        {/* Daily progress marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-gray-900 shadow-md flex items-start justify-center"
          style={{ right: `calc(${timePercent}% - 2px)` }}
        >
          <div className="absolute -top-1.5 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>المعدل اليومي: {Math.round(dailyAverage).toLocaleString("ar-EG")} ج</span>
        <span>المتوقع: {Math.round(expectedAmount).toLocaleString("ar-EG")} ج ({timePercent.toFixed(0)}%)</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className={isBehind ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
          {isBehind ? "الإنفاق أقل من المعدل المتوقع" : "الإنفاق أعلى من المعدل المتوقع"}
        </span>
        {remaining > 0 && <span className="text-gray-400">المتبقي: {remaining.toLocaleString("ar-EG")} ج</span>}
      </div>
    </div>
  );
}