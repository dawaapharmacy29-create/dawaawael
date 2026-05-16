import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Receipt, Menu, X, BarChart2, HandCoins, ClipboardList, ShieldCheck, UserCheck, FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/useUserRole";
import SmartAlerts from "@/components/layout/SmartAlerts";

const navItems = [
  { path: "/", label: "الرئيسية", icon: LayoutDashboard },
  { path: "/invoices", label: "فواتير الشراء", icon: FileText },
  { path: "/pending-invoices", label: "انتظار المراجعة", icon: ClipboardList, badge: true },
  { path: "/medicine-list", label: "أدوية اللسته", icon: FlaskConical, gold: true },
  { path: "/suppliers", label: "الموردين", icon: Users },
  { path: "/expenses", label: "المصروفات", icon: Receipt },
  { path: "/returns", label: "المرتجعات", icon: RotateCcw, pink: true },
  { path: "/reports", label: "التقارير", icon: BarChart2 },
  { path: "/supplier-balances", label: "أرصدة الموردين", icon: HandCoins },
  { path: "/activity-log", label: "سجل العمليات", icon: ClipboardList },
  { path: "/user-management", label: "المستخدمين والصلاحيات", icon: ShieldCheck },
  { path: "/team-members", label: "فريق العمل", icon: UserCheck },
];

export default function AppLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isAdmin } = useUserRole();
  const visibleNavItems = navItems.filter(item => item.path !== "/user-management" || isAdmin);

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["pending-invoices-count"],
    queryFn: () => base44.entities.PurchaseInvoice.filter({ status: "انتظار المراجعة" }),
    staleTime: 30000,
  });
  const pendingCount = pendingInvoices.length;

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-l shadow-sm">
        <div className="p-4 border-b bg-teal-600">
          <h1 className="text-white font-bold text-lg">صيدليات دواء</h1>
          <p className="text-teal-100 text-xs mt-0.5">مشتريات</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                item.gold
                  ? "bg-yellow-50 text-yellow-700 border border-yellow-300"
                  : item.pink
                  ? "bg-pink-50 text-pink-700 border border-pink-200"
                  : location.pathname === item.path
                  ? "bg-teal-50 text-teal-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className={cn("w-4 h-4", item.gold && "text-yellow-500", item.pink && "text-pink-500")} />
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 right-0 left-0 z-50 bg-teal-600 flex items-center justify-between px-4 py-3">
        <p className="text-teal-100 text-sm">مشتريات</p>
        <h1 className="text-white font-bold">صيدليات دواء</h1>
        <button onClick={() => setOpen(!open)} className="text-white">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)}>
          <div className="absolute top-12 right-0 w-56 bg-white h-full shadow-xl p-3" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1 mt-2">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    item.gold
                      ? "bg-yellow-50 text-yellow-700 border border-yellow-300"
                      : item.pink
                      ? "bg-pink-50 text-pink-700 border border-pink-200"
                      : location.pathname === item.path
                      ? "bg-teal-50 text-teal-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", item.gold && "text-yellow-500", item.pink && "text-pink-500")} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:overflow-auto pt-14 md:pt-0 flex flex-col">
        {/* Alerts bar */}
        <div className="px-4 pt-3 pb-0 flex justify-end">
          <SmartAlerts />
        </div>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}