// حساب مراجعة تسليمات الشيفت المشترك (د علياء ود أميرة): عرض فقط لصفحة التسليمات.
export const SHIFT_REVIEWER_EMAILS = ["dawaapharmacy73@gmail.com"];

export function isShiftReviewer(user) {
  return SHIFT_REVIEWER_EMAILS.includes(String(user?.email || "").trim().toLowerCase());
}