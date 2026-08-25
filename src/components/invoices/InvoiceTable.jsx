import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Eye, MessageSquare, ChevronLeft, ChevronRight, ArrowRightLeft, Ban, AlertTriangle, Columns3 } from "lucide-react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/lib/useUserRole";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_SOURCE_LABELS,
  CATEGORY_SOURCE_COLORS,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_COLORS,
  NET_MODE_LABELS,
  NET_MODE_COLORS,
} from "@/lib/purchaseCalculations";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortableHeader } from "@/components/table/SortableHeader";
import { SortControls } from "@/components/table/SortControls";
import { TopScrollbar } from "@/components/table/TopScrollbar";
import { ColumnVisibilityToggle } from "@/components/table/ColumnVisibilityToggle";
import {
  INVOICE_STATUS_ORDER,
  PAYMENT_STATUS_ORDER,
  CATEGORY_ORDER,
  TRANSACTION_ORDER,
  NET_MODE_ORDER,
} from "@/lib/sortUtils";

const PAGE_SIZE = 50;
const INVOICE_COLUMNS_STORAGE_KEY = "dawaawael_invoice_hidden_columns_v1";

// قائمة الأعمدة المسموح بترتيبها (Allowlist)
const SORT_COLUMNS = [
  { field: "system_invoice_number", label: "رقم البرنامج", type: "number" },
  { field: "supplier_invoice_number", label: "رقم المورد", type: "text" },
  { field: "transfer_authorization_number", label: "رقم الإذن", type: "text" },
  { field: "supplier_name", label: "المورد", type: "text" },
  { field: "invoice_date", label: "التاريخ", type: "date" },
  { field: "branch", label: "الفرع", type: "text" },
  { field: "purchase_category", label: "التصنيف", type: "status", statusMap: CATEGORY_ORDER },
  { field: "transaction_type", label: "نوع العملية", type: "status", statusMap: TRANSACTION_ORDER },
  { field: "net_purchase_mode", label: "حالة الصافي", type: "status", statusMap: NET_MODE_ORDER },
  { field: "total_value", label: "القيمة", type: "currency" },
  { field: "returned_value", label: "المرتجع", type: "number" },
  { field: "remaining", label: "المتبقي", type: "number", getValue: (inv) => (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0) },
  { field: "payment_type", label: "الدفع", type: "status", statusMap: PAYMENT_STATUS_ORDER },
  { field: "status", label: "الحالة", type: "status", statusMap: INVOICE_STATUS_ORDER },
  { field: "created_date", label: "وقت الإضافة", type: "date" },
];

// أعمدة قابلة للإظهار/الإخفاء (ما عدا: الاختيار، التوسيع، رقم البرنامج، الإجراءات)
const TOGGLE_COLUMNS = [
  { key: "supplier_invoice_number", label: "رقم المورد" },
  { key: "transfer_authorization_number", label: "رقم الإذن" },
  { key: "supplier_name", label: "المورد" },
  { key: "invoice_date", label: "التاريخ" },
  { key: "branch", label: "الفرع" },
  { key: "purchase_category", label: "التصنيف" },
  { key: "transaction_type", label: "نوع العملية" },
  { key: "transfer_path", label: "مسار التحويل" },
  { key: "net_purchase_mode", label: "حالة الصافي" },
  { key: "total_value", label: "القيمة" },
  { key: "returned_value", label: "المرتجع" },
  { key: "remaining", label: "المتبقي" },
  { key: "payment_type", label: "الدفع" },
  { key: "status", label: "الحالة" },
  { key: "created_date", label: "وقت الإضافة" },
];

const statusColor = {
  "انتظار المراجعة": "bg-yellow-100 text-yellow-800",
  "يتم الحفظ": "bg-green-100 text-green-800",
  "تعلق تحت التصريف": "bg-blue-100 text-blue-800",
};
const statusIcon = { "انتظار المراجعة": "⏳", "يتم الحفظ": "✅", "تعلق تحت التصريف": "🔄" };
const paymentColor = {
  "كاش": "bg-emerald-100 text-emerald-800",
  "آجل": "bg-orange-100 text-orange-800",
  "مختلط": "bg-teal-100 text-teal-800",
  "انستا": "bg-pink-100 text-pink-800",
  "فودافون": "bg-red-100 text-red-800",
};
const branchColor = {
  "دواء شكري": "bg-blue-100 text-blue-800",
  "دواء الشامي": "bg-purple-100 text-purple-800",
};

