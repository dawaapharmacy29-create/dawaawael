// منطق حساب مديونية الموردين — نسخة واحدة موحّدة تُستخدم في:
// - صفحة أرصدة كل فرع على حدة (BranchSupplierBalances)
// - صفحة الإجمالي (SupplierBalances) التي تعرض فقط إجمالي المديونية الحالية لكل مورد
//
// كانت هذه المنطقية مكررة حرفياً بين src/pages/SupplierBalances.jsx و
// src/pages/SupplierBalancesBranch.jsx (calcBranchData / supplierGroups) — تم توحيدها هنا.

export const BRANCHES = ["دواء شكري", "دواء الشامي"];

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function calcRemaining(inv) {
  return round2(Math.max(0, (inv.total_value || 0) - (inv.returned_value || 0) - (inv.paid_value || 0)));
}

function dateOf(inv) {
  return inv.invoice_date || inv.created_date?.slice(0, 10) || "";
}

/**
 * كل أسماء الموردين اللي ليهم فواتير آجل أو مديونية مسجّلة (عبر كل الفروع).
 */
export function getAllCreditSupplierNames({ invoices, debts }) {
  const names = new Set([
    ...invoices.filter((i) => i.payment_type === "آجل").map((i) => i.supplier_name),
    ...debts.map((d) => d.supplier_name),
  ]);
  return [...names].filter(Boolean);
}

/**
 * حساب مديونية مورد معيّن في فرع واحد فقط:
 * - يقسّم الفواتير الآجلة لـ"قديمة" و"جديدة" حسب تاريخ بداية الشهر المسجّل لهذا الفرع.
 * - يخصم الدفعات العامة (بدون رقم فاتورة) أولاً من المديونية القديمة المبدئية،
 *   ثم من الفواتير القديمة (الأقدم أولاً)، ثم من الفواتير الجديدة (الأقدم أولاً).
 */
export function calcSupplierBranchDebt({ invoices, payments, debts, monthStarts, supplierName, branch }) {
  const branchInvoices = invoices.filter(
    (inv) => inv.payment_type === "آجل" && inv.supplier_name === supplierName && inv.branch === branch
  );

  const debtRecord = debts.find((d) => d.supplier_name === supplierName && d.branch === branch);
  const initialDebt = debtRecord?.initial_debt || 0;

  const monthStartRecord = monthStarts.find((m) => m.supplier_name === supplierName && m.branch === branch);
  const monthStartDate = monthStartRecord?.month_start_date || null;

  const oldInvoicesRaw = monthStartDate
    ? branchInvoices.filter((inv) => dateOf(inv) < monthStartDate)
    : branchInvoices;
  const newInvoicesRaw = monthStartDate
    ? branchInvoices.filter((inv) => dateOf(inv) >= monthStartDate)
    : [];

  const oldInvoicesWithRemaining = oldInvoicesRaw.map((inv) => ({ ...inv, remaining: calcRemaining(inv) }));
  const newInvoicesWithRemaining = newInvoicesRaw.map((inv) => ({ ...inv, remaining: calcRemaining(inv) }));

  // الدفعات العامة لهذا الفرع فقط (بدون invoice_id)
  const generalPayments = payments.filter(
    (p) => p.supplier_name === supplierName && !p.invoice_id && (!p.branch || p.branch === branch)
  );
  let pool = round2(generalPayments.reduce((s, p) => s + (p.amount || 0), 0));

  const debtPaid = round2(Math.min(pool, initialDebt));
  const remainingInitialDebt = round2(Math.max(0, initialDebt - debtPaid));
  pool = Math.max(0, round2(pool - debtPaid));

  const byDateAsc = (a, b) => dateOf(a).localeCompare(dateOf(b));

  const oldSorted = [...oldInvoicesWithRemaining].sort(byDateAsc);
  const oldAdjusted = oldSorted.map((inv) => {
    const deduct = round2(Math.min(pool, inv.remaining));
    pool = Math.max(0, round2(pool - deduct));
    return { ...inv, remaining: round2(inv.remaining - deduct) };
  });

  const newSorted = [...newInvoicesWithRemaining].sort(byDateAsc);
  const newAdjusted = newSorted.map((inv) => {
    const deduct = round2(Math.min(pool, inv.remaining));
    pool = Math.max(0, round2(pool - deduct));
    return { ...inv, remaining: round2(inv.remaining - deduct) };
  });

  const oldInvoicesRemaining = round2(oldAdjusted.reduce((s, inv) => s + inv.remaining, 0));
  const newDebt = round2(newAdjusted.reduce((s, inv) => s + inv.remaining, 0));
  const oldDebt = round2(remainingInitialDebt + oldInvoicesRemaining);
  const totalNet = round2(oldDebt + newDebt);

  return {
    oldInvoices: oldAdjusted,
    newInvoices: newAdjusted,
    initialDebt,
    debtPaid,
    remainingInitialDebt,
    oldInvoicesRemaining,
    oldDebt,
    newDebt,
    totalNet,
    monthStartDate,
    debtRecord,
    monthStartRecord,
  };
}

/**
 * إجمالي مديونية مورد واحد عبر كل الفروع — تُستخدم في صفحة الإجمالي فقط
 * (اللي المفروض تعرض المديونية الحالية الإجمالية بدون أي تفاصيل فواتير/مدفوعات).
 */
export function calcSupplierTotalDebt({ invoices, payments, debts, monthStarts, supplierName, branches = BRANCHES }) {
  const perBranch = branches.map((branch) =>
    calcSupplierBranchDebt({ invoices, payments, debts, monthStarts, supplierName, branch })
  );
  const totalNet = round2(perBranch.reduce((s, r) => s + r.totalNet, 0));
  const oldDebt = round2(perBranch.reduce((s, r) => s + r.oldDebt, 0));
  const newDebt = round2(perBranch.reduce((s, r) => s + r.newDebt, 0));
  const invoiceCount = perBranch.reduce((s, r) => s + r.oldInvoices.length + r.newInvoices.length, 0);
  return { totalNet, oldDebt, newDebt, invoiceCount, perBranch };
}
