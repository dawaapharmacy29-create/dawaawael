import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColor = {
  "انتظار المراجعة": "bg-yellow-100 text-yellow-800",
  "يتم الحفظ": "bg-green-100 text-green-800",
  "تعلق تحت التصريف": "bg-blue-100 text-blue-800",
};
const statusIcon = { "انتظار المراجعة": "⏳", "يتم الحفظ": "✅", "تعلق تحت التصريف": "🔄" };
const paymentColor = { "كاش": "bg-emerald-100 text-emerald-800", "آجل": "bg-orange-100 text-orange-800", "انستا": "bg-pink-100 text-pink-800", "فودافون": "bg-red-100 text-red-800" };
const branchColor = {
  "فرع زكريا": "bg-blue-100 text-blue-800",
  "فرع بسيسة": "bg-purple-100 text-purple-800",
  "فرع المنشية": "bg-orange-100 text-orange-800",
};

export default function InvoiceViewDialog({ open, onOpenChange, invoice, onEdit }) {
  if (!invoice) return null;
  const remaining = (invoice.total_value || 0) - (invoice.returned_value || 0) - (invoice.paid_value || 0);

  const Row = ({ label, value, valueClass = "" }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value || "—"}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">تفاصيل الفاتورة</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <Row label="رقم الفاتورة (البرنامج)" value={<span className="font-mono text-teal-700">{invoice.system_invoice_number}</span>} />
          <Row label="رقم الفاتورة (المورد)" value={invoice.supplier_invoice_number} />
          <Row label="المورد" value={invoice.supplier_name} />
          <Row label="التاريخ" value={invoice.invoice_date} />
          <Row label="الفرع" value={invoice.branch ? <Badge className={`${branchColor[invoice.branch]} border-0`}>{invoice.branch}</Badge> : "—"} />
          <Row label="مدخل الفاتورة" value={invoice.entered_by} />
          <Row label="القيمة الإجمالية" value={`${(invoice.total_value || 0).toLocaleString("ar-EG")} ج`} valueClass="text-gray-800 text-base" />
          <Row label="المرتجع" value={invoice.returned_value ? `${invoice.returned_value.toLocaleString("ar-EG")} ج` : "—"} valueClass="text-red-600" />
          <Row label="المدفوع" value={invoice.paid_value ? `${invoice.paid_value.toLocaleString("ar-EG")} ج` : "—"} valueClass="text-green-600" />
          <Row label="المتبقي" value={`${remaining.toLocaleString("ar-EG")} ج`} valueClass={remaining > 0 ? "text-orange-600" : "text-gray-500"} />
          <Row label="طريقة الدفع" value={<Badge className={`${paymentColor[invoice.payment_type] || "bg-gray-100 text-gray-700"} border-0`}>{invoice.payment_type}</Badge>} />
          <Row label="الحالة" value={<Badge className={`${statusColor[invoice.status]} border-0`}>{statusIcon[invoice.status]} {invoice.status}</Badge>} />
          {invoice.notes && <Row label="ملاحظات" value={invoice.notes} />}
        </div>

        <div className="flex gap-2 justify-end mt-2">
          {onEdit && (
            <Button variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => { onOpenChange(false); onEdit(invoice); }}>
              تعديل
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}