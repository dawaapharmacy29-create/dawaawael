import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, UserPlus, Mail, Check, X, Lock, Link2, Unlink, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/useUserRole";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortControls } from "@/components/table/SortControls";
import { USER_ROLE_ORDER } from "@/lib/sortUtils";
import { FINANCIAL_ACCESS, FINANCIAL_ACCESS_LABELS, getFinancialAccessLevel } from "@/lib/financialAccess";

const USER_SORT_COLUMNS = [
  { field: "full_name", label: "الاسم", type: "text" },
  { field: "email", label: "البريد", type: "text" },
  { field: "role", label: "الدور", type: "status", statusMap: USER_ROLE_ORDER },
  { field: "created_date", label: "تاريخ الإضافة", type: "date" },
];

const ROLE_CONFIG = {
  admin: { label: "مدير نظام", color: "bg-red-100 text-red-700", desc: "إدارة تقنية؛ لا تمنح تفاصيل مالية تلقائيًا" },
  manager: { label: "مدير / مشرف", color: "bg-blue-100 text-blue-700", desc: "صلاحيات مراجعة تشغيلية حسب نطاق الفرع" },
  viewer: { label: "مستخدم تشغيلي", color: "bg-gray-100 text-gray-700", desc: "تشغيل يومي بدون تفاصيل مالية افتراضيًا" },
};

const BRANCH_OPTIONS = ["دواء شكري", "دواء الشامي"];

const PERMISSIONS = [
  { key: "can_save_invoice", label: "إضافة وتعديل الفواتير" },
  { key: "can_delete_invoice", label: "حذف الفواتير" },
  { key: "can_manage_team", label: "إدارة فريق العمل" },
  { key: "can_set_budget", label: "تحديد الحد الأقصى للمشتريات" },
];

