import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

const emptyForm = {
  system_invoice_number: "",
  supplier_invoice_number: "",
  supplier_name: "",
  branch: "",
  entered_by: "",
  invoice_date: new Date().toISOString().split("T")[0],
  total_value: "",
  returned_value: "",
  payment_type: "",
  status: "انتظار المراجعة",
  notes: "",
};

export default function InvoiceFormDialog({ open, onOpenChange, onSubmit, invoice, isLoading, allInvoices = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [dupError, setDupError] = useState("");

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list() });
  const { data: teamMembers = [] } = useQuery({ queryKey: ["team-members"], queryFn: () => base44.entities.TeamMember.list("name") });
  const branchMembers = teamMembers.filter((m) => (m.branches || []).includes(form.branch));

  useEffect(() => {
    if (invoice) {
      setForm({
        system_invoice_number: invoice.system_invoice_number || "",
        supplier_invoice_number: invoice.supplier_invoice_number || "",
        supplier_name: invoice.supplier_name || "",
        branch: invoice.branch || "",
        entered_by: invoice.entered_by || "",
        invoice_date: invoice.invoice_date || new Date().toISOString().split("T")[0],
        total_value: invoice.total_value !== undefined ? invoice.total_value : "",
        returned_value: invoice.returned_value !== undefined ? invoice.returned_value : "",
        payment_type: invoice.payment_type || "",
        status: invoice.status || "انتظار المراجعة",
        notes: invoice.notes || "",
      });
    } else {
      setForm(emptyForm);
    }
    setDupError("");
  }, [invoice, open]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // When supplier changes, auto-fill payment_type from supplier's payment_type
  const handleSupplierChange = (supplierName) => {
    set("supplier_name", supplierName);
    const supplier = suppliers.find((s) => s.name === supplierName);
    if (supplier?.payment_type) {
      set("payment_type", supplier.payment_type);
    }
  };

  const remaining = () => {
    const total = parseFloat(form.total_value) || 0;
    const ret = parseFloat(form.returned_value) || 0;
    return (total - ret).toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.branch) {
      setDupError("يجب اختيار الفرع");
      return;
    }
    // Check duplicate system_invoice_number per branch
    const isDuplicate = allInvoices.some(
      (inv) =>
        inv.branch === form.branch &&
        inv.system_invoice_number === form.system_invoice_number &&
        (!invoice || inv.id !== invoice.id)
    );
    if (isDuplicate) {
      setDupError(`رقم الفاتورة "${form.system_invoice_number}" موجود بالفعل في ${form.branch}`);
      return;
    }
    setDupError("");
    const totalVal = parseFloat(form.total_value) || 0;
    const returnedVal = parseFloat(form.returned_value) || 0;
    const isCash = ["كاش", "انستا", "فودافون"].includes(form.payment_type);
    onSubmit({
      ...form,
      total_value: totalVal,
      returned_value: returnedVal,
      paid_value: isCash ? totalVal - returnedVal : 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-base font-bold">
            {invoice ? "تعديل الفاتورة" : "إضافة فاتورة شراء"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Invoice Numbers */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">رقم الفاتورة على البرنامج *</Label>
              <Input value={form.system_invoice_number} onChange={(e) => set("system_invoice_number", e.target.value)} placeholder="INV-001" required className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">رقم الفاتورة من المورد</Label>
              <Input value={form.supplier_invoice_number} onChange={(e) => set("supplier_invoice_number", e.target.value)} placeholder="رقم المورد" className="h-8 text-sm" />
            </div>
          </div>

          {/* Supplier & Branch */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">المورد</Label>
              <Select value={form.supplier_name} onValueChange={handleSupplierChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الفرع *</Label>
              <Select value={form.branch} onValueChange={(v) => { set("branch", v); setDupError(""); }} required>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">تاريخ الفاتورة</Label>
              <Input type="date" value={form.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} className="h-8 text-sm" />
            </div>
            {/* Entered By */}
            {form.branch && (
              <div className="space-y-1">
                <Label className="text-xs">مدخل الفاتورة</Label>
                <Select value={form.entered_by} onValueChange={(v) => set("entered_by", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {branchMembers.length === 0 ? (
                      <SelectItem value="_none" disabled>لا يوجد عاملين</SelectItem>
                    ) : (
                      branchMembers.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Values */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">الإجمالي *</Label>
              <Input type="number" step="0.01" min="0" value={form.total_value} onChange={(e) => set("total_value", e.target.value)} placeholder="0.00" required className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المرتجع</Label>
              <Input type="number" step="0.01" min="0" value={form.returned_value} onChange={(e) => set("returned_value", e.target.value)} placeholder="0.00" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المتبقي</Label>
              <div className="h-8 px-3 rounded-md border bg-gray-50 text-sm font-semibold text-gray-700 flex items-center">
                {remaining()}
              </div>
            </div>
          </div>

          {/* Payment & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">طريقة الدفع *</Label>
              <Select value={form.payment_type} onValueChange={(v) => set("payment_type", v)} required>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="كاش">💵 كاش</SelectItem>
                  <SelectItem value="آجل">📋 آجل</SelectItem>
                  <SelectItem value="انستا">📱 انستا</SelectItem>
                  <SelectItem value="فودافون">📱 فودافون</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">حالة الفاتورة</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="انتظار المراجعة">⏳ انتظار المراجعة</SelectItem>
                  <SelectItem value="يتم الحفظ">✅ يتم الحفظ</SelectItem>
                  <SelectItem value="تعلق تحت التصريف">🔄 تعلق تحت التصريف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="text-sm" />
          </div>

          {dupError && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-md">{dupError}</p>}

          <DialogFooter className="gap-2 flex-row-reverse">
            <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
              {isLoading ? "جاري الحفظ..." : invoice ? "تحديث" : "حفظ الفاتورة"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}