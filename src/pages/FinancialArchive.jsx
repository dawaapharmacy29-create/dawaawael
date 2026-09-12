import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArchiveRestore, Lock, Search, RotateCcw, FileText } from "lucide-react";

const TYPE_LABEL = {
  PurchaseInvoice: "فاتورة شراء",
  Return: "مرتجع",
};

export default function FinancialArchive() {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [message, setMessage] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["financial-archive"],
    queryFn: () => base44.entities.FinancialArchiveLog.list("-archived_at", 500),
    enabled: isAdmin,
  });

  const restoreMutation = useMutation({
    mutationFn: async (log) => {
      const res = await base44.functions.invoke("restoreFinancialArchive", {
        archive_log_id: log.id,
        restore_note: "استعادة من صفحة الأرشيف المالي",
      });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر استعادة السجل");
      return result;
    },
    onSuccess: (result) => {
      setMessage({ ok: true, text: result.already_restored ? "السجل كان مستعادًا بالفعل." : "تمت الاستعادة بنجاح بدون إنشاء نسخة مكررة." });
      qc.invalidateQueries({ queryKey: ["financial-archive"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      qc.invalidateQueries({ queryKey: ["returns"] });
    },
    onError: (error) => setMessage({ ok: false, text: error?.message || "تعذرت الاستعادة" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (typeFilter !== "all" && log.entity_type !== typeFilter) return false;
      if (!q) return true;
      const snapshot = log.snapshot || {};
      return [
        log.entity_label,
        log.branch,
        log.archived_by,
        log.archive_reason,
        snapshot.system_invoice_number,
        snapshot.supplier_invoice_number,
        snapshot.return_number,
        snapshot.invoice_number,
        snapshot.supplier_name,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [logs, search, typeFilter]);

  if (!isAdmin) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-gray-400">
        <Lock className="w-12 h-12" />
        <p className="font-semibold">الأرشيف المالي متاح للمدير العام فقط</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center">
            <ArchiveRestore className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">الأرشيف المالي الآمن</h1>
            <p className="text-xs text-gray-500">نسخ كاملة محفوظة قبل حذف فواتير المشتريات أو المرتجعات من التشغيل</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1.5">
          {logs.length} سجل محفوظ
        </div>
      </div>

      <div className="bg-white border rounded-xl p-3 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة، المورد، الفرع أو منفذ الحذف..." className="pr-9 h-9" />
        </div>
        {[['all','الكل'], ['PurchaseInvoice','فواتير الشراء'], ['Return','المرتجعات']].map(([value, label]) => (
          <button key={value} onClick={() => setTypeFilter(value)} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${typeFilter === value ? "bg-slate-800 border-slate-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`rounded-xl border p-3 text-sm ${message.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="p-10 text-center text-gray-400">جاري تحميل الأرشيف...</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-gray-400 bg-white border rounded-xl">لا توجد سجلات مطابقة.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const snapshot = log.snapshot || {};
            const restored = !!log.restored_entity_id;
            const title = log.entity_type === "PurchaseInvoice"
              ? snapshot.system_invoice_number || log.entity_label
              : snapshot.return_number || snapshot.invoice_number || log.entity_label;
            const supplier = snapshot.supplier_name || "—";
            return (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="font-bold text-gray-800">{TYPE_LABEL[log.entity_type] || log.entity_type}</span>
                      <span className="font-mono text-sm text-gray-600">#{title || log.entity_id}</span>
                      {restored && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">تمت الاستعادة</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-1 mt-3 text-xs text-gray-600">
                      <p><b>الفرع:</b> {log.branch || snapshot.branch || snapshot.branch_name || "—"}</p>
                      <p><b>المورد:</b> {supplier}</p>
                      <p><b>حذفه:</b> {log.archived_by || "—"}</p>
                      <p><b>وقت الحذف:</b> {log.archived_at ? new Date(log.archived_at).toLocaleString("ar-EG") : "—"}</p>
                    </div>
                    <p className="mt-2 text-xs text-amber-700"><b>السبب:</b> {log.archive_reason || "غير محدد"}</p>
                    {log.archive_note && <p className="mt-1 text-xs text-gray-500"><b>ملاحظة:</b> {log.archive_note}</p>}
                    {restored && <p className="mt-1 text-xs text-green-700">استعاده {log.restored_by || "مدير النظام"} — {log.restored_at ? new Date(log.restored_at).toLocaleString("ar-EG") : ""}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restored || restoreMutation.isPending}
                    onClick={() => {
                      setMessage(null);
                      const ok = window.confirm(`استعادة ${TYPE_LABEL[log.entity_type] || "السجل"} رقم ${title || log.entity_id}؟\nسيتم منع العملية تلقائيًا إذا كان السجل موجودًا بالفعل.`);
                      if (ok) restoreMutation.mutate(log);
                    }}
                    className="gap-1.5 border-slate-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {restored ? "تمت الاستعادة" : "استعادة آمنة"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
