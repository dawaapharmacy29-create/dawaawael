import { base44 } from "@/api/base44Client";

export async function updatePurchaseInvoiceSafe(id, updates) {
  const res = await base44.functions.invoke("updatePurchaseInvoiceSafe", { id, updates });
  const result = res?.data || {};
  if (!result.success) throw new Error(result.error || "تعذر تعديل الفاتورة بأمان");
  return result.record;
}
