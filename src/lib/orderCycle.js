function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentOrderCycle(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  const start = day >= 26
    ? new Date(year, month, 26)
    : new Date(year, month - 1, 26);
  const end = day >= 26
    ? new Date(year, month + 1, 25)
    : new Date(year, month, 25);

  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
    label: `${start.getDate()}/${start.getMonth() + 1} → ${end.getDate()}/${end.getMonth() + 1}`,
  };
}

export function getOrderDate(order) {
  if (order?.request_date) return order.request_date;
  if (order?.requested_at) return String(order.requested_at).slice(0, 10);
  if (order?.created_date) return String(order.created_date).slice(0, 10);
  return "";
}

export function isOrderInCycle(order, cycle = getCurrentOrderCycle()) {
  const date = getOrderDate(order);
  return Boolean(date && date >= cycle.start && date <= cycle.end);
}
