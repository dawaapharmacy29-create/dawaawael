const PAYMENT_KEYS = {
  insta: ["انستا", "insta", "انستا باي", "instapay"],
  visa: ["فيزا", "visa", "بطاق", "كارت"],
  vodafone: ["فودافون", "vodafone", "فودافون كاش"],
};

const norm = (v) => String(v || "").trim().toLowerCase();
const money = (v) => Number(v) || 0;
const labelOf = (e) => `${e?.category || ""} ${e?.description || ""}`.trim();

export function paymentExpenseType(expense) {
  const label = norm(labelOf(expense));
  for (const [type, keys] of Object.entries(PAYMENT_KEYS)) {
    if (keys.some((k) => label.includes(norm(k)))) return type;
  }
  return null;
}

export function hasExplicitPaymentBreakdown(record) {
  return money(record?.payment_breakdown_total) > 0 || ["cash_sales","visa_sales","insta_sales","vodafone_sales","other_sales"].some((k) => money(record?.[k]) > 0);
}

export function shiftFinancialView(record) {
  const totalSales = money(record?.total_sales);
  const expenses = Array.isArray(record?.expenses) ? record.expenses : [];
  const explicit = hasExplicitPaymentBreakdown(record);

  let cash = money(record?.cash_sales);
  let visa = money(record?.visa_sales);
  let insta = money(record?.insta_sales);
  let vodafone = money(record?.vodafone_sales);
  let other = money(record?.other_sales);

  const legacyPayments = { visa: 0, insta: 0, vodafone: 0 };
  const realExpenses = [];
  for (const e of expenses) {
    const type = paymentExpenseType(e);
    if (!explicit && type) legacyPayments[type] += money(e.amount);
    else if (!type) realExpenses.push(e);
    // حتى في السجل الجديد، أي بند باسم وسيلة دفع لا يُعامل كمصروف حقيقي؛ يظهر كخطأ تصنيف بدل تضخيم المصروفات.
  }

  if (!explicit) {
    visa = legacyPayments.visa;
    insta = legacyPayments.insta;
    vodafone = legacyPayments.vodafone;
    const knownElectronic = visa + insta + vodafone;
    cash = Math.max(0, totalSales - knownElectronic);
    other = 0;
  }

  const paymentTotal = cash + visa + insta + vodafone + other;
  const expenseSources = realExpenses.reduce((acc, e) => {
    const source = ["cash","insta","vodafone","bank","other"].includes(e?.payment_source) ? e.payment_source : "cash";
    acc[source] += money(e.amount);
    return acc;
  }, { cash:0, insta:0, vodafone:0, bank:0, other:0 });
  const realExpenseTotal = realExpenses.reduce((s, e) => s + money(e.amount), 0);
  const expectedCash = Math.max(0, cash - expenseSources.cash);
  const actualCash = money(record?.cash_handover);
  const cashVariance = explicit ? money(record?.cash_variance) : 0;
  const operationalNet = totalSales - realExpenseTotal;
  const treasuryGross = paymentTotal;
  const treasuryNet = paymentTotal - realExpenseTotal;
  const channelNet = {
    cash: cash - expenseSources.cash,
    visa,
    insta: insta - expenseSources.insta,
    vodafone: vodafone - expenseSources.vodafone,
    other: other - expenseSources.other - expenseSources.bank,
  };

  return {
    legacy: !explicit,
    totalSales,
    payments: { cash, visa, insta, vodafone, other, total: paymentTotal },
    realExpenses,
    realExpenseTotal,
    expenseSources,
    expectedCash,
    actualCash,
    cashVariance,
    operationalNet,
    treasuryGross,
    treasuryNet,
    channelNet,
    electronicTotal: visa + insta + vodafone + other,
    electronicShare: totalSales > 0 ? ((visa + insta + vodafone + other) / totalSales) * 100 : 0,
    expenseRate: totalSales > 0 ? (realExpenseTotal / totalSales) * 100 : 0,
  };
}

export function aggregateShiftFinancials(records = []) {
  return records.reduce((acc, r) => {
    const f = shiftFinancialView(r);
    acc.sales += f.totalSales;
    acc.cash += f.payments.cash;
    acc.visa += f.payments.visa;
    acc.insta += f.payments.insta;
    acc.vodafone += f.payments.vodafone;
    acc.other += f.payments.other;
    acc.expenses += f.realExpenseTotal;
    acc.net += f.operationalNet;
    acc.expectedCash += f.expectedCash;
    acc.actualCash += f.actualCash;
    acc.cashVariance += f.cashVariance;
    acc.legacyCount += f.legacy ? 1 : 0;
    acc.count += 1;
    return acc;
  }, { sales:0,cash:0,visa:0,insta:0,vodafone:0,other:0,expenses:0,net:0,expectedCash:0,actualCash:0,cashVariance:0,legacyCount:0,count:0 });
}
