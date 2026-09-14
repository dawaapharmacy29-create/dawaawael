import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

export default function RoleRouteGuard({ children, adminOnly = false, managerOnly = false }) {
  const location = useLocation();
  const { isAdmin, isManager } = useUserRole();
  const allowed = adminOnly ? isAdmin : managerOnly ? isManager : true;
  if (allowed) return children;
  if (location.pathname === "/") return <Navigate to="/shift-delivery" replace />;
  return (
    <div dir="rtl" className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" />
        <h2 className="text-lg font-black text-gray-900">الصفحة إدارية محمية</h2>
        <p className="text-sm text-gray-600 mt-2">الحساب الحالي لا يملك الدور الإداري المطلوب لهذه الصفحة.</p>
      </div>
    </div>
  );
}
