import { Loader2, Trash2, MessageSquare, ChevronLeft, ChevronRight, Phone, Clock3, Star, Search, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/invoices/ConfirmDialog";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortableHeader } from "@/components/table/SortableHeader";
import { SortControls } from "@/components/table/SortControls";
import { ORDER_STATUS_ORDER, PRIORITY_ORDER } from "@/lib/sortUtils";
import { getOrderAge, isOrderOverdue } from "./OrderOperationsBar";

const ORDER_SORT_COLUMNS = [
  { field: "order_number", label: "رقم الطلب", type: "text" },
  { field: "customer_name", label: "العميل", type: "text" },
  { field: "product_name", label: "الصنف", type: "text" },
  { field: "request_source", label: "المصدر", type: "text" },
  { field: "priority", label: "الأولوية", type: "status", statusMap: PRIORITY_ORDER },
  { field: "branch", label: "الفرع", type: "text" },
  { field: "assigned_employee", label: "الموظف", type: "text" },
  { field: "request_date", label: "التاريخ", type: "date" },
  { field: "status", label: "الحالة", type: "status", statusMap: ORDER_STATUS_ORDER },
  { field: "created_date", label: "وقت الإضافة", type: "date" },
];
import { useState, useMemo, useEffect } from "react";

const PAGE_SIZE = 30;

const STATUS_STYLE = {
  "طلب جديد":              "bg-blue-100 text-blue-700",
  "جاري البحث":            "bg-yellow-100 text-yellow-700",
  "تم الطلب":              "bg-indigo-100 text-indigo-700",
  "النواقص":               "bg-purple-100 text-purple-700",
  "تم توفير الصنف":        "bg-teal-100 text-teal-700",
  "تم التوصيل":            "bg-green-100 text-green-700",
  "تم توفير بديل":         "bg-cyan-100 text-cyan-700",
  "الصنف غير متوفر حاليا": "bg-orange-100 text-orange-700",
  "تم الإلغاء":            "bg-red-100 text-red-700",
};

const PRIORITY_STYLE = {
  "عاجل": "bg-red-100 text-red-700 border border-red-200",
  "متوسط": "bg-yellow-100 text-yellow-700 border border-yellow-200",
  "عادي": "bg-gray-100 text-gray-600",
};

const WHATSAPP_ICON = "https://media.base44.com/images/public/6a00735e63f2bcce7f4bb37e/174725006_WhatsApp_icon.png";

const SOURCE_ICONS = { "واتساب": null, "مكالمة هاتفية": "📞", "داخل الصيدلية": "🏪" };

function whatsappLink(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const international = digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
  return international ? `https://wa.me/${international}` : "";
}

function getQuickAction(status) {
  if (status === "طلب جديد") return { label: "بدء البحث", status: "جاري البحث", icon: Search, tone: "text-amber-700 bg-amber-50 hover:bg-amber-100" };
  if (["جاري البحث", "النواقص", "تم الطلب"].includes(status)) return { label: "تم التوفير", status: "تم توفير الصنف", icon: PackageCheck, tone: "text-teal-700 bg-teal-50 hover:bg-teal-100" };
  if (["تم توفير الصنف", "تم توفير بديل"].includes(status)) return { label: "تم التسليم", status: "تم التوصيل", icon: Truck, tone: "text-green-700 bg-green-50 hover:bg-green-100" };
  return null;
}

const SourceIcon = ({ source }) => {
  if (source === "واتساب") {
    return <img src={WHATSAPP_ICON} alt="واتساب" className="w-6 h-6 inline-block" />;
  }
  return <span>{SOURCE_ICONS[source] || "—"}</span>;
};

export default function OrderTable({ orders, isLoading, onSelect, onDelete, isManager, viewMode = "table", onQuickStatus, quickActionPending }) {
  const [confirmId, setConfirmId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { sortField, sortDirection, toggleSort, setSort, resetSort, sortData } = useTableSorting({
    columns: ORDER_SORT_COLUMNS,
    defaultSort: { field: "created_date", direction: "desc" },
    paramPrefix: "ord",
  });
  useEffect(() => { setCurrentPage(1); }, [sortField, sortDirection]);
  const sorted = useMemo(() => sortData(orders), [orders, sortData]);
  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const safePage = Math.min(currentPage, totalPages);
  const pageData = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage]
  );

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
    </div>
  );

  if (!orders.length) return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-4xl mb-2">📦</div>
      <p>لا توجد طلبات</p>
    </div>
  );

  return (
    <>
      {/* Desktop Table */}
      <div className={`${viewMode === "table" ? "hidden md:block" : "hidden"} bg-white rounded-xl border overflow-x-auto`}>
        <div className="flex items-center justify-end px-4 py-1.5 border-b bg-gray-50/50">
          <SortControls
            columns={ORDER_SORT_COLUMNS}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggle={toggleSort}
            onSet={setSort}
            onReset={resetSort}
          />
        </div>
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <SortableHeader field="order_number" label="رقم الطلب" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="customer_name" label="العميل" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="product_name" label="الصنف" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="request_source" label="المصدر" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="priority" label="الأولوية" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="branch" label="الفرع" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="assigned_employee" label="الموظف" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="request_date" label="التاريخ" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="created_date" label="وقت الإضافة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <SortableHeader field="status" label="الحالة" sortField={sortField} sortDirection={sortDirection} onToggle={toggleSort} className="px-4 py-3" />
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.map((o) => (
              <tr key={o.id} className={`${isOrderOverdue(o) ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-gray-50"} cursor-pointer`} onClick={() => onSelect(o)}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.order_number || o.id?.slice(-6)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 flex items-center gap-1">{o.customer_name}{o.customer_type === "مهم" && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">{o.phone}{o.customer_code && <span>· {o.customer_code}</span>}</div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span>{o.product_name}{Number(o.quantity || 1) > 1 && <strong className="text-teal-700"> ×{o.quantity}</strong>}</span>
                    {o.request_type && o.request_type !== "عادي" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{o.request_type}</span>}
                    {o.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" title={o.notes} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-lg"><SourceIcon source={o.request_source} /></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLE[o.priority] || ""}`}>{o.priority}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{o.branch}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{o.assigned_employee || "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{o.request_date || (o.created_date ? new Date(o.created_date).toLocaleDateString("ar-EG") : "—")}</td>
                <td className="px-4 py-3 text-xs text-gray-400 max-w-[60px] overflow-hidden">
                  <span
                    className="block truncate cursor-default"
                    title={o.created_date ? new Date(o.created_date).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  >
                    {o.created_date ? new Date(o.created_date).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                  <span className={`flex items-center gap-1 mt-0.5 ${isOrderOverdue(o) ? "text-red-600 font-semibold" : "text-gray-400"}`}><Clock3 className="w-3 h-3" />{getOrderAge(o)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[o.status] || "bg-gray-100 text-gray-600"}`}>{o.status}</span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {(() => { const action = getQuickAction(o.status); if (!action) return null; const ActionIcon = action.icon; return <button disabled={quickActionPending} onClick={() => onQuickStatus?.(o, action.status)} className={`h-7 px-2 rounded-md flex items-center gap-1 text-[10px] font-bold whitespace-nowrap ${action.tone}`} title={action.label}><ActionIcon className="w-3.5 h-3.5" />{action.label}</button>; })()}
                    {o.phone && <a href={whatsappLink(o.phone)} target="_blank" rel="noreferrer" className="h-7 w-7 rounded-md flex items-center justify-center text-green-600 hover:bg-green-50" title="فتح واتساب">●</a>}
                    {o.phone && <a href={`tel:${o.phone}`} className="h-7 w-7 rounded-md flex items-center justify-center text-sky-600 hover:bg-sky-50" title="اتصال"><Phone className="w-3.5 h-3.5" /></a>}
                  {isManager && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmId(o.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
            <span className="text-xs text-gray-500">
              عرض {(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, total)} من {total}
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-gray-600 font-medium px-2">{safePage} / {totalPages}</span>
              <Button size="sm" variant="outline" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Responsive Cards */}
      <div className={`${viewMode === "cards" ? "grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3" : "md:hidden space-y-3"}`}>
        {pageData.map((o) => (
          <div key={o.id} className={`group bg-white rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all min-w-0 ${isOrderOverdue(o) ? "border-red-200 ring-1 ring-red-100" : "border-gray-200 hover:border-teal-300"}`} onClick={() => onSelect(o)}>
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-bold text-gray-800 truncate flex items-center gap-1">{o.customer_name}{o.customer_type === "مهم" && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}</span><span className="font-mono text-[10px] text-gray-400 shrink-0">#{o.order_number || o.id?.slice(-6)}</span></div>
                <div className="text-xs text-gray-400">{o.phone}{o.customer_code ? ` · كود ${o.customer_code}` : ""}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${STATUS_STYLE[o.status] || ""}`}>{o.status}</span>
            </div>
            <div className="text-sm font-semibold text-teal-700 mb-2 flex items-center gap-1.5"><span className="line-clamp-2">🔹 {o.product_name}{Number(o.quantity || 1) > 1 ? ` ×${o.quantity}` : ""}</span>{o.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" title={o.notes} />}</div>
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><SourceIcon source={o.request_source} /> {o.request_source}</span>
              {o.branch && <span>📍 {o.branch}</span>}
              <span className={`px-1.5 py-0.5 rounded ${PRIORITY_STYLE[o.priority]}`}>{o.priority}</span>
            </div>
            <div className="mt-3 pt-2.5 border-t space-y-2 text-[11px] text-gray-400">
              <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5">{o.assigned_employee || "غير مسند"} · {o.request_date || (o.created_date ? new Date(o.created_date).toLocaleDateString("ar-EG") : "—")} · <span className={isOrderOverdue(o) ? "text-red-600 font-bold" : ""}>{getOrderAge(o)}</span></span>
              {isManager && <button className="p-1.5 rounded-md text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-red-50 transition" onClick={(e) => { e.stopPropagation(); setConfirmId(o.id); }} aria-label="إلغاء وأرشفة الطلب"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
              {(() => { const action = getQuickAction(o.status); if (!action) return null; const ActionIcon = action.icon; return <button disabled={quickActionPending} onClick={(e) => { e.stopPropagation(); onQuickStatus?.(o, action.status); }} className={`w-full h-8 rounded-lg flex items-center justify-center gap-1.5 font-bold ${action.tone}`}><ActionIcon className="w-3.5 h-3.5" />{action.label}</button>; })()}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination (mobile) */}
      {totalPages > 1 && (
        <div className={`${viewMode === "table" ? "md:hidden" : ""} flex items-center justify-between py-2`}>
          <span className="text-xs text-gray-500">{safePage * PAGE_SIZE > total ? total : safePage * PAGE_SIZE} من {total}</span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-gray-600 font-medium px-1">{safePage} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="إلغاء وأرشفة الطلب"
        description="سيتم إلغاء الطلب وحفظه في السجل ومزامنة الإلغاء مع تطبيق الإدارة، بدون حذف البيانات نهائيًا."
        onConfirm={() => { onDelete(confirmId); setConfirmId(null); }}
        confirmLabel="إلغاء وأرشفة"
      />
    </>
  );
}