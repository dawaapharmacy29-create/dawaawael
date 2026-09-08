// فرض الأرقام الإنجليزية (0-9) في كل أنحاء التطبيق مع الإبقاء على النصوص العربية كما هي
// أي استدعاء لتنسيق أرقام بlocale عربي (ar-EG) يتحول تلقائيًا لتنسيق إنجليزي: 1,250,000.00

const isArabicLocale = (locale) =>
  typeof locale === "string" && locale.toLowerCase().startsWith("ar");

const NUMBER_LOCALE = "en-US"; // فواصل إنجليزية (1,250,000.00)
const DATE_LOCALE = "ar-EG-u-nu-latn"; // أسماء عربية (شهور/أيام) بأرقام إنجليزية

// إخفاء كل القيم الرقمية المنسقة عن دور "مشاهد" (viewer) — تظهر كنقاط
let numbersHidden = false;
export const setNumbersHidden = (value) => { numbersHidden = !!value; };

const origNumber = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function (locale, options) {
  if (numbersHidden) return "•••";
  return origNumber.call(this, isArabicLocale(locale) ? NUMBER_LOCALE : locale, options);
};

const origDateToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function (locale, options) {
  return origDateToLocaleString.call(this, isArabicLocale(locale) ? DATE_LOCALE : locale, options);
};

const origToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function (locale, options) {
  return origToLocaleDateString.call(this, isArabicLocale(locale) ? DATE_LOCALE : locale, options);
};

const origToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function (locale, options) {
  return origToLocaleTimeString.call(this, isArabicLocale(locale) ? DATE_LOCALE : locale, options);
};

export {};