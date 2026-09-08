import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * نظام الأدوار والصلاحيات:
 * - admin (مدير): كل الصلاحيات تلقائياً على كل صفحات وميزات التطبيق.
 * - supervisor (مشرف): صلاحية ثابتة ومحدودة على 5 مناطق فقط:
 *     فواتير الشراء، تسجيل طلب عميل، المصروفات، المرتجعات، وتبويب "تسليم جديد" فقط من تسليم الشيفت.
 *     كل ما عدا ذلك (التقارير، أرصدة الموردين، تقارير المشتريات اليومي، والإدارة والمتابعة بكل صفحاتها) للمدير فقط.
 * - viewer (مشاهد): عرض فقط، بدون أي صلاحية إدخال أو تعديل.
 */
export function useUserRole() {
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.me(),
  });

  const role = user?.role || "viewer";
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isViewer = role === "viewer";

  // "isManager" هنا يعني صلاحيات إدارية كاملة على كل شيء عدا الـ 5 مناطق المحددة
  // للمشرف أدناه — أصبحت الآن مقصورة على المدير فقط.
  const isManager = isAdmin;

  // صلاحيات المشرف الثابتة (نفس الصلاحية للمدير أيضاً بحكم أنه فوق الجميع)
  const canPurchaseInvoices = isAdmin || isSupervisor;
  const canCustomerOrders = isAdmin || isSupervisor;
  const canExpenses = isAdmin || isSupervisor;
  const canReturns = isAdmin || isSupervisor;
  const canNewDelivery = isAdmin || isSupervisor;

  const canDeleteInvoice = isAdmin || !!user?.can_delete_invoice;
  const canSaveInvoice = isAdmin || isSupervisor || !!user?.can_save_invoice;
  const canManageTeam = isAdmin || !!user?.can_manage_team;
  const canSetBudget = isAdmin || !!user?.can_set_budget;

  return {
    role, isAdmin, isSupervisor, isManager, isViewer, user,
    canDeleteInvoice, canSaveInvoice, canManageTeam, canSetBudget,
    canPurchaseInvoices, canCustomerOrders, canExpenses, canReturns, canNewDelivery,
  };
}
