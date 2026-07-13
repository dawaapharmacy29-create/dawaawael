export default function DailyProgressIndicator({ startDate, endDate, currentAmount, targetAmount, height = "h-3", color = "bg-green-500" }) {
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

  const actualColor = actualPercent >= 100 ? "bg-red-500" : actualPercent >= 80 ? "bg-orange-400" : color;

  return (
    <div className="space-y-1.5">
      {/* Progress bar with time marker */}
      <div className={`relative w-full bg-gray-200 rounded-full ${height}`}>
        <div className={`${height} rounded-full transition-all ${actualColor}`} style={{ width: `${actualPercent}%` }} />
        {/* Time-based expected progress marker */}
        <div className={`absolute top-0 ${height} w-0.5 bg-gray-800`} style={{ right: `${timePercent}%` }} />
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