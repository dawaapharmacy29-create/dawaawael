const pad = (n) => String(n).padStart(2, "0");

// تاريخ ووقت التسجيل التلقائي بصيغة YYYY-MM-DD HH:MM
export const getRecordedAt = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

// ترحيل تاريخ يوم واحد للخلف بصيغة YYYY-MM-DD
export const getPreviousDateStr = (dateStr) => {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return dateStr || "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};