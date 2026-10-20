import { base44 } from "@/api/base44Client";

function extractError(err) {
  return err?.response?.data?.error
    || err?.data?.error
    || err?.error
    || err?.message
    || "تعذر تعديل الفاتورة بأمان";
}

export async function updatePurchaseInvoiceSafe(id, updates) {
  let result;
  try {
    const res = await base44.functions.invoke("updatePurchaseInvoiceSafe", { id, updates });
    result = res?.data || {};
  } catch (err) {
    // الدالة الخلفية ترفض التكرار برسالة عربية واضحة (409) — نعرضها كما هي.
    throw new Error(extractError(err));
  }
  if (!result.success) throw new Error(result.error || "تعذر تعديل الفاتورة بأمان");
  return result.record;
}