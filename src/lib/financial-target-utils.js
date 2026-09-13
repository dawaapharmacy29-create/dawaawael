import { BRANCHES } from "./financial-report-utils";
import { cycleRangeFor, daysInclusive } from "@/lib/smart-commerce-analytics";

export function monthLabel(monthStr) {
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-").map(Number);
  return `${MONTHS_AR[m - 1]} ${y}`;
}

export function isManagementCycleRange(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return false;
  const expected = cycleRangeFor(dateTo);
  return expected.from === dateFrom && expected.to === dateTo;
}

export function managementMonthForRange(dateFrom, dateTo) {
  return isManagementCycleRange(dateFrom, dateTo) ? dateTo.slice(0, 7) : null;
}

export function computeTargetSummary(targetAmount, achieved, dateFrom, dateTo, recordedDays) {
  const validCycle = isManagementCycleRange(dateFrom, dateTo);
  const totalDays = validCycle ? daysInclusive(dateFrom, dateTo) : 0;
  const percentOfTarget = validCycle && targetAmount > 0 ? (achieved / targetAmount) * 100 : 0;
  const dailyAvg = recordedDays > 0 ? achieved / recordedDays : 0;
  const projectedTotal = validCycle && recordedDays > 0 ? dailyAvg * totalDays : 0;
  const projectedPercent = validCycle && targetAmount > 0 ? (projectedTotal / targetAmount) * 100 : 0;

  let status = validCycle ? "لم يتم تحديد تارجت" : "اختر دورة 26→25";
  let statusColor = "gray";

  if (validCycle && targetAmount > 0) {
    if (recordedDays === 0) {
      status = "لا توجد مبيعات مسجلة بعد";
    } else if (projectedPercent >= 105) {
      status = "متقدم عن التارجت";
      statusColor = "emerald";
    } else if (projectedPercent >= 95) {
      status = "ضمن التارجت";
      statusColor = "blue";
    } else {
      status = "متأخر عن التارجت";
      statusColor = "red";
    }
  }

  return { validCycle, totalDays, percentOfTarget, dailyAvg, projectedTotal, projectedPercent, recordedDays, status, statusColor };
}

export function buildBranchTargetsSummary(handovers, targets, dateFrom, dateTo) {
  const monthStr = managementMonthForRange(dateFrom, dateTo);
  return BRANCHES.map((branch) => {
    const branchRecords = (handovers || []).filter((h) => {
      const d = (h.shift_date || "").slice(0, 10);
      return h.branch === branch && d && d >= dateFrom && d <= dateTo;
    });
    const achieved = branchRecords.reduce((s, h) => s + (Number(h.total_sales) || 0), 0);
    const recordedDays = new Set(branchRecords.map((h) => (h.shift_date || "").slice(0, 10)).filter(Boolean)).size;
    const targetRecord = monthStr ? targets.find((t) => t.branch === branch && t.month === monthStr) : null;
    const targetAmount = Number(targetRecord?.target_amount || 0);
    const summary = computeTargetSummary(targetAmount, achieved, dateFrom, dateTo, recordedDays);
    return { branch, achieved, targetAmount, targetId: targetRecord?.id || null, monthStr, ...summary };
  });
}
