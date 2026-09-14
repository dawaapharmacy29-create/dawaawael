import { base44 } from "@/api/base44Client";
import { cairoTodayKey } from "@/lib/smart-commerce-analytics";

const CAIRO_TZ = "Africa/Cairo";

function cairoClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { hour: get("hour"), minute: get("minute") };
}

function previousDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function getTimeBasedShiftSuggestion(date = new Date()) {
  const { hour, minute } = cairoClock(date);
  const mins = hour * 60 + minute;

  if (mins >= 9 * 60 && mins < 18 * 60) {
    return { shiftType: "صباحي", confidence: "high", reason: "الوقت الحالي ضمن الوقت المعتاد للشيفت الصباحي" };
  }
  if (mins >= 18 * 60 && mins < 19 * 60 + 30) {
    return { shiftType: "صباحي", confidence: "transition-evening", reason: "الوقت بين نهاية الصباحي وبداية المسائي" };
  }
  if (mins >= 19 * 60 + 30 || mins < 2 * 60) {
    return { shiftType: "مسائي", confidence: "high", reason: "الوقت الحالي ضمن الوقت المعتاد للشيفت المسائي" };
  }
  if (mins >= 2 * 60 && mins < 4 * 60) {
    return { shiftType: "مسائي", confidence: "transition-night", reason: "الوقت بين نهاية المسائي وبداية الليلي" };
  }
  return { shiftType: "ليلي", confidence: "high", reason: "الوقت الحالي ضمن الوقت المعتاد للشيفت الليلي" };
}

export async function getSmartShiftSuggestion(branch, date = new Date()) {
  const base = getTimeBasedShiftSuggestion(date);
  if (!branch || base.confidence === "high") return base;

  const today = cairoTodayKey();
  if (base.confidence === "transition-evening") {
    const morningRows = await base44.entities.ShiftDelivery.filter({
      branch,
      shift_date: today,
      shift_type: "صباحي",
    }, "-created_date", 10);
    const activeMorning = morningRows.some((r) => r.is_archived !== true);
    return activeMorning
      ? { shiftType: "مسائي", confidence: "smart", reason: "الصباحي لهذا الفرع مسجل بالفعل، فتم ترشيح المسائي تلقائيًا" }
      : { shiftType: "صباحي", confidence: "smart", reason: "الصباحي لهذا الفرع لم يُسجل بعد، فتم ترشيحه تلقائيًا" };
  }

  if (base.confidence === "transition-night") {
    const previousDay = previousDateKey(today);
    const eveningRows = await base44.entities.ShiftDelivery.filter({
      branch,
      shift_date: previousDay,
      shift_type: "مسائي",
    }, "-created_date", 10);
    const activeEvening = eveningRows.some((r) => r.is_archived !== true);
    return activeEvening
      ? { shiftType: "ليلي", confidence: "smart", reason: "المسائي السابق مسجل بالفعل، فتم ترشيح الليلي تلقائيًا" }
      : { shiftType: "مسائي", confidence: "smart", reason: "المسائي السابق لم يُسجل بعد، فتم ترشيحه تلقائيًا" };
  }

  return base;
}

export function isShiftOverride(selectedShift, suggestedShift) {
  return Boolean(selectedShift && suggestedShift && selectedShift !== suggestedShift);
}
