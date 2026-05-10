import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

const statusColor = {
  "انتظار المراجعة": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "يتم الحفظ": "bg-green-100 text-green-800 border-green-200",
  "تعلق تحت التصريف": "bg-blue-100 text-blue-800 border-blue-200",
};

const statusIcon = {
  "انتظار المراجعة": "⏳",
  "يتم الحفظ": "✅",
  "تعلق تحت التصريف": "🔄",
};

const paymentColor = {
  "كاش": "bg-emerald-100 text-emerald-800",
  "آجل": "bg-orange-100 text-orange-800",
};

export default function InvoiceTable({ invoices, isLoading, onEdit, onDelete }) {
  if (isLoading) {
    return (
      <Card className="p-8 text-center text-gray-400">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
        جاري التحميل...
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-400 text-lg">لا توجد فواتير بعد</p>
        <p className="text-gray-300 text-sm mt-1">اضغط "إضافة فاتورة" لإنشاء أول فاتورة</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-right font-semibold text-gray-700">رقم البرنامج</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">رقم المورد</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">القيمة</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">المرتجع</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">المدفوع</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">المتبقي</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">الدفع</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">الحالة</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
              return (
                <TableRow key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-mono font-semibold text-teal-700">
                    {inv.system_invoice_number}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {inv.supplier_invoice_number || "—"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {(inv.total_value || 0).toLocaleString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-red-600">
                    {inv.returned_value ? inv.returned_value.toLocaleString("ar-EG") : "—"}
                  </TableCell>
                  <TableCell className="text-green-600">
                    {inv.paid_value ? inv.paid_value.toLocaleString("ar-EG") : "—"}
                  </TableCell>
                  <TableCell className={remaining > 0 ? "text-orange-600 font-semibold" : "text-gray-500"}>
                    {remaining.toLocaleString("ar-EG")}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${paymentColor[inv.payment_type]} border-0 text-xs`}>
                      {inv.payment_type === "كاش" ? "💵" : "📋"} {inv.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColor[inv.status]} border text-xs`}>
                      {statusIcon[inv.status]} {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                        onClick={() => onEdit(inv)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                        onClick={() => onDelete(inv.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}