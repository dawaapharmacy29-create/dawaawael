import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Receipt, Menu, BarChart2, HandCoins, ClipboardList, ShieldCheck, UserCheck, FlaskConical, RotateCcw, PackageX, ShoppingBag, PackageSearch, Clock, FileSearch, AlertTriangle, Database, ChevronDown, Wallet, Landmark, ArchiveRestore, Activity, LockKeyhole, TrendingUp } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/useUserRole";
import { FINANCIAL_ACCESS_LABELS } from "@/lib/financialAccess";
import SmartAlerts from "@/components/layout/SmartAlerts";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const navItems = [
  { path: "/", label: "الرئيسية", icon: LayoutDashboard, section: "main" },
  { path: "/invoices", label: "تسجيل فواتير الشراء", icon: FileText, section: "main", nonDeliveryOnly: true },
  { path: "/pending-invoices", label: "انتظار المراجعة", icon: ClipboardList, badge: true, section: "main", nonDeliveryOnly: true },
  { path: "/medicine-list", label: "أدوية اللسته", icon: FlaskConical, gold: true, section: "main" },
  { path: "/expenses", label: "المصروفات", icon: Receipt, section: "operations", fullFinancialOnly: true },
  { path: "/returns", label: "المرتجعات", icon: RotateCcw, pink: true, section: "operations" },
  { path: "/inventory", label: "الراكد والأكسبير", icon: PackageX, dark: true, hidden: true, section: "operations" },
  { path: "/inventory-count", label: "الجرد الدوري", icon: PackageSearch, cyan: true, hidden: true, section: "operations" },
  { path: "/shift-delivery", label: "تسليم الشيفت", icon: Clock, purple: true, section: "operations", nonDeliveryOnly: true },
  { path: "/customer-orders", label: "تسجيل طلب عميل", icon: ShoppingBag, teal: true, section: "requests", nonDeliveryOnly: true },
  { path: "/pharmacy-orders", label: "طلبات الصيدليات", icon: FlaskConical, violet: true, section: "requests" },
  { path: "/replenishment", label: "قائمة الأصناف المطلوبة", icon: PackageSearch, emerald: true, section: "requests" },
  { path: "/suppliers", label: "الموردين", icon: Users, section: "suppliers", fullFinancialOnly: true },
  { path: "/supplier-balances", label: "أرصدة الموردين (إجمالي)", icon: HandCoins, section: "suppliers", fullFinancialOnly: true },
  { path: "/supplier-balances-branch", label: "أرصدة دواء شكري", icon: HandCoins, indent: true, section: "suppliers", fullFinancialOnly: true },
  { path: "/supplier-balances-branch?branch=دواء الشامي", label: "أرصدة دواء الشامي", icon: HandCoins, indent: true, section: "suppliers", fullFinancialOnly: true },
  { path: "/supplier-intelligence", label: "تحليل الموردين والتفاوض", icon: TrendingUp, section: "suppliers", fullFinancialOnly: true },
  // الواجهة المعتمدة للتقارير: أربع صفحات فقط. الصفحات القديمة تظل موجودة كمسارات احتياطية بدون إظهارها في القائمة.
  { path: "/financial-reports", label: "التقارير المالية", icon: Landmark, section: "reports", fullFinancialOnly: true },
  { path: "/smart-commerce-analytics", label: "تحليلات المبيعات والمشتريات", icon: Activity, section: "reports", fullFinancialOnly: true },
  { path: "/data-reconciliation", label: "مطابقة البيانات اليومية", icon: ShieldCheck, section: "reports", fullFinancialOnly: true },
  { path: "/daily-close", label: "الإقفال اليومي", icon: LockKeyhole, section: "reports", financialOnly: true },
  { path: "/reports", label: "التقارير (إجمالي) — قديم", icon: BarChart2, hidden: true, section: "reports" },
  { path: "/admin-expenses-reports", label: "تقارير المصروفات الإدارية — قديم", icon: Wallet, adminOnly: true, hidden: true, section: "reports" },
  { path: "/purchase-reports", label: "تقارير المشتريات — قديم", icon: FileText, hidden: true, section: "reports" },
  { path: "/reports-branch", label: "تقارير دواء شكري — قديم", icon: BarChart2, indent: true, hidden: true, section: "reports" },
  { path: "/reports-branch?branch=دواء الشامي", label: "تقارير دواء الشامي — قديم", icon: BarChart2, indent: true, hidden: true, section: "reports" },
  { path: "/admin-expenses-shokry", label: "المصروفات الإدارية — دواء شكري", icon: Wallet, fullFinancialOnly: true, section: "operations" },
  { path: "/admin-expenses-shami", label: "المصروفات الإدارية — دواء الشامي", icon: Wallet, fullFinancialOnly: true, section: "operations" },
  { path: "/activity-log", label: "سجل العمليات", icon: ClipboardList, managerOnly: true, section: "management" },
  { path: "/review-needed-invoices", label: "فواتير تحتاج مراجعة", icon: AlertTriangle, amber: true, section: "main", nonDeliveryOnly: true },
  { path: "/security-audit", label: "سجل الأمان", icon: ShieldCheck, adminOnly: true, section: "management" },
  { path: "/financial-archive", label: "الأرشيف المالي الآمن", icon: ArchiveRestore, fullFinancialOnly: true, section: "reports" },
  { path: "/supplier-rules-backfill", label: "تطبيق قواعد الموردين", icon: FileSearch, adminOnly: true, section: "management" },
  { path: "/user-management", label: "المستخدمين والصلاحيات", icon: UserCheck, adminOnly: true, section: "management" },
  { path: "/team-members", label: "فريق العمل", icon: UserCheck, managerOnly: true, section: "management" },
  { path: "/employee-hr", label: "شؤون الموظفين", icon: Users, teal: true, managerOnly: true, section: "management" },
  { path: "/supabase-sync", label: "مركز مزامنة Supabase", icon: Database, adminOnly: true, section: "management" },
  { path: "/system-health", label: "صحة النظام والبيانات", icon: ShieldCheck, adminOnly: true, section: "management" },
];

