import { useAuth } from "@/lib/AuthContext";
import { buildFinancialPermissions } from "@/lib/financialAccess";
import { canUseCoreOperationalEntry, isDeliveryStaffUser, operationalBranchesForUser } from "@/lib/operationalAccess";

export function useUserRole() {
  // المستخدم تم تحميله بالفعل مرة واحدة داخل AuthContext عند بدء التطبيق.
  // إعادة استخدامه هنا تمنع طلب auth.me إضافي في كل الصفحات والمكونات التي تستعمل الصلاحيات.
  const { user } = useAuth();

  const role = user?.role || "viewer";
  const isAdmin = role === "admin";
  const isManager = role === "admin" || role === "manager";
  const isViewer = role === "viewer";

  const isDeliveryStaff = isDeliveryStaffUser(user);
  const canUseCoreOperationalEntry = canUseCoreOperationalEntry(user);
  const canDeleteInvoice = isAdmin || !!user?.can_delete_invoice;
  // تسجيل الفواتير تشغيل يومي للعاملين بالصيدلية فقط؛ فريق الدليفري مستبعد من المسار التشغيلي الأساسي.
  const canSaveInvoice = canUseCoreOperationalEntry;
  const canManageTeam = isAdmin || !!user?.can_manage_team;
  const canSetBudget = isAdmin || !!user?.can_set_budget;

  // Branch access is opt-in for backward compatibility. Existing users without
  // branch_access keep their current visibility until an admin explicitly sets it.
  const explicitBranchAccess = Array.isArray(user?.branch_access)
    ? user.branch_access.filter(Boolean)
    : [];
  const legacyBranch = typeof user?.branch === "string" && user.branch.trim()
    ? user.branch.trim()
    : "";
  const derivedOperationalBranches = operationalBranchesForUser(user, { allowAdminAll: true });
  const branchAccess = explicitBranchAccess.length > 0
    ? explicitBranchAccess
    : derivedOperationalBranches.length > 0
      ? derivedOperationalBranches
      : legacyBranch
        ? [legacyBranch]
        : [];
  const hasExplicitBranchAccess = branchAccess.length > 0;
  const canAccessBranch = (branch) => {
    if (isAdmin) return true;
    if (!branch) return true;
    if (!hasExplicitBranchAccess) return true;
    return branchAccess.includes(branch);
  };

  const financial = buildFinancialPermissions(user);
  // البيانات المالية أكثر حساسية من التشغيل: الوصول المالي حسب الفرع يحتاج نطاق فرع صريح.
  // الإدارة الكاملة فقط ترى كل الفروع تلقائيًا.
  const canAccessFinancialBranch = (branch) => {
    if (financial.canViewAllBranchesFinancials) return true;
    if (!financial.canViewLimitedFinancialSummary) return false;
    if (!branch) return false;
    if (!hasExplicitBranchAccess) return false;
    return branchAccess.includes(branch);
  };

  return {
    role,
    isAdmin,
    isManager,
    isViewer,
    user,
    isDeliveryStaff,
    canUseCoreOperationalEntry,
    canDeleteInvoice,
    canSaveInvoice,
    canManageTeam,
    canSetBudget,
    branchAccess,
    hasExplicitBranchAccess,
    canAccessBranch,
    canAccessFinancialBranch,
    ...financial,
  };
}