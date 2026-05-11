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

  return { role, isAdmin, isManager, isViewer, user };
}