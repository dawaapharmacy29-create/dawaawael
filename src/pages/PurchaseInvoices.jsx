import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import InvoiceStats from "@/components/invoices/InvoiceStats";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

export default function PurchaseInvoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [filterBranch, setFilterBranch] = useState("الكل");
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => base44.entities.PurchaseInvoice.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseInvoice.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }); setDialogOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseInvoice.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }); setDialogOpen(false); setEditingInvoice(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseInvoice.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }),
  });

  const handleSubmit = (formData) => {
    if (editingInvoice) updateMutation.mutate({ id: editingInvoice.id, data: formData });
    else createMutation.mutate(formData);
  };

  const filtered = filterBranch === "الكل" ? invoices : invoices.filter((i) => i.branch === filterBranch);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">فواتير الشراء</h1>
          <p className="text-gray-500 text-sm mt-0.5">{invoices.length} فاتورة إجمالية</p>
        </div>
        <Button onClick={() => { setEditingInvoice(null); setDialogOpen(true); }} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          <Plus className="w-4 h-4" /> إضافة فاتورة
        </Button>
      </div>

      <InvoiceStats invoices={invoices} />

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