const NAV_SECTIONS = [
  { key: "main", label: "الأساسيات", defaultOpen: true },
  { key: "operations", label: "الحركة اليومية", defaultOpen: true },
  { key: "requests", label: "الطلبات", defaultOpen: true },
  { key: "suppliers", label: "الموردون والحسابات", defaultOpen: true, financialSection: true },
  { key: "reports", label: "التقارير", defaultOpen: false, financialSection: true },
  { key: "management", label: "الإدارة والمتابعة", defaultOpen: false, managerOnly: true },
];

const SIDEBAR_GROUPS_KEY = "dawaawael_sidebar_groups_v1";

// Prefetch للكود فقط عند اقتراب المستخدم من الصفحة؛ لا يبدأ أي استعلام بيانات قبل فتح الصفحة نفسها.
const ROUTE_PREFETCHERS = {
  "/financial-reports": () => import("@/pages/FinancialReports"),
  "/smart-commerce-analytics": () => import("@/pages/SmartCommerceAnalytics"),
  "/data-reconciliation": () => import("@/pages/DataReconciliation"),
  "/daily-close": () => import("@/pages/DailyClose"),
  "/system-health": () => import("@/pages/SystemHealth"),
  "/shift-delivery": () => import("@/pages/ShiftDelivery"),
  "/supplier-intelligence": () => import("@/pages/SupplierIntelligence"),
};

const prefetchRoute = (path) => {
  const pathOnly = path?.split("?")[0];
  const loader = ROUTE_PREFETCHERS[pathOnly];
  if (loader) loader().catch(() => {});
};

function loadGroupState() {
  const fallback = Object.fromEntries(NAV_SECTIONS.map((section) => [section.key, section.defaultOpen]));
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(window.localStorage.getItem(SIDEBAR_GROUPS_KEY) || "{}");
    return { ...fallback, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return fallback;
  }
}

