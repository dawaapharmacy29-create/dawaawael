import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { FINANCIAL_ACCESS } from "@/lib/financialAccess";

export default function FinancialRouteGuard({ children, minimum = FINANCIAL_ACCESS.BRANCH, adminOnly = false }) {
  const location = useLocation();
  const role = useUserRole();
  const rank = { none: 0, operations: 1, branch_financial: 2, full: 3 };
  const allowed = adminOnly
    ? role.isAdmin
    : (rank[role.financialAccessLevel] || 0) >= (rank[minimum] || 0);

  if (allowed) return children;

  if (location.pathname === "/") return <Navigate to="/shift-delivery" replace />;

  return (
    <div dir="rtl" className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" />
        <h2 className="text-lg font-black text-gray-900">الصفحة تحتوي على بيانات مالية محمية</h2>
        <p className="text-sm text-gray-600 mt-2">الحساب الحالي لا يملك مستوى الصلاحية المالية المطلوب لهذه الصفحة. يمكن للمدير العام تعديل مستوى الوصول من صفحة المستخدمين والصلاحيات.</p>
      </div>
    </div>
  );
}
