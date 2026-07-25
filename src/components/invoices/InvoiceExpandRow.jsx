import React from "react";
import {
  CATEGORY_SOURCE_LABELS,
} from "@/lib/purchaseCalculations";

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 break-words">{value || "—"}</div>
    </div>
  );
}

/**
 * صف تفاصيل موسّع يظهر أسفل صف الفاتورة عند التوسيع.
 */
export function InvoiceExpandRow({ inv }) {
  const remaining = (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0);
  return (
    <tr className="bg-gray-50/70">
      <td colSpan={20} className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <Field label="رقم فاتورة المورد" value={inv.supplier_invoice_number} />
          <Field label="المُدخِل" value={inv.entered_by} />
          <Field label="تاريخ الإضافة" value={inv.created_date ? new Date(inv.created_date).toLocaleString("ar-EG") : null} />
          <Field label="المتبقي" value={`${remaining.toLocaleString("ar-EG")} ج`} />
          <Field label="مسار التحويل" value={inv.source_branch && inv.destination_branch ? `${inv.source_branch} ← ${inv.destination_branch}` : null} />
          <Field label="مصدر التصنيف" value={inv.purchase_category_source ? (CATEGORY_SOURCE_LABELS[inv.purchase_category_source] || inv.purchase_category_source) : null} />
          <Field label="مصدر نوع العملية" value={inv.transaction_type_source || null} />
          <Field label="سبب الاستثناء" value={inv.exclusion_reason || null} />
        </div>
        {inv.exclusion_note && (
          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">ملاحظة الاستثناء:</span> {inv.exclusion_note}
          </div>
        )}
        {inv.notes && (
          <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded p-2">
            <span className="font-medium">ملاحظات:</span> {inv.notes}
          </div>
        )}
      </td>
    </tr>
  );
}