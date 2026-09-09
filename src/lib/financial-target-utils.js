import { BRANCHES } from "./financial-report-utils";

export function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthStr) {
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-").map(Number);
  return `${MONTHS_AR[m - 1]} ${y}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// هل الشهر المحدد ماجاش لسه (مستقبلي بالكامل)؟
export function monthProgress(monthStr) {
  const now = new Date();
  const [y, m] = monthStr.split("-").map(Number);
  const totalDays = daysInMonth(y, m);
  const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1);
  return { totalDays, isFuture };
}

// يحسب حالة التارجيت اعتمادًا على المعدل اليومي الفعلي (للأيام المسجلة فقط) ولو استمرينا بنفس المعدل هل هنوصل للتارجيت
export function computeTargetSummary(targetAmount, achieved, monthStr, recordedDays) {
  const { totalDays, isFuture } = monthProgress(monthStr);
  const percentOfTarget = targetAmount > 0 ? (achieved / targetAmount) * 100 : 0;
  const dailyAvg = recordedDays > 0 ? achieved / recordedDays : 0;
  const projectedTotal = dailyAvg * totalDays;
  const projectedPercent = targetAmount > 0 ? (projectedTotal / targetAmount) * 100 : 0;

  let status = "لم يتم تحديد تارجيت";
  let statusColor = "gray";

  if (targetAmount > 0) {
    if (recordedDays === 0) {
      status = isFuture ? "لم يبدأ الشهر بعد" : "لا توجد مبيعات مسجلة بعد";
      statusColor = "gray";
    } else {
      const ratio = targetAmount > 0 ? projectedTotal / targetAmount : 0;
      if (ratio >= 1.05) {
        status = "متقدم عن التارجيت";
        statusColor = "emerald";
      } else if (ratio >= 0.95) {
        status = "ضمن التارجيت";
        statusColor = "blue";
      } else {
        status = "متأخر عن التارجيت";
        statusColor = "red";
      }
    }
  }

  return { percentOfTarget, dailyAvg, projectedTotal, projectedPercent, recordedDays, status, statusColor };
}

// يبني ملخص كل الفروع لشهر معين اعتمادًا على تسليمات الشيفت (ShiftDelivery) وأهداف الفروع (TargetGoal)
export function buildBranchTargetsSummary(handovers, targets, monthStr) {
  return BRANCHES.map((branch) => {
    const branchRecords = handovers.filter((h) => h.branch === branch && (h.shift_date || "").slice(0, 7) === monthStr);
    const achieved = branchRecords.reduce((s, h) => s + (h.total_sales || 0), 0);
    const recordedDays = new Set(branchRecords.map((h) => (h.shift_date || "").slice(0, 10)).filter(Boolean)).size;
    const targetRecord = targets.find((t) => t.branch === branch && t.month === monthStr);
    const targetAmount = targetRecord?.target_amount || 0;
    const summary = computeTargetSummary(targetAmount, achieved, monthStr, recordedDays);
    return { branch, achieved, targetAmount, targetId: targetRecord?.id || null, ...summary };
  });
}