export default function AppLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(loadGroupState);
  const { isAdmin, isManager, canViewFinancialReports, canViewAllBranchesFinancials, financialAccessLevel, user, canUseCoreOperationalEntry } = useUserRole();
  const visibleNavItems = navItems.filter((item) =>
    !item.hidden &&
    (!item.adminOnly || isAdmin) &&
    (!item.managerOnly || isManager) &&
    (!item.financialOnly || canViewFinancialReports) &&
    (!item.fullFinancialOnly || canViewAllBranchesFinancials) &&
    (!item.nonDeliveryOnly || canUseCoreOperationalEntry)
  );

  const groupedNavItems = useMemo(
    () => NAV_SECTIONS
      .filter((section) => (!section.managerOnly || isManager) && (!section.financialSection || canViewAllBranchesFinancials))
      .map((section) => ({
        ...section,
        items: visibleNavItems.filter((item) => item.section === section.key),
      }))
      .filter((section) => section.items.length > 0),
    [isAdmin, isManager, canViewFinancialReports, canViewAllBranchesFinancials]
  );

  const isItemActive = (item) => {
    const pathOnly = item.path.split("?")[0];
    const itemSearch = item.path.includes("?") ? `?${item.path.split("?")[1]}` : "";
    return location.pathname === pathOnly && (itemSearch ? location.search === itemSearch : true);
  };

  const toggleGroup = (key) => {
    setOpenGroups((prev) => {
      const willOpen = !prev[key];
      const next = { ...prev, [key]: willOpen };
      if (willOpen && key === "reports") {
        ["/financial-reports", "/smart-commerce-analytics", "/data-reconciliation", "/daily-close"].forEach(prefetchRoute);
      }
      try {
        window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // تجاهل فشل التخزين المحلي بدون التأثير على القائمة.
      }
      return next;
    });
  };

  const renderNavItem = (item, isMobile = false) => (
    <Link
      key={item.path}
      to={item.path}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
      onTouchStart={() => prefetchRoute(item.path)}
      onClick={() => isMobile && setOpen(false)}
      className={cn(
        "flex items-center gap-3 rounded-lg text-[15px] font-medium transition-colors",
        item.indent ? "px-2 py-1.5 mr-2" : "px-2.5 py-2",
        item.gold
          ? "bg-yellow-50 text-yellow-700 border border-yellow-300"
          : item.pink
          ? "bg-pink-50 text-pink-700 border border-pink-200"
          : item.dark
          ? "bg-gray-900 text-white border border-gray-700"
          : item.teal
          ? "bg-teal-600 text-white border border-teal-700"
          : item.cyan
          ? "bg-cyan-600 text-white border border-cyan-700"
          : item.violet
          ? "bg-violet-600 text-white border border-violet-700"
          : item.emerald
          ? "bg-emerald-600 text-white border border-emerald-700"
          : item.purple
          ? "bg-purple-600 text-white border border-purple-700"
          : isItemActive(item)
          ? "bg-teal-50 text-teal-700"
          : item.indent
          ? "text-gray-500 hover:bg-gray-100 text-xs"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      <item.icon className={cn(item.indent ? "w-3.5 h-3.5" : "w-[18px] h-[18px]", item.gold && "text-yellow-500", item.pink && "text-pink-500", item.dark && "text-white", item.teal && "text-white", item.cyan && "text-white", item.violet && "text-white", item.emerald && "text-white", item.purple && "text-white")} />
      <span className="flex-1">{item.label}</span>
      {item.badge && <span className="w-2 h-2 rounded-full bg-yellow-400" title="توجد صفحة مخصصة للمراجعة" />}
    </Link>
  );

  const renderNavSections = (isMobile = false) => (
    groupedNavItems.map((section, index) => {
      const activeInside = section.items.some(isItemActive);
      const expanded = activeInside || openGroups[section.key];
      return (
        <div key={section.key} className={cn(index > 0 && "pt-2 mt-2 border-t border-gray-100")}>
          <button
            type="button"
            onClick={() => toggleGroup(section.key)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50"
            aria-expanded={expanded}
          >
            <span>{section.label}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <div className="space-y-1 mt-1">
              {section.items.map((item) => renderNavItem(item, isMobile))}
            </div>
          )}
        </div>
      );
    })
  );

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:flex flex-col w-56 bg-white border-l shadow-sm shrink-0">
        <div className="p-4 border-b bg-teal-600">
          <h1 className="text-white font-bold text-lg">صيدليات دواء</h1>
          <p className="text-teal-100 text-xs mt-0.5">مشتريات</p>
          <div className="mt-2 rounded-lg bg-white/10 px-2 py-1.5">
            <p className="text-[11px] text-white font-semibold truncate">{user?.management_display_name || user?.full_name || "حساب النظام"}</p>
            <p className="text-[10px] text-teal-100 mt-0.5">{FINANCIAL_ACCESS_LABELS[financialAccessLevel] || "تشغيلي فقط"}</p>
          </div>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {renderNavSections(false)}
        </nav>
      </aside>

      <div className="md:hidden fixed top-0 right-0 left-0 z-[60] bg-teal-600 flex items-center justify-between px-4 py-3">
        <p className="text-teal-100 text-sm">مشتريات</p>
        <h1 className="text-white font-bold">صيدليات دواء</h1>
        <button onClick={() => setOpen(true)} className="text-white p-2 -m-2 active:bg-teal-500 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 p-0 data-[state=open]:duration-150 data-[state=closed]:duration-150" dir="rtl">
          <div className="p-4 border-b bg-teal-600">
            <h1 className="text-white font-bold text-lg">صيدليات دواء</h1>
            <p className="text-teal-100 text-xs mt-0.5">مشتريات</p>
            <div className="mt-2 rounded-lg bg-white/10 px-2 py-1.5">
              <p className="text-[11px] text-white font-semibold truncate">{user?.management_display_name || user?.full_name || "حساب النظام"}</p>
              <p className="text-[10px] text-teal-100 mt-0.5">{FINANCIAL_ACCESS_LABELS[financialAccessLevel] || "تشغيلي فقط"}</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 h-[calc(100vh-64px)]">
            {renderNavSections(true)}
          </nav>
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 md:overflow-auto pt-14 md:pt-0 flex flex-col">
        <div className="px-4 pt-3 pb-0 flex justify-end">
          <SmartAlerts />
        </div>
        <div className="flex-1">
          <Suspense fallback={
            <div className="min-h-[45vh] flex items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <div className="w-6 h-6 border-3 border-gray-200 border-t-teal-600 rounded-full animate-spin" />
                جاري فتح الصفحة...
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}