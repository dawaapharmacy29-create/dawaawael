import { loadAllEntityFiltered } from "@/lib/entityPagination";

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.id || `${row.branch || ""}|${row.system_invoice_number || ""}|${row.created_date || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function safeLoad(entity, query, sort, maxRows) {
  try {
    return await loadAllEntityFiltered(entity, query, sort, maxRows);
  } catch {
    return [];
  }
}

/**
 * تحميل الفواتير حسب التاريخ المالي الرسمي.
 * المسار الأساسي يستخدم invoice_date فقط (أسرع وأكثر دقة).
 * fallback صغير للسجلات القديمة التي لا تحتوي invoice_date ويستخدم created_date عندها فقط.
 */
export async function loadInvoicesByFinancialDate(entity, {
  from,
  to,
  extraFilter = {},
  sort = "-invoice_date",
  maxRows = 30000,
  includeMissingDateFallback = true,
}) {
  if (!from || !to) return [];

  const officialRows = await loadAllEntityFiltered(entity, {
    ...extraFilter,
    invoice_date: { $gte: from, $lte: to },
  }, sort, maxRows);

  if (!includeMissingDateFallback) return officialRows;

  const createdRange = { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` };
  const [emptyDateRows, nullDateRows] = await Promise.all([
    safeLoad(entity, { ...extraFilter, invoice_date: "", created_date: createdRange }, "-created_date", Math.min(maxRows, 5000)),
    safeLoad(entity, { ...extraFilter, invoice_date: null, created_date: createdRange }, "-created_date", Math.min(maxRows, 5000)),
  ]);

  return uniqueRows([...officialRows, ...emptyDateRows, ...nullDateRows]);
}
