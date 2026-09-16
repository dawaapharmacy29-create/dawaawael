const DELIVERY_KEYWORDS = [
  "delivery",
  "driver",
  "courier",
  "مندوب",
  "دليفري",
  "توصيل",
];

const DELIVERY_EMPLOYEE_NAMES = new Set([
  "احمد وجيه",
  "محمود الغباري",
  "محمود", // الاسم الحالي في سجل الربط لمحمود الغباري
  "يوسف ماهر",
  "احمد السيد",
  "محمد الالفي",
  "محمد الديب",
  "محمد حافظ",
  "عبد الرحمن",
  "حسين",
  "مصطفي",
  "عم محمد سالم",
  "يوسف عيد",
  "اسلام السبع",
].map((name) => String(name).trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ")));

const normalize = (value = "") => String(value)
  .trim()
  .toLowerCase()
  .replace(/[أإآ]/g, "ا")
  .replace(/ة/g, "ه")
  .replace(/ى/g, "ي")
  .replace(/\s+/g, " ");

export function isDeliveryStaffName(name) {
  return DELIVERY_EMPLOYEE_NAMES.has(normalize(name));
}

export function isDeliveryStaffUser(user) {
  if (!user) return false;
  const haystack = [
    user.management_job_title,
    user.management_role,
    user.job_title,
    user.position,
    user.department,
    user.full_name,
    user.management_display_name,
  ].map(normalize).filter(Boolean).join(" | ");

  const namedAsDelivery = [user.full_name, user.management_display_name, user.name].some((name) => isDeliveryStaffName(name));
  return namedAsDelivery || DELIVERY_KEYWORDS.some((keyword) => haystack.includes(normalize(keyword)));
}

export function canUseCoreOperationalEntry(user) {
  return Boolean(user) && !isDeliveryStaffUser(user);
}

export function operationalBranchesForUser(user, { allowAdminAll = true } = {}) {
  if (!user) return [];
  if (allowAdminAll && user.role === "admin") return ["دواء شكري", "دواء الشامي"];

  const explicit = Array.isArray(user.branch_access)
    ? user.branch_access.filter((b) => ["دواء شكري", "دواء الشامي"].includes(b))
    : [];
  if (explicit.length) return explicit;

  const managementBranch = String(user.management_branch || "").trim();
  if (["دواء شكري", "دواء الشامي"].includes(managementBranch)) return [managementBranch];
  if (managementBranch === "كل الفروع") return ["دواء شكري", "دواء الشامي"];

  const legacyBranch = String(user.branch || "").trim();
  if (["دواء شكري", "دواء الشامي"].includes(legacyBranch)) return [legacyBranch];

  return [];
}
