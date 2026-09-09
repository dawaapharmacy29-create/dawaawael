// حالة فتح قفل صفحة المصروفات الإدارية لفرع دواء الشامي — تبقى مفتوحة فقط خلال جلسة المتصفح الحالية
const KEY = "shami_expenses_unlocked";

export const isShamiUnlocked = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const setShamiUnlocked = () => {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* تجاهل */
  }
};

export const lockShami = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* تجاهل */
  }
};