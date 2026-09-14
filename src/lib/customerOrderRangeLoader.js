function dedupeRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row?.id || `${row?.order_number || ""}|${row?.branch || ""}|${row?.request_date || row?.requested_at || row?.created_date || ""}`;
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
  try {
    return await loadPaged(entity, query, sort, maxRows);
  } catch {
    return [];
  }
}

export async function loadCustomerOrdersByBusinessDate(entity, {
  from,
  to,
  branches = null,
  sort = "-request_date",
  maxRows = 10000,
  includeLegacyFallback = true,
} = {}) {
  if (!from || !to) return [];
  const branchList = Array.isArray(branches) && branches.length ? [...new Set(branches.filter(Boolean))] : [null];
  const perBranchCap = Math.max(500, Math.ceil(maxRows / branchList.length));

  const groups = await Promise.all(branchList.map(async (branch) => {
    const branchFilter = branch ? { branch } : {};
    const primary = await loadPaged(entity, {
      ...branchFilter,
      request_date: { $gte: from, $lte: to },
    }, sort, perBranchCap);

    if (!includeLegacyFallback) return primary;

    // البيانات القديمة فقط: لا نكرر السجلات الحديثة التي لها request_date رسمي.
    const [missingEmptyByRequested, missingNullByRequested, missingEmptyByCreated, missingNullByCreated] = await Promise.all([
      safeLoad(entity, { ...branchFilter, request_date: "", requested_at: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` } }, "-requested_at", 2500),
      safeLoad(entity, { ...branchFilter, request_date: null, requested_at: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` } }, "-requested_at", 2500),
      safeLoad(entity, { ...branchFilter, request_date: "", requested_at: "", created_date: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` } }, "-created_date", 2500),
      safeLoad(entity, { ...branchFilter, request_date: null, requested_at: null, created_date: { $gte: `${from}T00:00:00`, $lte: `${to}T23:59:59` } }, "-created_date", 2500),
    ]);
    return dedupeRows([...primary, ...missingEmptyByRequested, ...missingNullByRequested, ...missingEmptyByCreated, ...missingNullByCreated]);
  }));

  return dedupeRows(groups.flat()).slice(0, maxRows);
}
