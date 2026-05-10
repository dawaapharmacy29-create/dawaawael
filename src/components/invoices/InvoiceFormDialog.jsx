import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const emptyForm = {
  system_invoice_number: "",
  supplier_invoice_number: "",
  total_value: "",
  returned_value: "",
  paid_value: "",
  payment_type: "",
  status: "انتظار المراجعة",
  notes: "",
};

export default function InvoiceFormDialog({ open, onOpenChange, onSubmit, invoice, isLoading }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (invoice) {
      setForm({
        system_invoice_number: invoice.system_invoice_number || "",
        supplier_invoice_number: invoice.supplier_invoice_number || "",
        total_value: invoice.total_value ?? "",
        returned_value: invoice.returned_value ?? "",
        paid_value: invoice.paid_value ?? "",
        payment_type: invoice.payment_type || "",
        status: invoice.status || "انتظار المراجعة",
        notes: invoice.notes || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [invoice, open]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const remaining = () => {
    const total = parseFloat(form.total_value) || 0;
    const ret = parseFloat(form.returned_value) || 0;
    const paid = parseFloat(form.paid_value) || 0;
    return (total - ret - paid).toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      total_value: parseFloat(form.total_value) || 0,
      returned_value: parseFloat(form.returned_value) || 0,
      paid_value: parseFloat(form.paid_value) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">
            {invoice ? "تعديل الفاتورة" : "إضافة فاتورة شراء"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>رقم الفاتورة على البرنامج *</Label>
              <Input
                value={form.system_invoice_number}
                onChange={(e) => set("system_invoice_number", e.target.value)}
                placeholder="مثال: INV-001"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>رقم الفاتورة من المخزن/الشركة</Label>
              <Input
                value={form.supplier_invoice_number}
                onChange={(e) => set("supplier_invoice_number", e.target.value)}
                placeholder="رقم فاتورة المورد"
              />
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>القيمة الإجمالية *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.total_value}
                onChange={(e) => set("total_value", e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>المرتجع</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.returned_value}
                onChange={(e) => set("returned_value", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>المدفوع</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.paid_value}
                onChange={(e) => set("paid_value", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>المتبقي</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-gray-50 text-sm font-semibold text-gray-700 flex items-center">
                {remaining()}
              </div>
            </div>
          </div>

          {/* Payment Type */}
          <div className="space-y-1">
            <Label>طريقة الدفع *</Label>
            <Select value={form.payment_type} onValueChange={(v) => set("payment_type", v)} required>
              <SelectTrigger>
                <SelectValue placeholder="اختر طريقة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="كاش">💵 كاش</SelectItem>
                <SelectItem value="آجل">📋 آجل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label>حالة الفاتورة *</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="انتظار المراجعة">⏳ انتظار المراجعة</SelectItem>
                <SelectItem value="يتم الحفظ">✅ يتم الحفظ</SelectItem>
                <SelectItem value="تعلق تحت التصريف">🔄 تعلق تحت التصريف</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>ملاحظات</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 flex-row-reverse">
            <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
              {isLoading ? "جاري الحفظ..." : invoice ? "تحديث" : "حفظ الفاتورة"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}