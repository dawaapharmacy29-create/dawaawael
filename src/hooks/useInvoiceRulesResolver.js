import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Hook لربط نموذج الفاتورة بقواعد الموردين عبر resolveInvoiceSupplierRules.
 * يستدعي الدالة الخلفية عند تغيير supplier_id / branch / category_source.
 * يعيد: resolution (نتيجة الدالة)، isLoading، رسائل تحذير/معلومات.
 *
 * الحفاظ على الاستثناء اليدوي: preserve_manual_override=true دائمًا.
 */
export function useInvoiceRulesResolver({
  supplierId,
  branch,
  currentCategory,
  categorySource,
  currentTransactionType,
  enabled = true,
}) {
  const [resolution, setResolution] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastAppliedKey = useRef("");

  useEffect(() => {
    if (!enabled || !supplierId || !branch) {
      setResolution(null);
      return;
    }

    let cancelled = false;
    const requestKey = `${supplierId}|${branch}|${categorySource || ""}|${currentCategory || ""}`;
    // منع التكرار إذا لم تتغير القيم المفتاحية
    if (requestKey === lastAppliedKey.current) return;
    lastAppliedKey.current = requestKey;

    setIsLoading(true);

    base44.functions
      .invoke("resolveInvoiceSupplierRules", {
        supplier_id: supplierId,
        branch,
        current_purchase_category: currentCategory || "",
        purchase_category_source: categorySource || "",
        current_transaction_type: currentTransactionType || "external_purchase",
        preserve_manual_override: true,
      })
      .then((res) => {
        if (!cancelled) {
          setResolution(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolution(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, branch, categorySource, currentCategory, enabled]);

  return { resolution, isLoading };
}