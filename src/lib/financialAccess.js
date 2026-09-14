export const FINANCIAL_ACCESS = {
  NONE: "none",
  LIMITED: "limited",
  FULL: "full",
};

export const FINANCIAL_ACCESS_LABELS = {
  none: "تشغيلي فقط — بدون تفاصيل مالية",
  limited: "مالي محدود",
  full: "مالي كامل",
};

export function getFinancialAccessLevel(user) {
  if (!user) return FINANCIAL_ACCESS.NONE;
  const explicit = user.financial_access_level ?? user?.data?.financial_access_level;
  if (Object.values(FINANCIAL_ACCESS).includes(explicit)) return explicit;
  // Default آمن لكل الحسابات القديمة، بما فيها admin/manager:
  // الدور التقني لا يمنح رؤية مالية تلقائيًا.
  return FINANCIAL_ACCESS.NONE;
}

export function buildFinancialPermissions(user) {
  const level = getFinancialAccessLevel(user);
  const limited = level === FINANCIAL_ACCESS.LIMITED;
  const full = level === FINANCIAL_ACCESS.FULL;

  return {
    financialAccessLevel: level,
    // التشغيل اليومي حق مستقل عن الرؤية المالية.
    canUseFinancialOperations: !!user,
    canViewLimitedFinancialSummary: limited || full,
    canViewFinancialDashboard: full,
    canViewSalesTotals: limited || full,
    canViewPurchaseTotals: limited || full,
    canViewExpenseTotals: full,
    canViewTargets: full,
    canViewSupplierFinancials: full,
    canViewFinancialReports: full,
    canViewFinancialArchive: full,
    canViewAllBranchesFinancials: full,
    canManageFinancialPermissions: full,
  };
}

export function financialAccessAtLeast(level, minimum) {
  const rank = { none: 0, limited: 1, full: 2 };
  return (rank[level] || 0) >= (rank[minimum] || 0);
}