export default function InvoiceTable({ invoices, isLoading, onEdit, onDelete, onView, selectedIds, onToggleSelect, onToggleAll }) {
  const { canSaveInvoice, canDeleteInvoice } = useUserRole();
  const [currentPage, setCurrentPage] = useState(1);
  const [hiddenCols, setHiddenCols] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = window.localStorage.getItem(INVOICE_COLUMNS_STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  });
  const { sortField, sortDirection, toggleSort, setSort, resetSort, sortData, isActive } = useTableSorting({
    columns: SORT_COLUMNS,
    defaultSort: { field: "created_date", direction: "desc" },
    paramPrefix: "inv",
  });

  const isCol = (key) => !hiddenCols[key];
  const toggleCol = (key) => setHiddenCols((p) => ({ ...p, [key]: !p[key] }));

  // نحفظ اختيار الأعمدة محليًا على نفس الجهاز حتى يظل ثابتًا بعد الريفرش أو إعادة فتح التطبيق.
  // هذا لا يغير أي بيانات فواتير ولا يؤثر على باقي المستخدمين أو منطق الحسابات.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(INVOICE_COLUMNS_STORAGE_KEY, JSON.stringify(hiddenCols));
    } catch {
      // لو التخزين المحلي غير متاح، يظل الجدول يعمل طبيعيًا بالحالة الحالية فقط.
    }
  }, [hiddenCols]);

  // إعادة الصفحة للأولى عند تغيير الترتيب
  useEffect(() => { setCurrentPage(1); }, [sortField, sortDirection]);

  // الترتيب يطبّق على كل البيانات المفلترة قبل التقسيم للصفحات
  const sorted = useMemo(() => sortData(invoices), [invoices, sortData]);
  const totalPages = Math.max(Math.ceil(sorted.length / PAGE_SIZE), 1);
  const safePage = Math.min(currentPage, totalPages);
  const pageData = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage]
  );

  // Reset to page 1 when filters change drastically
  const allSelected = pageData.length > 0 && pageData.every((inv) => selectedIds.includes(inv.id));

  if (isLoading) {
    return <Card className="p-8 text-center text-gray-400"><div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />جاري التحميل...</Card>;
  }
  if (invoices.length === 0) {
    return <Card className="p-12 text-center"><p className="text-gray-400 text-lg">لا توجد فواتير بعد</p></Card>;
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  return (
    <Card className="overflow-hidden min-w-0">
      {/* Sort controls + mobile menu */}
      <div className="flex items-center justify-end gap-2 px-2.5 py-1 border-b bg-gray-50/50">
        <ColumnVisibilityToggle columns={TOGGLE_COLUMNS} hiddenCols={hiddenCols} onToggle={toggleCol} />
        <SortControls
          columns={SORT_COLUMNS}
          sortField={sortField}
          sortDirection={sortDirection}
          onToggle={toggleSort}
          onSet={setSort}
          onReset={resetSort}
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <TopScrollbar>
          <table className="w-full caption-bottom text-[12px] xl:text-[13px] [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:h-9">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-10 text-center">
                  <Checkbox checked={allSelected} onCheckedChange={() => onToggleAll(!allSelected, pageData)} />
                </TableHead>
                <SortableHeader field="system_invoice_number" label="رقم البرنامج" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />
                {isCol("supplier_invoice_number") && <SortableHeader field="supplier_invoice_number" label="رقم المورد" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("transfer_authorization_number") && <SortableHeader field="transfer_authorization_number" label="رقم الإذن" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("supplier_name") && <SortableHeader field="supplier_name" label="المورد" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("invoice_date") && <SortableHeader field="invoice_date" label="التاريخ" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("branch") && <SortableHeader field="branch" label="الفرع" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("purchase_category") && <SortableHeader field="purchase_category" label="التصنيف" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("transaction_type") && <SortableHeader field="transaction_type" label="نوع العملية" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("transfer_path") && <TableHead className="text-right">مسار التحويل</TableHead>}
                {isCol("net_purchase_mode") && <SortableHeader field="net_purchase_mode" label="حالة الصافي" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("total_value") && <SortableHeader field="total_value" label="القيمة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("returned_value") && <SortableHeader field="returned_value" label="المرتجع" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("remaining") && <SortableHeader field="remaining" label="المتبقي" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("payment_type") && <SortableHeader field="payment_type" label="الدفع" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("status") && <SortableHeader field="status" label="الحالة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                {isCol("created_date") && <SortableHeader field="created_date" label="وقت الإضافة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} />}
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((inv) => {
                const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
                const isSelected = selectedIds.includes(inv.id);
                return (
                  <TableRow key={inv.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-teal-50" : ""}`}>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(inv.id)} />
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-teal-700 cursor-pointer hover:underline whitespace-nowrap" onClick={() => onView(inv)}>
                        <div className="flex items-center gap-1.5">
                          {inv.system_invoice_number}
                          {inv.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" title={inv.notes} />}
                        </div>
                      </TableCell>
                      {isCol("supplier_invoice_number") && <TableCell className="text-gray-600 whitespace-nowrap">{inv.supplier_invoice_number || "—"}</TableCell>}
                      {isCol("transfer_authorization_number") && <TableCell className="text-gray-600 whitespace-nowrap">{inv.transfer_authorization_number || "—"}</TableCell>}
                      {isCol("supplier_name") && <TableCell className="text-gray-700 max-w-[150px]"><span className="block truncate" title={inv.supplier_name || "—"}>{inv.supplier_name || "—"}</span></TableCell>}
                      {isCol("invoice_date") && (
                        <TableCell className="text-gray-600 text-sm max-w-[60px] overflow-hidden">
                          <span className="block truncate cursor-default" title={inv.invoice_date || "—"}>
                            {inv.invoice_date ? inv.invoice_date.slice(5) : "—"}
                          </span>
                        </TableCell>
                      )}
                      {isCol("branch") && (
                        <TableCell>
                          {inv.branch ? <Badge className={`${branchColor[inv.branch]} border-0 text-xs`}>{inv.branch}</Badge> : "—"}
                        </TableCell>
                      )}
                      {isCol("purchase_category") && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={`${CATEGORY_COLORS[inv.purchase_category || "unclassified"]} border-0 text-xs`}>
                              {CATEGORY_LABELS[inv.purchase_category || "unclassified"]}
                            </Badge>
                            {inv.purchase_category_source && inv.purchase_category_source !== "supplier_default" && (
                              <Badge className={`${CATEGORY_SOURCE_COLORS[inv.purchase_category_source] || "bg-gray-100 text-gray-600"} border-0 text-xs`} title={CATEGORY_SOURCE_LABELS[inv.purchase_category_source] || inv.purchase_category_source}>
                                {CATEGORY_SOURCE_LABELS[inv.purchase_category_source] || inv.purchase_category_source}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isCol("transaction_type") && (
                        <TableCell>
                          <Badge className={`${TRANSACTION_TYPE_COLORS[inv.transaction_type || "external_purchase"]} border-0 text-xs gap-0.5`}>
                            {(inv.transaction_type || "external_purchase") === "internal_transfer" && <ArrowRightLeft className="w-2.5 h-2.5" />}
                            {TRANSACTION_TYPE_LABELS[inv.transaction_type || "external_purchase"]}
                          </Badge>
                        </TableCell>
                      )}
                      {isCol("transfer_path") && (
                        <TableCell className="text-xs text-gray-600">
                          {inv.source_branch && inv.destination_branch ? (
                            <span className="flex items-center gap-1">
                              <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">{inv.source_branch}</Badge>
                              ←
                              <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">{inv.destination_branch}</Badge>
                            </span>
                          ) : inv.transaction_type === "internal_transfer" ? (
                            <Badge className="bg-red-50 text-red-600 border-0 text-xs gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> ناقص</Badge>
                          ) : "—"}
                        </TableCell>
                      )}
                      {isCol("net_purchase_mode") && (
                        <TableCell>
                          <Badge className={`${NET_MODE_COLORS[inv.net_purchase_mode || "inherit"]} border-0 text-xs`}>
                            {NET_MODE_LABELS[inv.net_purchase_mode || "inherit"]}
                          </Badge>
                        </TableCell>
                      )}
                      {isCol("total_value") && <TableCell className="font-semibold whitespace-nowrap">{(inv.total_value || 0).toLocaleString("ar-EG")}</TableCell>}
                      {isCol("returned_value") && <TableCell className="text-red-600 whitespace-nowrap">{inv.returned_value ? inv.returned_value.toLocaleString("ar-EG") : "—"}</TableCell>}
                      {isCol("remaining") && <TableCell className={`${remaining > 0 ? "text-orange-600 font-semibold" : "text-gray-500"} whitespace-nowrap`}>{remaining.toLocaleString("ar-EG")}</TableCell>}
                      {isCol("payment_type") && <TableCell><Badge className={`${paymentColor[inv.payment_type] || "bg-gray-100 text-gray-700"} border-0 text-xs`}>{inv.payment_type}</Badge></TableCell>}
                      {isCol("status") && <TableCell><Badge className={`${statusColor[inv.status]} border-0 text-xs`}>{statusIcon[inv.status]} {inv.status}</Badge></TableCell>}
                      {isCol("created_date") && (
                        <TableCell className="text-xs text-gray-400 max-w-[60px] overflow-hidden">
                          <span className="block truncate cursor-default" title={inv.created_date ? new Date(inv.created_date).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}>
                            {inv.created_date ? new Date(inv.created_date).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => onView(inv)} title="عرض"><Eye className="w-3.5 h-3.5" /></Button>
                          {canSaveInvoice && <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => onEdit(inv)} title="تعديل"><Pencil className="w-3.5 h-3.5" /></Button>}
                          {canDeleteInvoice && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => onDelete(inv.id)} title="حذف"><Trash2 className="w-3.5 h-3.5" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </table>
        </TopScrollbar>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {/* Select All (mobile) */}
        {pageData.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
            <Checkbox checked={allSelected} onCheckedChange={() => onToggleAll(!allSelected, pageData)} />
            <span className="text-xs text-gray-500">تحديد الكل في الصفحة</span>
          </div>
        )}
        {pageData.map((inv) => {
          const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
          const isSelected = selectedIds.includes(inv.id);
          return (
            <div key={inv.id} className={`p-3 ${isSelected ? "bg-teal-50" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(inv.id)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-teal-700 cursor-pointer hover:underline text-sm" onClick={() => onView(inv)}>{inv.system_invoice_number}</span>
                      {inv.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" title={inv.notes} />}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{inv.supplier_name || "—"}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => onView(inv)} title="عرض"><Eye className="w-3.5 h-3.5" /></Button>
                  {canSaveInvoice && <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => onEdit(inv)} title="تعديل"><Pencil className="w-3.5 h-3.5" /></Button>}
                  {canDeleteInvoice && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => onDelete(inv.id)} title="حذف"><Trash2 className="w-3.5 h-3.5" /></Button>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {inv.branch && <Badge className={`${branchColor[inv.branch]} border-0 text-xs`}>{inv.branch}</Badge>}
                <Badge className={`${CATEGORY_COLORS[inv.purchase_category || "unclassified"]} border-0 text-xs`}>
                  {CATEGORY_LABELS[inv.purchase_category || "unclassified"]}
                </Badge>
                {inv.purchase_category_source && inv.purchase_category_source !== "supplier_default" && (
                  <Badge className={`${CATEGORY_SOURCE_COLORS[inv.purchase_category_source] || "bg-gray-100 text-gray-600"} border-0 text-xs`}>
                    {CATEGORY_SOURCE_LABELS[inv.purchase_category_source] || inv.purchase_category_source}
                  </Badge>
                )}
                {(inv.transaction_type || "external_purchase") === "internal_transfer" && (
                  <Badge className="bg-purple-100 text-purple-800 border-0 text-xs gap-0.5">
                    <ArrowRightLeft className="w-2.5 h-2.5" /> تحويل
                  </Badge>
                )}
                {inv.net_purchase_mode === "exclude" && (
                  <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-0.5">
                    <Ban className="w-2.5 h-2.5" /> مستثناة
                  </Badge>
                )}
                <Badge className={`${paymentColor[inv.payment_type] || "bg-gray-100 text-gray-700"} border-0 text-xs`}>{inv.payment_type}</Badge>
                <Badge className={`${statusColor[inv.status]} border-0 text-xs`}>{statusIcon[inv.status]} {inv.status}</Badge>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-gray-500">{inv.invoice_date || "—"}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{(inv.total_value || 0).toLocaleString("ar-EG")} ج</span>
                  {remaining > 0 && <span className="text-orange-600 font-semibold">متبقي: {remaining.toLocaleString("ar-EG")}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
          <span className="text-xs text-gray-500">
            عرض {(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, invoices.length)} من {invoices.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={safePage <= 1} onClick={() => handlePageChange(safePage - 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-gray-600 font-medium px-2">
              {safePage} / {totalPages}
            </span>
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => handlePageChange(safePage + 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}