import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArchiveRestore, RotateCcw, Search } from "lucide-react";

const TYPE_LABEL = {
  EmployeeLoan: "سلفة",
  EmployeePermission: "إذن",
  EmployeeLeave: "إجازة",
};

export default function HRArchiveTab() {
  const { isManager } = useUserRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["employee-loans"],
    queryFn: () => base44.entities.EmployeeLoan.list("-created_date", 500),
  });
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["employee-permissions"],
    queryFn: () => base44.entities.EmployeePermission.list("-created_date", 500),
  });
  const { data: leaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ["employee-leaves"],
    queryFn: () => base44.entities.EmployeeLeave.list("-created_date", 500),
  });

  const archived = useMemo(() => {
    const rows = [
      ...loans.filter((r) => r.is_archived === true).map((r) => ({ ...r, _entityType: "EmployeeLoan", _date: r.date })),
      ...permissions.filter((r) => r.is_archived === true).map((r) => ({ ...r, _entityType: "EmployeePermission", _date: r.date })),
      ...leaves.filter((r) => r.is_archived === true).map((r) => ({ ...r, _entityType: "EmployeeLeave", _date: r.start_date })),
    ];
    rows.sort((a, b) => String(b.archived_at || "").localeCompare(String(a.archived_at || "")));
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.employee_name, r.branch, r.archive_reason, r.archive_note, TYPE_LABEL[r._entityType]].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [loans, permissions, leaves, search]);

  const restoreMut = useMutation({
    mutationFn: async (record) => {
      const res = await base44.functions.invoke("archiveHRRecordSafe", {
        id: record.id,
        entity_type: record._entityType,
        action: "restore",
      });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر استعادة السجل");
      return result.record;
    },
    onSuccess: () => {
      setMessage({ ok: true, text: "تمت استعادة السجل إلى شؤون الموظفين." });
      qc.invalidateQueries({ queryKey: ["employee-loans"] });
      qc.invalidateQueries({ queryKey: ["employee-permissions"] });
      qc.invalidateQueries({ queryKey: ["employee-leaves"] });
    },
    onError: (error) => setMessage({ ok: false, text: error?.message || "تعذرت الاستعادة" }),
  });

  if (!isManager) return <div className="p-8 text-center text-gray-400">الأرشيف متاح للإدارة فقط.</div>;

  const loading = loansLoading || permissionsLoading || leavesLoading;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArchiveRestore className="w-5 h-5 text-slate-600" />
        <div>
          <h3 className="font-bold text-sm">أرشيف شؤون الموظفين</h3>
          <p className="text-xs text-gray-500">السجلات المؤرشفة محفوظة ولا تدخل في الأرصدة أو الحسابات التشغيلية.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالموظف، الفرع أو سبب الأرشفة..." className="pr-9 h-9" />
      </div>

      {message && <div className={`p-3 rounded-lg border text-sm ${message.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>{message.text}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-400">جاري تحميل الأرشيف...</div>
      ) : archived.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">لا توجد سجلات مؤرشفة.</Card>
      ) : (
        <div className="space-y-2">
          {archived.map((record) => (
            <Card key={`${record._entityType}-${record.id}`} className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">{TYPE_LABEL[record._entityType]}</span>
                  <span className="font-semibold text-sm">{record.employee_name}</span>
                  {record.branch && <span className="text-xs text-gray-500">{record.branch}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">التاريخ: {record._date || "—"} • الأرشفة: {record.archived_at ? new Date(record.archived_at).toLocaleString("ar-EG") : "—"}</p>
                <p className="text-xs text-amber-700 mt-1">السبب: {record.archive_reason || "أرشفة إدارية"}</p>
                {record.archive_note && <p className="text-xs text-gray-500 mt-0.5">{record.archive_note}</p>}
                {record.archived_by && <p className="text-[11px] text-gray-400 mt-0.5">بواسطة: {record.archived_by}</p>}
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={restoreMut.isPending} onClick={() => restoreMut.mutate(record)}>
                <RotateCcw className="w-3.5 h-3.5" /> استعادة
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
