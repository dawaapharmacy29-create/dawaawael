export async function loadAllEntityRows(entity, sort, maxRows = 20000) {
  const PAGE = 500;
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.list(sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

export async function loadAllEntityFiltered(entity, query, sort, maxRows = 20000) {
  const PAGE = 500;
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.filter(query, sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}
