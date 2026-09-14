export const FINANCIAL_ACCESS = {
  NONE: "none",
  OPERATIONS: "operations",
  BRANCH: "branch_financial",
  FULL: "full",
};

export const FINANCIAL_ACCESS_LABELS = {
  none: "بدون تفاصيل مالية",
  operations: "تشغيل مالي محدود",
  branch_financial: "مالي حسب الفرع",
  full: "مالي كامل",
};

export function getFinancialAccessLevel(user) {
  if (!user) return FINANCIAL_ACCESS.NONE;
  if (user.role === "admin") return FINANCIAL_ACCESS.FULL;
  if (Object.values(FINANCIAL_ACCESS).includes(user.financial_access_level)) return user.financial_access_level;
  // Default آمن للحسابات القديمة: manager لا يحصل تلقائيًا على أرقام مالية حساسة.
  if (user.role === "manager") return FINANCIAL_ACCESS.OPERATIONS;
  return FINANCIAL_ACCESS.NONE;
}

export function buildFinancialPermissions(user) {
  const level = getFinancialAccessLevel(user);
  const full = level === FINANCIAL_ACCESS.FULL;
  const branchFinancial = level === FINANCIAL_ACCESS.BRANCH || full;
  const operations = level === FINANCIAL_ACCESS.OPERATIONS || branchFinancial;

  return {
    financialAccessLevel: level,
    canUseFinancialOperations: operations,
    canViewFinancialDashboard: branchFinancial,
    canViewSalesTotals: branchFinancial,
    canViewPurchaseTotals: branchFinancial,
    canViewExpenseTotals: branchFinancial,
    canViewTargets: branchFinancial,
    canViewSupplierFinancials: branchFinancial,
    canViewFinancialReports: branchFinancial,
    canViewFinancialArchive: full,
    canViewAllBranchesFinancials: full,
    canManageFinancialPermissions: full,
  };
}

export function financialAccessAtLeast(level, minimum) {
  const rank = { none: 0, operations: 1, branch_financial: 2, full: 3 };
  return (rank[level] || 0) >= (rank[minimum] || 0);
}
