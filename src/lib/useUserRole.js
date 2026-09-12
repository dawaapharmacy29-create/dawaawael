import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useUserRole() {
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.me(),
  });

  const role = user?.role || "viewer";
  const isAdmin = role === "admin";
  const isManager = role === "admin" || role === "manager";
  const isViewer = role === "viewer";

  const canDeleteInvoice = isAdmin || !!user?.can_delete_invoice;
  const canSaveInvoice = isAdmin || role === "manager" || !!user?.can_save_invoice;
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
  const branchAccess = explicitBranchAccess.length > 0
    ? explicitBranchAccess
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

  return {
    role,
    isAdmin,
    isManager,
    isViewer,
    user,
    canDeleteInvoice,
    canSaveInvoice,
    canManageTeam,
    canSetBudget,
    branchAccess,
    hasExplicitBranchAccess,
    canAccessBranch,
  };
}