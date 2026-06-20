import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import InvoiceViewDialog from "@/components/invoices/InvoiceViewDialog";
import ConfirmDialog from "@/components/invoices/ConfirmDialog";
import InvoiceStats from "@/components/invoices/InvoiceStats";
import { logActivity } from "@/lib/activityLogger";
import { useUserRole } from "@/lib/useUserRole";

const BRANCHES = ["دواء شكري", "دواء الشامي"];

export default function PurchaseInvoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [filterBranch, setFilterBranch] = useState("الكل");
  const [filterSupplier, setFilterSupplier] = useState("الكل");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_date");
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState(null);
  const [activeMonthOffset, setActiveMonthOffset] = useState(0); // 0 = الشهر الحالي، -1 = السابق، null = لا يوجد
  const queryClient = useQueryClient();

  // حساب أزرار الشهور: الشهر الحالي + الشهرين السابقين
  const monthButtons = Array.from({ length: 3 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth();
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label = d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
    return { offset: -i, from, to, label };
  });

  const selectMonth = (btn) => {
    if (activeMonthOffset === btn.offset) {
      // إلغاء الاختيار
      setActiveMonthOffset(null);
      setDateFrom("");
      setDateTo("");
    } else {
      setActiveMonthOffset(btn.offset);
      setDateFrom(btn.from);
      setDateTo(btn.to);
    }
  };
  const { canSaveInvoice, canDeleteInvoice } = useUserRole();

  // Real-time: تحديث تلقائي عند أي تغيير
  useEffect(() => {
    let timeout;
    const unsub = base44.entities.PurchaseInvoice.subscribe(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["pending-invoices-count"] });
      }, 800);
    });
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  // نحمل الكل مرة واحدة لكن مع keepPreviousData لمنع الوميض
  const { data: invoices = [], isLoading, isFetching } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: async () => {
      const PAGE = 500;
      let all = [];
      let page = 0;
      while (true) {
        const batch = await base44.entities.PurchaseInvoice.list("-created_date", PAGE, page * PAGE);
        all = [...all, ...batch];
        if (batch.length < PAGE) break;
        page++;
      }
      return all;
    },
    staleTime: 60000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const inv = await base44.entities.PurchaseInvoice.create(data);
      await logActivity({ action_type: "create", entity_type: "invoice", entity_id: inv?.id, entity_label: data.system_invoice_number, details: `إنشاء فاتورة ${data.system_invoice_number}` });
      return inv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      setDialogOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.PurchaseInvoice.update(id, data);
      await logActivity({ action_type: "update", entity_type: "invoice", entity_id: id, entity_label: data.system_invoice_number, details: `تعديل فاتورة ${data.system_invoice_number}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      setDialogOpen(false);
      setEditingInvoice(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const inv = invoices.find((i) => i.id === id);
      await logActivity({ action_type: "delete", entity_type: "invoice", entity_id: id, entity_label: inv?.system_invoice_number || id, details: `حذف فاتورة ${inv?.system_invoice_number || ""}` });
      await base44.entities.PurchaseInvoice.delete(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(["purchase-invoices"], (old = []) => old.filter((inv) => inv.id !== id));
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      setSelectedIds((prev) => prev.filter((s) => s !== id));
    },
  });

  const handleSubmit = (formData) => {
    if (editingInvoice) updateMutation.mutate({ id: editingInvoice.id, data: formData });
    else createMutation.mutate(formData);
  };

  // Bulk actions
  const executeBulkDelete = () => {
    selectedIds.forEach((id) => deleteMutation.mutate(id));
    setSelectedIds([]);
  };

  const executeSingleDelete = () => {
    if (singleDeleteId) deleteMutation.mutate(singleDeleteId);
    setSingleDeleteId(null);
  };

  const executeBulkSave = () => {
    selectedIds.forEach((id) => {
      const inv = invoices.find((i) => i.id === id);
      if (inv) updateMutation.mutate({ id, data: { ...inv, status: "يتم الحفظ" } });
    });
    setSelectedIds([]);
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

  const uniqueSuppliers = [...new Set(invoices.map((i) => i.supplier_name).filter(Boolean))];

  const filtered = invoices.filter((i) => {
    const branchMatch = filterBranch === "الكل" || i.branch === filterBranch;
    const supplierMatch = filterSupplier === "الكل" || i.supplier_name === filterSupplier;
    const searchMatch = !search || i.system_invoice_number?.includes(search) || i.supplier_name?.includes(search) || i.supplier_invoice_number?.includes(search);
    const dateKey = i.invoice_date || i.created_date?.split("T")[0];
    const fromMatch = !dateFrom || (dateKey && dateKey >= dateFrom);
    const toMatch = !dateTo || (dateKey && dateKey <= dateTo);
    return branchMatch && supplierMatch && searchMatch && fromMatch && toMatch;
  }).sort((a, b) => {
    if (sortBy === "total_value") return (b.total_value || 0) - (a.total_value || 0);
    if (sortBy === "system_invoice_number") return (b.system_invoice_number || "").localeCompare(a.system_invoice_number || "", "ar");
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const hasFilters = filterBranch !== "الكل" || filterSupplier !== "الكل" || search || dateFrom || dateTo;

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">فواتير الشراء</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} من {invoices.length} فاتورة</p>
        </div>
        {canSaveInvoice && (
          <Button onClick={() => { setEditingInvoice(null); setDialogOpen(true); }} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="w-4 h-4" /> إضافة فاتورة
          </Button>
        )}
      </div>

      <InvoiceStats invoices={invoices} />

      {/* Month Buttons */}
      <div className="flex gap-2 flex-wrap">
        {monthButtons.map((btn) => (
          <button
            key={btn.offset}
            onClick={() => selectMonth(btn)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeMonthOffset === btn.offset
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-teal-400"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="bg-white rounded-lg border p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="بحث برقم الفاتورة أو المورد..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 h-9" />
          </div>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="كل الموردين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="الكل">كل الموردين</SelectItem>
              {uniqueSuppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <span>من:</span><Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActiveMonthOffset(null); }} className="w-32 h-9" />
            <span>إلى:</span><Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActiveMonthOffset(null); }} className="w-32 h-9" />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="ترتيب حسب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_date">الأحدث أولاً</SelectItem>
              <SelectItem value="system_invoice_number">رقم البرنامج</SelectItem>
              <SelectItem value="total_value">أعلى قيمة</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); setFilterBranch("الكل"); setFilterSupplier("الكل"); setActiveMonthOffset(null); }} className="text-xs text-red-500 hover:underline whitespace-nowrap">
              مسح الكل
            </button>
          )}
        </div>

        {/* Branch Filter */}
        <div className="flex gap-2 flex-wrap">
          {["الكل", ...BRANCHES].map((b) => (
            <button key={b} onClick={() => setFilterBranch(b)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterBranch === b ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"}`}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-semibold text-teal-700">تم تحديد {selectedIds.length} فاتورة</span>
          <div className="flex gap-2 mr-auto">
            {canSaveInvoice && (
              <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50 gap-1.5" onClick={() => setConfirmSave(true)}>
                <CheckSquare className="w-3.5 h-3.5" /> تحويل إلى "يتم الحفظ"
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
        invoices={filtered}
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
        onSubmit={handleSubmit}
        invoice={editingInvoice}
        isLoading={createMutation.isPending || updateMutation.isPending}
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
        confirmLabel="تحويل"
        confirmClass="bg-green-600 hover:bg-green-700"
      />
    </div>
  );
}