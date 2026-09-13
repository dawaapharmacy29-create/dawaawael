import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

const normalize = (value = "") => value.trim().replace(/\s+/g, " ").replace(/^د\/?\s*/, "د ").replace(/^ا\s+/, "").toLowerCase();

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadAllFiltered(entity, query, sort, maxRows = 10000) {
  const PAGE = 500;
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.filter(query, sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

function HealthCard({ title, value, subtitle, icon: Icon, bad = false, warn = false }) {
  const cls = bad ? "border-red-200 bg-red-50" : warn ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";
  const iconCls = bad ? "text-red-600" : warn ? "text-amber-600" : "text-emerald-600";
  return (
    <div className={`rounded-xl p-4 border ${cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-600">{title}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{Number(value || 0).toLocaleString("ar-EG")}</p>
          {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <Icon className={`w-5 h-5 ${iconCls}`} />
      </div>
    </div>
  );
}

export default function SystemHealth() {
  const { isAdmin } = useUserRole();
  const recentFrom = dateDaysAgo(120);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["system-health-team-members"],
    queryFn: () => base44.entities.TeamMember.list("name"),
    staleTime: 120000,
  });
  const { data: identityMap = [], isLoading: identityLoading } = useQuery({
    queryKey: ["system-health-identity-map"],
    queryFn: () => base44.entities.EmployeeNameMap.list("canonical_name"),
    staleTime: 120000,
  });
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ["system-health-shifts", recentFrom],
    queryFn: () => loadAllFiltered(base44.entities.ShiftDelivery, { shift_date: { $gte: recentFrom } }, "-shift_date"),
    staleTime: 120000,
  });
  const { data: pendingInvoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["pending-invoices-count"],
    queryFn: () => loadAllFiltered(base44.entities.PurchaseInvoice, { status: "انتظار المراجعة" }, "-created_date"),
    staleTime: 60000,
  });
  const { data: failedSyncRows = [], isLoading: syncLoading } = useQuery({
    queryKey: ["system-health-sync-failed"],
    queryFn: () => loadAllFiltered(base44.entities.SyncOutbox, { status: { $in: ["failed", "pending_retry"] } }, "-created_date", 20000),
    staleTime: 120000,
  });
  const { data: lastSuccessfulSyncRows = [] } = useQuery({
    queryKey: ["system-health-last-successful-sync"],
    queryFn: () => base44.entities.SyncOutbox.filter({ status: "synced" }, "-synced_at", 1),
    staleTime: 120000,
  });

  const activeMembers = useMemo(() => members.filter((m) => m.is_active !== false), [members]);
  const duplicateMembers = useMemo(() => {
    const groups = new Map();
    activeMembers.forEach((m) => {
      const key = normalize(m.name);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });
    return [...groups.values()].filter((group) => group.length > 1);
  }, [activeMembers]);

  const identityKeys = useMemo(() => {
    const set = new Set();
    identityMap.filter((x) => x.is_active !== false).forEach((x) => {
      set.add(normalize(x.canonical_name));
      (x.aliases || []).forEach((alias) => set.add(normalize(alias)));
    });
    return set;
  }, [identityMap]);

  const membersWithoutIdentity = useMemo(
    () => activeMembers.filter((m) => !identityKeys.has(normalize(m.name))),
    [activeMembers, identityKeys]
  );
  const unlinkedIdentities = useMemo(
    () => identityMap.filter((x) => x.is_active !== false && x.management_account_status === "not_linked"),
    [identityMap]
  );

  const activeShifts = useMemo(() => shifts.filter((s) => s.is_archived !== true), [shifts]);
  const reviewShifts = useMemo(() => activeShifts.filter((s) => s.status === "مراجعة"), [activeShifts]);
  const duplicateShiftGroups = useMemo(() => {
    const groups = new Map();
    activeShifts.forEach((s) => {
      if (!s.shift_date) return;
      const key = `${s.branch || ""}|${s.shift_date}|${s.shift_type || ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    return [...groups.values()].filter((group) => group.length > 1);
  }, [activeShifts]);

  const failedSync = failedSyncRows;
  const lastSync = lastSuccessfulSyncRows[0]?.synced_at || null;
  const loading = membersLoading || identityLoading || shiftsLoading || invoicesLoading || syncLoading;
  const issueCount = duplicateMembers.length + membersWithoutIdentity.length + unlinkedIdentities.length + reviewShifts.length + duplicateShiftGroups.length + pendingInvoices.length + failedSync.length;

  if (!isAdmin) {
    return <div dir="rtl" className="p-8 text-center text-gray-500">هذه الصفحة للمدير فقط.</div>;
  }

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-teal-600" /> صحة النظام والبيانات</h1>
          <p className="text-sm text-gray-500 mt-1">مراقبة الهوية، التكرارات، سجلات المراجعة والمزامنة قبل أن تؤثر على التقارير.</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${issueCount > 0 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
          {loading ? "جاري الفحص..." : issueCount > 0 ? `${issueCount.toLocaleString("ar-EG")} نقطة تحتاج مراجعة` : "النظام سليم"}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthCard title="موظفون مكررون" value={duplicateMembers.length} subtitle="بعد توحيد المسافات وصيغ د/" icon={Users} bad={duplicateMembers.length > 0} />
        <HealthCard title="بدون ربط هوية" value={membersWithoutIdentity.length} subtitle="موظف نشط لا يطابق EmployeeNameMap" icon={Users} warn={membersWithoutIdentity.length > 0} />
        <HealthCard title="هوية غير مرتبطة بالإدارة" value={unlinkedIdentities.length} subtitle="لا يوجد حساب إدارة موثّق" icon={Database} warn={unlinkedIdentities.length > 0} />
        <HealthCard title="شيفتات تحت المراجعة" value={reviewShifts.length} subtitle="مستبعدة من الأرقام التنفيذية" icon={AlertTriangle} warn={reviewShifts.length > 0} />
        <HealthCard title="مجموعات شيفت مكررة" value={duplicateShiftGroups.length} subtitle="آخر 120 يوم" icon={AlertTriangle} bad={duplicateShiftGroups.length > 0} />
        <HealthCard title="فواتير تنتظر المراجعة" value={pendingInvoices.length} subtitle="لا تدخل في المسار النهائي قبل المراجعة" icon={Activity} warn={pendingInvoices.length > 0} />
        <HealthCard title="مزامنة متعثرة" value={failedSync.length} subtitle="كل سجلات Failed أو Pending retry غير المحلولة" icon={RefreshCw} bad={failedSync.length > 0} />
        <HealthCard title="آخر مزامنة ناجحة" value={lastSync ? 1 : 0} subtitle={lastSync ? new Date(lastSync).toLocaleString("ar-EG") : "لا توجد مزامنة ناجحة مسجلة"} icon={CheckCircle2} bad={!lastSync} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-bold text-gray-800 mb-3">مشكلات هوية الموظفين</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {duplicateMembers.map((group) => <div key={`dup-${normalize(group[0]?.name)}`} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm"><b>اسم مكرر:</b> {group.map((x) => x.name).join(" / ")}</div>)}
            {membersWithoutIdentity.map((m) => <div key={`missing-${m.id}`} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm"><b>بدون هوية:</b> {m.name} — {(m.branches || []).join("، ") || "بدون فرع"}</div>)}
            {unlinkedIdentities.map((m) => <div key={`unlinked-${m.id}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"><b>غير مرتبط بالإدارة:</b> {m.canonical_name} — {m.branch || "بدون فرع"}</div>)}
            {duplicateMembers.length === 0 && membersWithoutIdentity.length === 0 && unlinkedIdentities.length === 0 && <p className="text-sm text-emerald-600">لا توجد مشكلات هوية ظاهرة.</p>}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-bold text-gray-800 mb-3">مشكلات التشغيل المؤثرة على التقارير</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {duplicateShiftGroups.map((group) => <div key={`shift-${group[0]?.branch}-${group[0]?.shift_date}-${group[0]?.shift_type}`} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm"><b>شيفت مكرر:</b> {group[0]?.branch} — {group[0]?.shift_date} — {group[0]?.shift_type} ({group.length} سجلات)</div>)}
            {reviewShifts.slice(0, 20).map((s) => <div key={`review-${s.id}`} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm"><b>تحت المراجعة:</b> {s.branch} — {s.shift_date} — {s.shift_type}</div>)}
            {failedSync.slice(0, 20).map((r) => <div key={`sync-${r.id}`} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm"><b>مزامنة متعثرة:</b> {r.entity_name || "سجل"} — {r.status}</div>)}
            {duplicateShiftGroups.length === 0 && reviewShifts.length === 0 && failedSync.length === 0 && <p className="text-sm text-emerald-600">لا توجد مشكلات تشغيل ظاهرة في نطاق الفحص.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
