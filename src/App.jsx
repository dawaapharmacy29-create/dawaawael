import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import { lazy, useEffect } from "react";
import FinancialRouteGuard from "@/components/security/FinancialRouteGuard";
import { FINANCIAL_ACCESS } from "@/lib/financialAccess";

// تقسيم الصفحات إلى حزم مستقلة: الصفحة لا تُحمّل إلا عند فتحها.
// يقلل حجم التحميل الأولي ويمنع تحميل كود التقارير وHR والمخزون مع الصفحة الرئيسية.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PurchaseInvoices = lazy(() => import('./pages/PurchaseInvoices.jsx'));
const PurchaseReports = lazy(() => import('./pages/PurchaseReports.jsx'));
const Suppliers = lazy(() => import('./pages/Suppliers.jsx'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const SupplierBalances = lazy(() => import('./pages/SupplierBalances'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const TeamMembers = lazy(() => import('./pages/TeamMembers'));
const PendingInvoices = lazy(() => import('./pages/PendingInvoices'));
const MedicineList = lazy(() => import('./pages/MedicineList'));
const Returns = lazy(() => import('./pages/Returns'));
const InventoryManagement = lazy(() => import('./pages/InventoryManagement'));
const CustomerOrders = lazy(() => import('./pages/CustomerOrders'));
const PharmacyOrders = lazy(() => import('./pages/PharmacyOrders'));
const InventoryCount = lazy(() => import('./pages/InventoryCount'));
const ReportsBranch = lazy(() => import('./pages/ReportsBranch'));
const SupplierBalancesBranch = lazy(() => import('./pages/SupplierBalancesBranch'));
const SupplierIntelligence = lazy(() => import('./pages/SupplierIntelligence'));
const ReplenishmentPage = lazy(() => import('./pages/ReplenishmentPage'));
const FinancialReports = lazy(() => import('./pages/FinancialReports'));
const FinancialArchive = lazy(() => import('./pages/FinancialArchive'));
const ShiftDelivery = lazy(() => import('./pages/ShiftDelivery'));
const SecurityAuditPage = lazy(() => import('./pages/SecurityAuditPage'));
const SupplierRulesBackfill = lazy(() => import('./pages/SupplierRulesBackfill'));
const ReviewNeededInvoices = lazy(() => import('./components/invoices/ReviewNeededInvoices'));
const SupabaseSyncCenter = lazy(() => import('./pages/SupabaseSyncCenter'));
const EmployeeHR = lazy(() => import('./pages/EmployeeHR'));
const AdminExpensesShokry = lazy(() => import('./pages/AdminExpensesShokry'));
const AdminExpensesShami = lazy(() => import('./pages/AdminExpensesShami'));
const AdminExpensesReports = lazy(() => import('./pages/AdminExpensesReports'));
const SmartCommerceAnalytics = lazy(() => import('./pages/SmartCommerceAnalytics'));
const SystemHealth = lazy(() => import('./pages/SystemHealth')); 
const DataReconciliation = lazy(() => import('./pages/DataReconciliation'));
const DailyClose = lazy(() => import('./pages/DailyClose'));
import { setNumbersHidden } from "@/lib/westernDigits";
import { startNumberMasking, stopNumberMasking } from "@/lib/viewerNumberMask";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  // دور "مشاهد" (viewer): يتصفح التطبيق كاملًا بدون رؤية أي رقم
  const isViewerRole = !!user && (user.role || "viewer") === "viewer";
  useEffect(() => {
    setNumbersHidden(isViewerRole);
    if (isViewerRole) startNumberMasking();
    else stopNumberMasking();
    return () => stopNumberMasking();
  }, [isViewerRole]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<PurchaseInvoices />} />
        <Route path="/purchase-reports" element={<FinancialRouteGuard><PurchaseReports /></FinancialRouteGuard>} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports" element={<FinancialRouteGuard><Reports /></FinancialRouteGuard>} />
        <Route path="/admin-expenses-shokry" element={<AdminExpensesShokry />} />
        <Route path="/admin-expenses-shami" element={<AdminExpensesShami />} />
        <Route path="/admin-expenses-reports" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><AdminExpensesReports /></FinancialRouteGuard>} />
        <Route path="/supplier-balances" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><SupplierBalances /></FinancialRouteGuard>} />
        <Route path="/activity-log" element={<ActivityLog />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/team-members" element={<TeamMembers />} />
        <Route path="/pending-invoices" element={<PendingInvoices />} />
        <Route path="/medicine-list" element={<MedicineList />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/customer-orders" element={<CustomerOrders />} />
        <Route path="/pharmacy-orders" element={<PharmacyOrders />} />
        <Route path="/inventory-count" element={<InventoryCount />} />
        <Route path="/reports-branch" element={<FinancialRouteGuard><ReportsBranch /></FinancialRouteGuard>} />
        <Route path="/supplier-balances-branch" element={<FinancialRouteGuard><SupplierBalancesBranch /></FinancialRouteGuard>} />
        <Route path="/supplier-intelligence" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><SupplierIntelligence /></FinancialRouteGuard>} />
        <Route path="/replenishment" element={<ReplenishmentPage />} />
        <Route path="/financial-reports" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><FinancialReports /></FinancialRouteGuard>} />
        <Route path="/smart-commerce-analytics" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><SmartCommerceAnalytics /></FinancialRouteGuard>} />
        <Route path="/financial-archive" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><FinancialArchive /></FinancialRouteGuard>} />
        <Route path="/shift-delivery" element={<ShiftDelivery />} />
        <Route path="/security-audit" element={<SecurityAuditPage />} />
        <Route path="/supplier-rules-backfill" element={<SupplierRulesBackfill />} />
        <Route path="/review-needed-invoices" element={<ReviewNeededInvoices />} />
        <Route path="/supabase-sync" element={<SupabaseSyncCenter />} />
        <Route path="/employee-hr" element={<EmployeeHR />} />
        <Route path="/system-health" element={<SystemHealth />} />
        <Route path="/data-reconciliation" element={<FinancialRouteGuard minimum={FINANCIAL_ACCESS.FULL}><DataReconciliation /></FinancialRouteGuard>} />
        <Route path="/daily-close" element={<FinancialRouteGuard><DailyClose /></FinancialRouteGuard>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App