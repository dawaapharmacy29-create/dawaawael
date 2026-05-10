import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Receipt, Menu, X, BarChart2, HandCoins } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "الرئيسية", icon: LayoutDashboard },
  { path: "/invoices", label: "فواتير الشراء", icon: FileText },
  { path: "/suppliers", label: "الموردين", icon: Users },
  { path: "/expenses", label: "المصروفات", icon: Receipt },
  { path: "/reports", label: "التقارير", icon: BarChart2 },
  { path: "/supplier-balances", label: "أرصدة الموردين", icon: HandCoins },
];

export default function AppLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-l shadow-sm">
        <div className="p-4 border-b bg-teal-600">
          <h1 className="text-white font-bold text-lg">صيدليات دواء</h1>
          <p className="text-teal-100 text-xs mt-0.5">مشتريات</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.path
                  ? "bg-teal-50 text-teal-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
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
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === item.path
                      ? "bg-teal-50 text-teal-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}