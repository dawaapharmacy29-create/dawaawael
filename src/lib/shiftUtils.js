const pad = (n) => String(n).padStart(2, "0");

// تاريخ ووقت التسجيل التلقائي بصيغة YYYY-MM-DD HH:MM
export const getRecordedAt = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

// تحويل وقت التسجيل المخزن (UTC) إلى توقيت القاهرة
const cairoParts = (isoString) => {
  const d = new Date(isoString);
  if (!isoString || Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { date, time };
};

// وقت التسليم المخزن بصيغة HH:MM بتوقيت القاهرة
export const getCairoRecordedTime = (isoString) => cairoParts(isoString)?.time || "";

// تاريخ ووقت التسليم المخزن بصيغة YYYY-MM-DD HH:MM بتوقيت القاهرة
export const getCairoRecordedAt = (isoString) => {
  const p = cairoParts(isoString);
  return p ? `${p.date} ${p.time}` : "";
};

// ترحيل تاريخ يوم واحد للخلف بصيغة YYYY-MM-DD
export const getPreviousDateStr = (dateStr) => {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return dateStr || "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};