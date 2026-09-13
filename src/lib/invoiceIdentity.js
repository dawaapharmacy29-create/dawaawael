export function normalizeInvoiceNumber(value) {
  return String(value || "").trim().replace(/[\s\-_.:*]+$/g, "");
}

export function getInvoiceOfficialDate(invoice) {
  return invoice?.invoice_date || null;
}

export function getInvoiceEffectiveDate(invoice) {
  return invoice?.invoice_date || invoice?.created_date?.slice(0, 10) || null;
}

export function getInvoiceCanonicalKey(invoice) {
  const number = normalizeInvoiceNumber(invoice?.system_invoice_number);
  const branch = String(invoice?.branch || "").trim();
  const date = getInvoiceEffectiveDate(invoice) || "";
  if (!number || !branch || !date) return null;
  return `${number}|${branch}|${date}`;
}

export function isSameCanonicalInvoice(a, b) {
  const aKey = getInvoiceCanonicalKey(a);
  const bKey = getInvoiceCanonicalKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}
