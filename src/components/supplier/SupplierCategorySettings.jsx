import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, AlertTriangle, FileText, CheckCircle, XCircle, Layers } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import {
  SUPPLIER_CATEGORY_MODE_LABELS,
  SUPPLIER_CATEGORY_MODE_COLORS,
  CATEGORY_LABELS,
} from "@/lib/purchaseCalculations";

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

const SCOPE_OPTIONS = [
  { value: "unclassified", label: "الفواتير غير المصنفة فقط" },
  { value: "all_non_manual", label: "كل الفواتير (عدا اليدوية)" },
  { value: "all", label: "كل الفواتير بما فيها اليدوية" },
  { value: "date_range", label: "نطاق تاريخ معين" },
];

export default function SupplierCategorySettings({ supplier }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scope, setScope] = useState("unclassified");
  const [skipManual, setSkipManual] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const mode = supplier?.default_purchase_category || "none";
  const isMixed = mode === "mixed" || mode === "none";
  const targetCategory = mode === "medicines" ? "medicines" : mode === "supplies_accessories" ? "supplies_accessories" : null;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["supplier-invoices-cat", supplier?.id],
    queryFn: () => base44.entities.PurchaseInvoice.filter({ supplier_id: supplier.id }),
    enabled: !!supplier?.id && !!previewOpen,
  });

  const stats = {
    total: invoices.length,
    totalValue: invoices.reduce((s, i) => s + (i.total_value || 0), 0),
    medicines: invoices.filter((i) => (i.purchase_category || "unclassified") === "medicines").length,
    supplies: invoices.filter((i) => i.purchase_category === "supplies_accessories").length,
    unclassified: invoices.filter((i) => !i.purchase_category || i.purchase_category === "unclassified").length,
    manual: invoices.filter((i) => i.purchase_category_source === "manual").length,
    matching: targetCategory ? invoices.filter((i) => (i.purchase_category || "unclassified") === targetCategory).length : 0,
    mismatching: targetCategory ? invoices.filter((i) => i.purchase_category && i.purchase_category !== targetCategory && i.purchase_category !== "unclassified").length : 0,
  };

  const previewInvoices = isMixed ? [] : invoices.filter((i) => {
    if (skipManual && scope !== "all" && i.purchase_category_source === "manual") return false;
    if (scope === "unclassified") return !i.purchase_category || i.purchase_category === "unclassified";
    if (scope === "all" || scope === "all_non_manual") return (i.purchase_category || "unclassified") !== targetCategory;
    if (scope === "date_range") {
      const d = i.invoice_date || "";
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return (i.purchase_category || "unclassified") !== targetCategory;
    }
    return false;
  });

  const previewValue = previewInvoices.reduce((s, i) => s + (i.total_value || 0), 0);
  const branches = [...new Set(previewInvoices.map((i) => i.branch).filter(Boolean))];
  const dates = previewInvoices.map((i) => i.invoice_date).filter(Boolean).sort();
  const oldestDate = dates[0] || "—";
  const newestDate = dates[dates.length - 1] || "—";

  const handleApply = async () => {
    setApplying(true);
    setResult(null);
    try {
      const ids = previewInvoices.map((i) => i.id);
      for (let start = 0; start < ids.length; start += 500) {
        const batch = ids.slice(start, start + 500);
        const updates = batch.map((id) => ({
          id,
          purchase_category: targetCategory,
          purchase_category_source: "supplier_bulk_apply",
        }));
        await base44.entities.PurchaseInvoice.bulkUpdate(updates);
      }
      logActivity({
        action_type: "bulk_update",
        entity_type: "supplier",
        entity_label: supplier.name,
        details: `تطبيق تصنيف ${CATEGORY_LABELS[targetCategory]} على ${ids.length} فاتورة بقيمة ${fmt(previewValue)} ج`,
      });
      setResult({ success: true, count: ids.length, value: previewValue });
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices-cat"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setApplying(false);
  };

  return (
    <div className="border rounded-lg p-3 bg-slate-50/50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">إعدادات تصنيف المورد</p>
        <Badge className={`${SUPPLIER_CATEGORY_MODE_COLORS[mode]} border-0 text-xs`}>
          {SUPPLIER_CATEGORY_MODE_LABELS[mode]}
        </Badge>
      </div>

      {isMixed && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">هذا المورد مختلط، لذلك لا يتم تطبيق تصنيف موحد تلقائيًا على كل الفواتير القديمة. يجب اختيار التصنيف يدويًا لكل فاتورة.</p>
        </div>
      )}

      {!isMixed && targetCategory && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
          onClick={() => { setPreviewOpen(true); setResult(null); }}
        >
          <Wand2 className="w-4 h-4" />
          تطبيق تصنيف المورد على الفواتير
        </Button>
      )}

      {/* Summary stats - shown when preview is open */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">تطبيق تصنيف المورد على الفواتير</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8 text-gray-400">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-2" />
              جاري تحميل الفواتير...
            </div>
          ) : (
            <div className="space-y-3">
              {/* Supplier info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">المورد:</span>
                  <span className="font-semibold">{supplier.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">تصنيف المورد:</span>
                  <Badge className={`${SUPPLIER_CATEGORY_MODE_COLORS[mode]} border-0 text-xs`}>{SUPPLIER_CATEGORY_MODE_LABELS[mode]}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">التصنيف المستهدف:</span>
                  <span className="font-semibold text-teal-700">{CATEGORY_LABELS[targetCategory]}</span>
                </div>
              </div>

              {/* Current stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatBox label="إجمالي الفواتير" value={stats.total} />
                <StatBox label="إجمالي القيمة" value={`${fmt(stats.totalValue)} ج`} />
                <StatBox label="مصنفة أدوية" value={stats.medicines} />
                <StatBox label="مصنفة مستلزمات" value={stats.supplies} />
                <StatBox label="غير مصنفة" value={stats.unclassified} highlight={stats.unclassified > 0} />
                <StatBox label="مصنفة يدويًا" value={stats.manual} />
                <StatBox label="موافقة للتصنيف" value={stats.matching} color="text-green-600" />
                <StatBox label="مخالفة للتصنيف" value={stats.mismatching} color="text-orange-600" />
              </div>

              {/* Will change */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold text-teal-800 flex items-center gap-1">
                  <Layers className="w-4 h-4" /> الفواتير التي ستتغير
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">العدد:</span> <span className="font-bold">{previewInvoices.length}</span></div>
                  <div><span className="text-gray-500">القيمة:</span> <span className="font-bold">{fmt(previewValue)} ج</span></div>
                  <div><span className="text-gray-500">الفروع:</span> <span className="text-xs">{branches.join("، ") || "—"}</span></div>
                  <div><span className="text-gray-500">أقدم:</span> <span className="text-xs">{oldestDate}</span></div>
                  <div><span className="text-gray-500">أحدث:</span> <span className="text-xs">{newestDate}</span></div>
                </div>
              </div>

              {/* Scope options */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">نطاق التطبيق:</p>
                {SCOPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="scope"
                      value={opt.value}
                      checked={scope === opt.value}
                      onChange={(e) => setScope(e.target.value)}
                      className="w-4 h-4 accent-teal-600"
                    />
                    {opt.label}
                  </label>
                ))}
                {scope === "date_range" && (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <label className="text-xs text-gray-500">من تاريخ</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2 py-1 text-sm border rounded-md" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">إلى تاريخ</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2 py-1 text-sm border rounded-md" />
                    </div>
                  </div>
                )}
              </div>

              {/* Manual handling */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">التعامل مع الفواتير المصنفة يدويًا:</p>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="manualHandling"
                    checked={skipManual}
                    onChange={() => setSkipManual(true)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  عدم تغيير الفواتير المصنفة يدويًا <span className="text-xs text-gray-400">(افتراضي)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="manualHandling"
                    checked={!skipManual}
                    onChange={() => setSkipManual(false)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  تغيير جميع الفواتير بما فيها اليدوية
                </label>
              </div>

              {/* Result */}
              {result?.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-700">تم تطبيق التصنيف على {result.count} فاتورة بقيمة {fmt(result.value)} ج بنجاح</p>
                </div>
              )}
              {result?.success === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-700">حدث خطأ: {result.error}</p>
                </div>
              )}

              <DialogFooter className="gap-2 flex-row-reverse">
                <Button
                  onClick={handleApply}
                  disabled={applying || previewInvoices.length === 0}
                  className="bg-teal-600 hover:bg-teal-700 gap-2"
                >
                  {applying ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري التطبيق...</>
                  ) : (
                    <><Wand2 className="w-4 h-4" /> تأكيد التطبيق ({previewInvoices.length})</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>إغلاق</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value, color = "", highlight = false }) {
  return (
    <div className={`rounded-md p-2 ${highlight ? "bg-amber-50 border border-amber-200" : "bg-white border border-gray-100"}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold ${color}`}>{value}</p>
    </div>
  );
}