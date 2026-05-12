import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import InvoiceStats from "@/components/invoices/InvoiceStats";
import { logActivity } from "@/lib/activityLogger";
import { useUserRole } from "@/lib/useUserRole";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

export default function PurchaseInvoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [filterBranch, setFilterBranch] = useState("الكل");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const queryClient = useQueryClient();
  const { isManager } = useUserRole();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => base44.entities.PurchaseInvoice.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseInvoice.create(data),
    onSuccess: (inv, data) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setDialogOpen(false);
      logActivity({ action_type: "create", entity_type: "invoice", entity_id: inv?.id, entity_label: data.system_invoice_number, details: `إنشاء فاتورة ${data.system_invoice_number}` });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseInvoice.update(id, data),
    onSuccess: (_, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setDialogOpen(false);
      setEditingInvoice(null);
      logActivity({ action_type: "update", entity_type: "invoice", entity_id: id, entity_label: data.system_invoice_number, details: `تعديل فاتورة ${data.system_invoice_number}` });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseInvoice.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      logActivity({ action_type: "delete", entity_type: "invoice", entity_id: id, entity_label: id, details: `حذف فاتورة` });
    },
  });

  const handleSubmit = (formData) => {
    if (editingInvoice) updateMutation.mutate({ id: editingInvoice.id, data: formData });
    else createMutation.mutate(formData);
  };

  const filtered = invoices.filter((i) => {
    const branchMatch = filterBranch === "الكل" || i.branch === filterBranch;
    const searchMatch = !search || i.system_invoice_number?.includes(search) || i.supplier_name?.includes(search) || i.supplier_invoice_number?.includes(search);
    const dateKey = i.invoice_date || i.created_date?.split("T")[0];
    const fromMatch = !dateFrom || (dateKey && dateKey >= dateFrom);
    const toMatch = !dateTo || (dateKey && dateKey <= dateTo);
    return branchMatch && searchMatch && fromMatch && toMatch;
  });

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">فواتير الشراء</h1>
          <p className="text-gray-500 text-sm mt-0.5">{invoices.length} فاتورة إجمالية</p>
        </div>
        {isManager && (
          <Button onClick={() => { setEditingInvoice(null); setDialogOpen(true); }} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="w-4 h-4" /> إضافة فاتورة
          </Button>
        )}
      </div>

      <InvoiceStats invoices={invoices} />

      {/* Search & Date Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input placeholder="بحث برقم الفاتورة أو المورد أو رقم فاتورة المورد..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>من:</span><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-9" />
          <span>إلى:</span><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-9" />
          {(dateFrom || dateTo || search) && <button onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); }} className="text-xs text-red-500 hover:underline">مسح</button>}
        </div>
      </div>

      {/* Branch Filter */}
      <div className="flex gap-2 flex-wrap">
        {["الكل", ...BRANCHES].map((b) => (
          <button key={b} onClick={() => setFilterBranch(b)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterBranch === b ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"}`}>
            {b}
          </button>
        ))}
      </div>

      <InvoiceTable
        invoices={filtered}
        isLoading={isLoading}
        onEdit={(inv) => { setEditingInvoice(inv); setDialogOpen(true); }}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <InvoiceFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingInvoice(null); }}
        onSubmit={handleSubmit}
        invoice={editingInvoice}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}