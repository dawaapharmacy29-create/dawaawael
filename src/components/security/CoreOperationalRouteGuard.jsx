import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/lib/useUserRole";

export default function CoreOperationalRouteGuard({ children }) {
  const { user, canUseCoreOperationalEntry } = useUserRole();
  const location = useLocation();

  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (!canUseCoreOperationalEntry) return <Navigate to="/" replace state={{ denied: "delivery_core_operations" }} />;

  return children;
}