export default function UserManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { checkUserAuth } = useAuth();
  const { isAdmin, user: currentUser } = useUserRole();
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "viewer" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: unifiedDirectory = { directory: [], users: [] }, isLoading: unifiedLoading, refetch: refetchUnified } = useQuery({
    queryKey: ["unified-login-directory"],
    queryFn: async () => {
      const res = await base44.functions.invoke("manageUnifiedLoginDirectory", { action: "list" });
      const payload = res?.data || {};
      if (!payload.success) throw new Error(payload.error || "تعذر تحميل دليل الدخول الموحد");
      return payload;
    },
    enabled: isAdmin,
    staleTime: 60000,
  });
  const { sortField, sortDirection, toggleSort, setSort, resetSort, sortData } = useTableSorting({
    columns: USER_SORT_COLUMNS,
    defaultSort: { field: "full_name", direction: "asc" },
    paramPrefix: "usr",
  });
  const sortedUsers = useMemo(() => sortData(users), [users, sortData]);

  const updateRole = useMutation({
    mutationFn: async ({ id, role, oldRole, userEmail }) => {
      await base44.entities.User.update(id, { role });
      await logActivity({
        action_type: "role_change",
        entity_type: "user",
        entity_id: id,
        record_id: id,
        entity_label: userEmail,
        old_value: oldRole,
        new_value: role,
        reason: "تغيير دور المستخدم",
        details: `تغيير دور ${userEmail} من ${oldRole} إلى ${role}`,
      });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      await checkUserAuth();
    },
  });

  const updatePerm = useMutation({
    mutationFn: async ({ id, perm, value, oldValue, userEmail }) => {
      await base44.entities.User.update(id, { [perm]: value });
      await logActivity({
        action_type: "permission_change",
        entity_type: "user",
        entity_id: id,
        record_id: id,
        entity_label: userEmail,
        old_value: `${perm}: ${oldValue}`,
        new_value: `${perm}: ${value}`,
        reason: "تغيير صلاحية",
        details: `تغيير صلاحية ${perm} لـ ${userEmail}: ${oldValue} → ${value}`,
      });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      await checkUserAuth();
    },
  });

  const updateUnifiedLink = useMutation({
    mutationFn: async ({ action, directory_id, base44_user_id, financial_access_level }) => {
      const res = await base44.functions.invoke("manageUnifiedLoginDirectory", { action, directory_id, base44_user_id, financial_access_level });
      const payload = res?.data || {};
      if (!payload.success) throw new Error(payload.error || "تعذر تحديث الربط");
      return payload;
    },
    onSuccess: async () => {
      await refetchUnified();
      await checkUserAuth();
      toast({ title: "تم تحديث الربط", description: "تم تحديث هوية الدخول والصلاحية الفعلية بأمان." });
    },
    onError: (error) => toast({ title: "تعذر تحديث الربط", description: error?.message || "حدث خطأ", variant: "destructive" }),
  });

  const updateBranchAccess = useMutation({

    mutationFn: async ({ id, branches, oldBranches, userEmail }) => {
      await base44.entities.User.update(id, { branch_access: branches });
      await logActivity({
        action_type: "permission_change",
        entity_type: "user",
        entity_id: id,
        record_id: id,
        entity_label: userEmail,
        old_value: `branch_access: ${(oldBranches || []).join(", ") || "غير محدد"}`,
        new_value: `branch_access: ${(branches || []).join(", ") || "غير محدد"}`,
        reason: "تغيير نطاق الفروع",
        details: `تغيير نطاق فروع ${userEmail}: ${(branches || []).join("، ") || "بدون تقييد"}`,
      });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      await checkUserAuth();
    },
  });

  if (!isAdmin) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
        <Lock className="w-12 h-12" />
        <p className="text-lg font-medium">هذه الصفحة للمدير فقط</p>
      </div>
    );
  }

  const handleInvite = async () => {
    await base44.users.inviteUser(inviteForm.email, inviteForm.role === "admin" ? "admin" : "user");
    toast({ title: "تم إرسال الدعوة", description: `تم إرسال دعوة إلى ${inviteForm.email}` });
    setInviteDialog(false);
    setInviteForm({ email: "", role: "viewer" });
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">إدارة المستخدمين والصلاحيات</h1>
            <p className="text-gray-500 text-sm mt-0.5">تحديد أدوار وصلاحيات المستخدمين</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SortControls
            columns={USER_SORT_COLUMNS}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggle={toggleSort}
            onSet={setSort}
            onReset={resetSort}
            cardMode
          />
          <Button onClick={() => setInviteDialog(true)} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <UserPlus className="w-4 h-4" /> دعوة مستخدم
          </Button>
        </div>
      </div>

      {/* Roles Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <Card key={key} className="p-4 border-r-4 border-r-gray-300">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${cfg.color} border-0`}>{cfg.label}</Badge>
            </div>
            <p className="text-xs text-gray-500">{cfg.desc}</p>
          </Card>
        ))}
      </div>

      {/* Unified login directory — المصدر الموثوق لهوية الإدارة والصلاحية المالية */}
      <Card className="p-4 md:p-5 border-teal-200 bg-teal-50/30">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-teal-700" />
              <h2 className="font-bold text-gray-900">ربط الدخول الموحد</h2>
            </div>
            <p className="text-xs text-gray-600 mt-1">يربط يوزر تطبيق الإدارة بحساب Base44 الصحيح. لا يتم تخزين أو عرض أي كلمة مرور هنا.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchUnified()} disabled={unifiedLoading} className="gap-2 bg-white">
            <RefreshCw className={`w-4 h-4 ${unifiedLoading ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </div>

        {unifiedLoading ? (
          <div className="py-6 text-center text-sm text-gray-400">جاري تحميل روابط الدخول...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {(unifiedDirectory.directory || []).map((entry) => {
              const linkedUser = (unifiedDirectory.users || []).find((u) => u.id === entry.base44_user_id);
              return (
                <div key={entry.id} className="rounded-xl border bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{entry.display_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">يوزر الإدارة: <b dir="ltr">{entry.login_username}</b></p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{entry.management_role || "—"} · {entry.branch || "—"}</p>
                    </div>
                    <Badge className={entry.financial_access_level === "full" ? "bg-emerald-100 text-emerald-800" : entry.financial_access_level === "limited" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}>
                      {entry.financial_access_level === "full" ? "مالي كامل" : entry.financial_access_level === "limited" ? "مالي محدود" : "تشغيلي فقط"}
                    </Badge>
                  </div>

                  <div>
                    <Label className="text-xs">حساب Base44 المرتبط</Label>
                    <Select
                      value={entry.base44_user_id || "unlinked"}
                      disabled={updateUnifiedLink.isPending}
                      onValueChange={(value) => {
                        if (value === "unlinked") updateUnifiedLink.mutate({ action: "unlink", directory_id: entry.id });
                        else updateUnifiedLink.mutate({ action: "link", directory_id: entry.id, base44_user_id: value });
                      }}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unlinked">غير مربوط</SelectItem>
                        {(unifiedDirectory.users || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email} — {u.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="mt-1.5 text-[11px]">
                      {linkedUser ? <span className="text-emerald-700">✓ مربوط حاليًا بـ {linkedUser.full_name || linkedUser.email}</span> : <span className="text-amber-700">غير مربوط — لن يعمل الدخول باليوزر المختصر حتى يتم اختيار الحساب الصحيح</span>}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">مستوى الرؤية المالية الفعلي</Label>
                    <Select
                      value={entry.financial_access_level || "none"}
                      disabled={updateUnifiedLink.isPending}
                      onValueChange={(value) => updateUnifiedLink.mutate({ action: "set_financial_level", directory_id: entry.id, financial_access_level: value })}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">تشغيلي فقط</SelectItem>
                        <SelectItem value="limited">مالي محدود</SelectItem>
                        <SelectItem value="full">مالي كامل</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Users List */}
      {isLoading ? (
        <Card className="p-8 text-center text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedUsers.map((user) => {
            const role = user.role || "viewer";
            const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;
            return (
              <Card key={user.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                    {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{user.full_name || "—"}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Badge className={`${cfg.color} border-0 hidden sm:inline-flex`}>{cfg.label}</Badge>
                  <Select
                    value={role}
                    disabled={user.id === currentUser?.id}
                    onValueChange={(v) => updateRole.mutate({ id: user.id, role: v, oldRole: role, userEmail: user.email })}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مدير</SelectItem>
                      <SelectItem value="manager">محاسب / مشرف</SelectItem>
                      <SelectItem value="viewer">مشاهد</SelectItem>
                    </SelectContent>
                  </Select>
                  {user.id === currentUser?.id && (
                    <span className="text-[10px] text-gray-400">لا يمكن تغيير دورك</span>
                  )}
                </div>
                {/* الصلاحية المالية ونطاق الفرع مستقلان عن الدور التقني، لذلك يظهران لكل الحسابات. */}
                {true && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                      <p className="text-xs font-bold text-indigo-900">الصلاحية المالية الفعلية تُدار من «ربط الدخول الموحد» أعلاه</p>
                      <p className="text-[10px] text-indigo-700 mt-1">تم إلغاء الاعتماد الأمني على الحقل المالي داخل User حتى لا يستطيع أي مستخدم رفع صلاحياته ذاتيًا.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSIONS.map((p) => {
                        const val = !!user[p.key];
                        return (
                          <button
                            key={p.key}
                            disabled={user.id === currentUser?.id}
                            onClick={() => updatePerm.mutate({ id: user.id, perm: p.key, value: !val, oldValue: val, userEmail: user.email })}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              val ? "bg-teal-50 border-teal-300 text-teal-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-teal-200"
                            }`}
                          >
                            {val ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">نطاق الفروع</p>
                      <div className="flex flex-wrap gap-2">
                        {BRANCH_OPTIONS.map((branch) => {
                          const current = Array.isArray(user.branch_access) ? user.branch_access : [];
                          const enabled = current.includes(branch);
                          const next = enabled ? current.filter((b) => b !== branch) : [...current, branch];
                          return (
                            <button
                              key={branch}
                              disabled={updateBranchAccess.isPending}
                              onClick={() => updateBranchAccess.mutate({ id: user.id, branches: next, oldBranches: current, userEmail: user.email })}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                enabled ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-200"
                              }`}
                              title={!current.length ? "الحساب غير مقيد حاليًا بفرع — لن يتغير نطاقه إلا عند اختيار فرع" : "تعديل نطاق الفرع"}
                            >
                              {enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              {branch}
                            </button>
                          );
                        })}
                        {(!Array.isArray(user.branch_access) || user.branch_access.length === 0) && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                            غير محدد — السلوك القديم محفوظ بدون تقييد
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>دعوة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" placeholder="example@email.com" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>الدور</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="manager">محاسب / مشرف</SelectItem>
                  <SelectItem value="viewer">مشاهد</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviteDialog(false)}>إلغاء</Button>
            <Button disabled={!inviteForm.email} onClick={handleInvite} className="bg-teal-600 hover:bg-teal-700">
              إرسال الدعوة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}