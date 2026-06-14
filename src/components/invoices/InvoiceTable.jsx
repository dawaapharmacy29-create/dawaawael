import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Eye, MessageSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/lib/useUserRole";

const statusColor = {
  "انتظار المراجعة": "bg-yellow-100 text-yellow-800",
  "يتم الحفظ": "bg-green-100 text-green-800",
  "تعلق تحت التصريف": "bg-blue-100 text-blue-800",
};
const statusIcon = { "انتظار المراجعة": "⏳", "يتم الحفظ": "✅", "تعلق تحت التصريف": "🔄" };
const paymentColor = {
  "كاش": "bg-emerald-100 text-emerald-800",
  "آجل": "bg-orange-100 text-orange-800",
  "انستا": "bg-pink-100 text-pink-800",
  "فودافون": "bg-red-100 text-red-800",
};
const branchColor = {
  "دواء شكري": "bg-blue-100 text-blue-800",
  "دواء الشامي": "bg-purple-100 text-purple-800",
};

export default function InvoiceTable({ invoices, isLoading, onEdit, onDelete, onView, selectedIds, onToggleSelect, onToggleAll }) {
  const { canSaveInvoice, canDeleteInvoice } = useUserRole();

  if (isLoading) {
    return <Card className="p-8 text-center text-gray-400"><div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />جاري التحميل...</Card>;
  }
  if (invoices.length === 0) {
    return <Card className="p-12 text-center"><p className="text-gray-400 text-lg">لا توجد فواتير بعد</p></Card>;
  }

  const allSelected = invoices.length > 0 && invoices.every((inv) => selectedIds.includes(inv.id));

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10 text-center">
                <Checkbox checked={allSelected} onCheckedChange={() => onToggleAll(!allSelected, invoices)} />
              </TableHead>
              <TableHead className="text-right">رقم البرنامج</TableHead>
              <TableHead className="text-right">رقم المورد</TableHead>
              <TableHead className="text-right">المورد</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الفرع</TableHead>
              <TableHead className="text-right">القيمة</TableHead>
              <TableHead className="text-right">المرتجع</TableHead>
              <TableHead className="text-right">المتبقي</TableHead>
              <TableHead className="text-right">الدفع</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right text-xs text-gray-400">وقت الإضافة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
              const isSelected = selectedIds.includes(inv.id);
              return (
                <TableRow key={inv.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-teal-50" : ""}`}>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(inv.id)} />
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-teal-700 cursor-pointer hover:underline" onClick={() => onView(inv)}>
                    <div className="flex items-center gap-1.5">
                      {inv.system_invoice_number}
                      {inv.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" title={inv.notes} />}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{inv.supplier_invoice_number || "—"}</TableCell>
                  <TableCell className="text-gray-700">{inv.supplier_name || "—"}</TableCell>
                  <TableCell className="text-gray-600 text-sm">{inv.invoice_date || "—"}</TableCell>
                  <TableCell>
                    {inv.branch ? <Badge className={`${branchColor[inv.branch]} border-0 text-xs`}>{inv.branch}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="font-semibold">{(inv.total_value || 0).toLocaleString("ar-EG")}</TableCell>
                  <TableCell className="text-red-600">{inv.returned_value ? inv.returned_value.toLocaleString("ar-EG") : "—"}</TableCell>
                  <TableCell className={remaining > 0 ? "text-orange-600 font-semibold" : "text-gray-500"}>{remaining.toLocaleString("ar-EG")}</TableCell>
                  <TableCell><Badge className={`${paymentColor[inv.payment_type] || "bg-gray-100 text-gray-700"} border-0 text-xs`}>{inv.payment_type}</Badge></TableCell>
                  <TableCell><Badge className={`${statusColor[inv.status]} border-0 text-xs`}>{statusIcon[inv.status]} {inv.status}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-400 max-w-[60px] overflow-hidden">
                    <span className="block truncate cursor-default" title={inv.created_date ? new Date(inv.created_date).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}>
                      {inv.created_date ? new Date(inv.created_date).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => onView(inv)} title="عرض"><Eye className="w-3.5 h-3.5" /></Button>
                      {canSaveInvoice && <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => onEdit(inv)} title="تعديل"><Pencil className="w-3.5 h-3.5" /></Button>}
                      {canDeleteInvoice && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => onDelete(inv.id)} title="حذف"><Trash2 className="w-3.5 h-3.5" /></Button>}
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