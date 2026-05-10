import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import InvoiceStats from "@/components/invoices/InvoiceStats";

export default function PurchaseInvoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => base44.entities.PurchaseInvoice.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseInvoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseInvoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setDialogOpen(false);
      setEditingInvoice(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseInvoice.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }),
  });

  const handleSubmit = (formData) => {
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };

  const handleOpenNew = () => {
    setEditingInvoice(null);
    setDialogOpen(true);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">فواتير الشراء</h1>
            <p className="text-sm text-gray-500 mt-0.5">صيدليات دواء - مشتريات</p>
          </div>
          <Button onClick={handleOpenNew} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            إضافة فاتورة
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <InvoiceStats invoices={invoices} />
        <InvoiceTable
          invoices={invoices}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      </div>

      <InvoiceFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        onSubmit={handleSubmit}
        invoice={editingInvoice}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}