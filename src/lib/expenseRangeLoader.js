function dedupeRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row?.id || `${row?.branch || ""}|${row?.date || row?.created_date || ""}|${row?.description || ""}|${row?.amount || 0}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadPaged(entity, query, sort, maxRows) {
  const PAGE = 500;
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.filter(query, sort, PAGE, offset);
    rows.push(...(Array.isArray(batch) ? batch : []));
    if (!Array.isArray(batch) || batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

async function safeLoad(entity, query, sort, maxRows) {
  try { return await loadPaged(entity, query, sort, maxRows); } catch { return []; }
}

export async function loadExpensesByBusinessDate(entity, {
  from,
  to,
  extraFilter = {},
  sort = "-date",
  maxRows = 10000,
  includeMissingDateFallback = true,
} = {}) {
  if (!from || !to) return [];
  const primary = await loadPaged(entity, {
    ...extraFilter,
    date: { $gte: from, $lte: to },
  }, sort, maxRows);

  if (!includeMissingDateFallback) return dedupeRows(primary);
  const fallbackCap = Math.min(5000, maxRows);
  const [emptyDate, nullDate] = await Promise.all([
    safeLoad(entity, {
      ...extraFilter,
      date: "",
      created_date: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` },
    }, "-created_date", fallbackCap),
    safeLoad(entity, {
      ...extraFilter,
      date: null,
      created_date: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` },
    }, "-created_date", fallbackCap),
  ]);
  return dedupeRows([...primary, ...emptyDate, ...nullDate]).slice(0, maxRows);
}
