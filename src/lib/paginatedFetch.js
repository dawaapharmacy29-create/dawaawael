/**
 * Fetches all records from an entity using parallel pagination for faster loading.
 * Instead of sequential while-loop (N requests one after another),
 * this fires multiple pages concurrently — reducing load time by ~4x.
 *
 * @param {Object} entity - base44 entity (e.g., base44.entities.PurchaseInvoice)
 * @param {Object} options - { sort, pageSize, maxPages, query }
 * @returns {Promise<Array>} All matching records
 */
export async function fetchAllParallel(entity, options = {}) {
  const { sort = "-created_date", pageSize = 1000, maxPages = 20, query = null } = options;

  const fetchPage = (skip) =>
    query
      ? entity.filter(query, sort, pageSize, skip)
      : entity.list(sort, pageSize, skip);

  // First request to determine scale
  const firstBatch = await fetchPage(0);
  if (firstBatch.length < pageSize) return firstBatch;

  const all = [...firstBatch];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore && currentPage < maxPages) {
    // Fire up to 5 pages in parallel
    const pagesToFetch = [];
    for (let i = 0; i < 5 && currentPage < maxPages; i++) {
      pagesToFetch.push(currentPage);
      currentPage++;
    }

    const results = await Promise.all(
      pagesToFetch.map((p) => fetchPage(p * pageSize))
    );

    for (const batch of results) {
      all.push(...batch);
      if (batch.length < pageSize) hasMore = false;
    }
  }

  return all;
}