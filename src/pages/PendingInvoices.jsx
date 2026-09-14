import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2, CheckSquare, ClipboardList, AlertTriangle, ArrowRightLeft, CircleDollarSign } from "lucide-react";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceViewDialog from "@/components/invoices/InvoiceViewDialog";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import ConfirmDialog from "@/components/invoices/ConfirmDialog";
import { logActivity } from "@/lib/activityLogger";
import { useUserRole } from "@/lib/useUserRole";
import { loadAllEntityFiltered } from "@/lib/entityPagination";
import { normalizeInvoiceNumber, getInvoiceEffectiveDate, getInvoiceCanonicalKey, isInvoiceInRange } from "@/lib/invoiceIdentity";
import { assertDailyCloseOpen, assertInvoiceDayOpen } from "@/lib/dailyCloseGuard";
import { cycleRangeFor, cairoTodayKey } from "@/lib/smart-commerce-analytics";
import { loadInvoicesByFinancialDate } from "@/lib/invoiceRangeLoader";
import { updatePurchaseInvoiceSafe } from "@/lib/purchaseInvoiceSafeUpdate";

export default function PendingInvoices() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState(null);
  const [smartFilter, setSmartFilter] = useState("all");
  const [bulkWarning, setBulkWarning] = useState("");

  const qc = useQueryClient();
  const { canSaveInvoice, canDeleteInvoice } = useUserRole();

  const invalidateInvoiceCaches = () => {
    [
      ["pending-invoices"], ["purchase-invoices"], ["pending-invoices-count"],
      ["purchase-reports-invoices"], ["reports-invoices"], ["smart-analytics-purchases"],
      ["pending-review-range-invoices"], ["daily-close-invoices"], ["supplier-credit-invoices"],
    ].forEach((queryKey) => qc.invalidateQueries({ queryKey }));
  };

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["pending-invoices"],
    queryFn: () => loadAllEntityFiltered(base44.entities.PurchaseInvoice, { status: "انتظار المراجعة" }, "-created_date"),
    staleTime: 60000,
  });

  const pendingRange = useMemo(() => {
    const dates = invoices.map(getInvoiceEffectiveDate).filter(Boolean).sort();
    return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
  }, [invoices]);

  const { data: rangeInvoices = [] } = useQuery({
    queryKey: ["pending-review-range-invoices", pendingRange?.from || "none", pendingRange?.to || "none"],
    queryFn: () => loadInvoicesByFinancialDate(base44.entities.PurchaseInvoice, {
      from: pendingRange.from,
      to: pendingRange.to,
      sort: "-invoice_date",
      maxRows: 20000,
    }),
    enabled: Boolean(pendingRange),
    staleTime: 60000,
  });

  const duplicateKeys = useMemo(() => {
    if (!pendingRange) return new Set();
    const groups = new Map();
    rangeInvoices.filter((i) => isInvoiceInRange(i, pendingRange.from, pendingRange.to)).forEach((inv) => {
      const key = getInvoiceCanonicalKey(inv);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(inv);
    });
    return new Set([...groups.entries()].filter(([, rows]) => rows.length > 1).map(([key]) => key));
  }, [rangeInvoices, pendingRange]);

  const currentCycle = useMemo(() => cycleRangeFor(cairoTodayKey()), []);
  const stats = useMemo(() => {
    const external = invoices.filter((i) => (i.transaction_type || "external_purchase") !== "internal_transfer");
    const internal = invoices.filter((i) => i.transaction_type === "internal_transfer");
    const zero = external.filter((i) => Number(i.total_value || 0) <= 0);
    const duplicate = invoices.filter((i) => duplicateKeys.has(getInvoiceCanonicalKey(i)));
    const current = invoices.filter((i) => isInvoiceInRange(i, currentCycle.from, currentCycle.to));
    const backlog = invoices.filter((i) => {
      const date = getInvoiceEffectiveDate(i);
      return date && date < currentCycle.from;
    });
    return { external, internal, zero, duplicate, current, backlog };
  }, [invoices, duplicateKeys, currentCycle]);

  const pending = useMemo(() => {
    if (smartFilter === "external") return stats.external;
    if (smartFilter === "internal") return stats.internal;
    if (smartFilter === "zero") return stats.zero;
    if (smartFilter === "duplicate") return stats.duplicate;
    if (smartFilter === "current") return stats.current;
    if (smartFilter === "backlog") return stats.backlog;
    return invoices;
  }, [invoices, stats, smartFilter]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const current = invoices.find((inv) => inv.id === id) || {};
      const next = { ...current, ...data };
      await assertInvoiceDayOpen(current, "مراجعة أو تعديل الفاتورة");
      if (getInvoiceEffectiveDate(next) !== getInvoiceEffectiveDate(current) || next.branch !== current.branch) {
        await assertInvoiceDayOpen(next, "نقل الفاتورة إلى يوم أو فرع آخر");
      }
      const identityChanged = ["system_invoice_number", "branch", "invoice_date"].some((field) => data?.[field] !== undefined && data[field] !== current[field]);
      const becomingFinancial = data?.status && !["انتظار المراجعة", "مرفوضة"].includes(data.status);
      if ((identityChanged || becomingFinancial) && next.branch && next.system_invoice_number) {
        const effectiveDate = getInvoiceEffectiveDate(next) || "";
        const canonicalNumber = normalizeInvoiceNumber(next.system_invoice_number);
        const candidates = effectiveDate
          ? await base44.entities.PurchaseInvoice.filter({ branch: next.branch, invoice_date: effectiveDate }, "-created_date", 1000)
          : await base44.entities.PurchaseInvoice.filter({ branch: next.branch }, "-created_date", 1000);
        const duplicate = candidates.some((inv) => inv.id !== id && normalizeInvoiceNumber(inv.system_invoice_number) === canonicalNumber && getInvoiceEffectiveDate(inv) === effectiveDate);
        if (duplicate) {
          throw new Error(`لا يمكن اعتماد الفاتورة قبل حل التكرار: "${next.system_invoice_number}" موجودة بالفعل في ${next.branch} بتاريخ ${effectiveDate || "نفس التاريخ"}`);
        }
      }
      return updatePurchaseInvoiceSafe(id, data);
    },
    onSuccess: (_, { data }) => {
      invalidateInvoiceCaches();
      setDialogOpen(false);
      setEditingInvoice(null);
      logActivity({ action_type: "update", entity_type: "invoice", entity_id: _.id, entity_label: data.system_invoice_number, details: `تعديل فاتورة` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const inv = invoices.find((i) => i.id === id);
      await assertInvoiceDayOpen(inv, "حذف الفاتورة");
      const res = await base44.functions.invoke("deletePurchaseInvoiceSafe", {
        id,
        reason: "حذف فاتورة من شاشة انتظار المراجعة",
        note: inv ? `فاتورة ${inv.system_invoice_number || id} — ${inv.supplier_name || ""}` : "",
      });
      const result = res?.data || {};
      if (!result.success) throw new Error(result.error || "تعذر حذف الفاتورة بأمان");
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData(["pending-invoices"], (old = []) => old.filter((inv) => inv.id !== id));
      invalidateInvoiceCaches();
      setSelectedIds((prev) => prev.filter((s) => s !== id));
      logActivity({ action_type: "delete", entity_type: "invoice", entity_id: id, entity_label: id, details: `حذف آمن بعد حفظ Snapshot كامل` });
    },
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async (selected) => {
      const groupedChecks = new Map();
      const closeChecks = new Map();
      selected.forEach((inv) => {
        const date = getInvoiceEffectiveDate(inv) || "";
        closeChecks.set(`${inv.branch || ""}|${date}`, { branch: inv.branch, date });
      });
      await Promise.all([...closeChecks.values()].map(({ branch: b, date }) => assertDailyCloseOpen(b, date, "اعتماد الفواتير")));

      selected.forEach((inv) => {
        const date = getInvoiceEffectiveDate(inv) || "";
        const key = `${inv.branch || ""}|${date}`;
        if (!groupedChecks.has(key)) groupedChecks.set(key, { branch: inv.branch, date });
      });

      const serverGroups = new Map();
      await Promise.all([...groupedChecks.entries()].map(async ([key, meta]) => {
        const rows = meta.date
          ? await base44.entities.PurchaseInvoice.filter({ branch: meta.branch, invoice_date: meta.date }, "-created_date", 1000)
          : await base44.entities.PurchaseInvoice.filter({ branch: meta.branch }, "-created_date", 1000);
        serverGroups.set(key, rows);
      }));

      const unsafe = selected.filter((inv) => {
        const date = getInvoiceEffectiveDate(inv) || "";
        const group = serverGroups.get(`${inv.branch || ""}|${date}`) || [];
        const canonical = normalizeInvoiceNumber(inv.system_invoice_number);
        const duplicate = group.some((other) => other.id !== inv.id && normalizeInvoiceNumber(other.system_invoice_number) === canonical && getInvoiceEffectiveDate(other) === date);
        const zeroExternal = (inv.transaction_type || "external_purchase") !== "internal_transfer" && Number(inv.total_value || 0) <= 0;
        return duplicate || zeroExternal;
      });
      if (unsafe.length) throw new Error(`${unsafe.length} فاتورة تحتاج مراجعة فردية لأنها بقيمة صفر أو مشتبه تكرار.`);

      for (let i = 0; i < selected.length; i += 5) {
        const chunk = selected.slice(i, i + 5);
        await Promise.all(chunk.map((inv) => updatePurchaseInvoiceSafe(inv.id, { status: "يتم الحفظ" })));
      }
      await logActivity({ action_type: "bulk_status_change", entity_type: "invoice", entity_label: `${selected.length} فاتورة`, details: `اعتماد جماعي آمن: تحويل ${selected.length} فاتورة من انتظار المراجعة إلى يتم الحفظ بعد فحص التكرار والقيم الصفرية.` });
      return selected.length;
    },
    onSuccess: () => {
      setBulkWarning("");
      setSelectedIds([]);
      setConfirmSave(false);
      invalidateInvoiceCaches();
    },
    onError: (error) => {
      setBulkWarning(`تم إيقاف الاعتماد الجماعي: ${error?.message || "توجد فواتير تحتاج مراجعة فردية."}`);
      setConfirmSave(false);
    },
  });

  const executeBulkSave = () => {
    const selected = invoices.filter((i) => selectedIds.includes(i.id));
    if (!selected.length) return;
    bulkSaveMutation.mutate(selected);
  };

  const executeBulkDelete = () => {
    selectedIds.forEach((id) => deleteMutation.mutate(id));
    setSelectedIds([]);
  };

  const executeSingleDelete = () => {
    if (singleDeleteId) deleteMutation.mutate(singleDeleteId);
    setSingleDeleteId(null);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleToggleAll = (checked, rows) => {
    if (checked) setSelectedIds(rows.map((r) => r.id));
    else setSelectedIds([]);
  };

  const handleView = (inv) => { setViewInvoice(inv); setViewOpen(true); };
  const handleEdit = (inv) => { setEditingInvoice(inv); setDialogOpen(true); };
  const handleSingleDelete = (id) => { setSingleDeleteId(id); setConfirmDelete(true); };

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg shrink-0">
            <ClipboardList className="w-5 h-5 text-yellow-700" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-800">فواتير تنتظر المراجعة</h1>
            <p className="text-gray-500 text-sm mt-0.5">{invoices.length} فاتورة في انتظار المراجعة · الظاهر الآن {pending.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        {[
          { key: "all", label: "الكل", count: invoices.length, icon: ClipboardList },
          { key: "external", label: "شراء خارجي", count: stats.external.length, icon: CircleDollarSign },
          { key: "internal", label: "تحويل داخلي", count: stats.internal.length, icon: ArrowRightLeft },
          { key: "zero", label: "قيمة صفر", count: stats.zero.length, icon: AlertTriangle },
          { key: "duplicate", label: "مشتبه تكرار", count: stats.duplicate.length, icon: AlertTriangle },
          { key: "current", label: "الدورة الحالية", count: stats.current.length, icon: ClipboardList },
          { key: "backlog", label: "قديم متراكم", count: stats.backlog.length, icon: AlertTriangle },
        ].map((item) => (
          <button key={item.key} onClick={() => { setSmartFilter(item.key); setSelectedIds([]); setBulkWarning(""); }} className={`rounded-xl border p-3 text-right transition-colors ${smartFilter === item.key ? "border-teal-500 bg-teal-50" : "bg-white hover:bg-gray-50"}`}>
            <div className="flex items-center justify-between gap-2"><item.icon className="w-4 h-4 text-gray-500" /><span className="text-xl font-black">{item.count}</span></div>
            <p className="text-xs text-gray-600 mt-1">{item.label}</p>
          </button>
        ))}
      </div>

      {bulkWarning && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{bulkWarning}</span></div>}

      {stats.duplicate.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">«مشتبه تكرار» يعتمد على المفتاح الموحد: رقم الفاتورة بعد التطبيع + الفرع + التاريخ. لا يتم حذف أو دمج أي سجل تلقائيًا.</div>}

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-semibold text-yellow-700">تم تحديد {selectedIds.length} فاتورة</span>
          <div className="flex gap-2 sm:mr-auto">
            {canSaveInvoice && (
              <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50 gap-1.5" onClick={() => setConfirmSave(true)}>
                <CheckSquare className="w-3.5 h-3.5" /> <span className="hidden sm:inline">تحويل إلى</span> "يتم الحفظ"
              </Button>
            )}
            {canDeleteInvoice && (
              <Button size="sm" variant="outline" className="border-red-400 text-red-600 hover:bg-red-50 gap-1.5" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" /> حذف المحدد
              </Button>
            )}
            <button className="text-xs text-gray-500 hover:underline" onClick={() => setSelectedIds([])}>إلغاء</button>
          </div>
        </div>
      )}

      <InvoiceTable
        invoices={pending}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleSingleDelete}
        onView={handleView}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleAll={handleToggleAll}
      />

      <InvoiceFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingInvoice(null); }}
        onSubmit={(formData) => { if (editingInvoice) updateMutation.mutate({ id: editingInvoice.id, data: formData }); }}
        invoice={editingInvoice}
        isLoading={updateMutation.isPending}
        allInvoices={invoices}
      />

      <InvoiceViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        invoice={viewInvoice}
        onEdit={canSaveInvoice ? handleEdit : null}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => { setConfirmDelete(o); if (!o) setSingleDeleteId(null); }}
        title="تأكيد الحذف"
        description={singleDeleteId ? "هل أنت متأكد من حذف هذه الفاتورة؟" : `هل أنت متأكد من حذف ${selectedIds.length} فاتورة؟`}
        onConfirm={singleDeleteId ? executeSingleDelete : executeBulkDelete}
        confirmLabel="حذف"
      />

      <ConfirmDialog
        open={confirmSave}
        onOpenChange={setConfirmSave}
        title="تأكيد التحويل"
        description={`هل أنت متأكد من تحويل ${selectedIds.length} فاتورة إلى "يتم الحفظ"؟`}
        onConfirm={executeBulkSave}
        confirmLabel={bulkSaveMutation.isPending ? "جاري الاعتماد..." : "تحويل"}
        confirmClass="bg-green-600 hover:bg-green-700"
      />
    </div>
  );
}