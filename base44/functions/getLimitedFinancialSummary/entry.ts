import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const BRANCHES = ['دواء شكري', 'دواء الشامي'];

function clean(v: unknown) { return String(v ?? '').trim(); }
function money(v: unknown) { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}`; }

function addMonths(year: number, month1: number, delta: number) {
  const d = new Date(Date.UTC(year, month1 - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function cycleFor(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (day >= 26) {
    const next = addMonths(year, month, 1);
    return { from: ymd(year, month, 26), to: ymd(next.year, next.month, 25) };
  }
  const prev = addMonths(year, month, -1);
  return { from: ymd(prev.year, prev.month, 26), to: ymd(year, month, 25) };
}

function dayBefore(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  x.setUTCDate(x.getUTCDate() - 1);
  return ymd(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

function cairoToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

async function loadAll(entity: any, query: any, sort = '-created_date', maxRows = 30000) {
  const PAGE = 500;
  const rows: any[] = [];
  for (let offset = 0; rows.length < maxRows; offset += PAGE) {
    const batch = await entity.filter(query, sort, PAGE, offset);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.slice(0, maxRows);
}

async function getEffectiveDirectoryAccess(base44: any, user: any) {
  const rows = await base44.asServiceRole.entities.ManagementLoginDirectory.filter({ is_active: true });
  const email = clean(user?.email).toLowerCase();
  const userId = clean(user?.id);
  const match = rows.find((r: any) =>
    clean(r.base44_user_id) === userId ||
    (clean(r.base44_email) && clean(r.base44_email).toLowerCase() === email)
  );
  if (!match) return { level: 'none', branches: [] as string[] };
  const level = clean(match.financial_access_level) || 'none';
  const branch = clean(match.branch);
  const branches = level === 'full' || branch === 'كل الفروع'
    ? BRANCHES
    : BRANCHES.includes(branch) ? [branch] : [];
  return { level, branches };
}

function invoiceNet(inv: any, suppliers: any[]) {
  if (['انتظار المراجعة', 'مرفوضة'].includes(clean(inv.status))) return 0;
  if (clean(inv.transaction_type) === 'internal_transfer') return 0;
  if (clean(inv.net_purchase_mode) === 'exclude') return 0;
  const gross = Math.max(0, money(inv.total_value) - money(inv.returned_value));
  if (clean(inv.net_purchase_mode) === 'include') return gross;
  const supplier = (inv.supplier_id && suppliers.find((s: any) => s.id === inv.supplier_id))
    || suppliers.find((s: any) => clean(s.name) === clean(inv.supplier_name));
  if (supplier?.exclude_from_net_purchases === true) return 0;
  return gross;
}

async function periodSummary(base44: any, period: { from: string; to: string }, branches: string[], suppliers: any[]) {
  let sales = 0;
  let purchases = 0;
  let shiftCount = 0;
  let invoiceCount = 0;

  for (const branch of branches) {
    const [shifts, invoices] = await Promise.all([
      loadAll(base44.asServiceRole.entities.ShiftDelivery, {
        branch,
        shift_date: { $gte: period.from, $lte: period.to },
      }, '-shift_date'),
      loadAll(base44.asServiceRole.entities.PurchaseInvoice, {
        branch,
        $or: [
          { invoice_date: { $gte: period.from, $lte: period.to } },
          { invoice_date: '' , created_date: { $gte: `${period.from}T00:00:00`, $lte: `${period.to}T23:59:59` } },
          { invoice_date: null, created_date: { $gte: `${period.from}T00:00:00`, $lte: `${period.to}T23:59:59` } },
        ],
      }, '-invoice_date'),
    ]);

    const activeShifts = shifts.filter((s: any) => s.is_archived !== true && s.status !== 'مراجعة');
    sales += activeShifts.reduce((sum: number, s: any) => sum + money(s.total_sales), 0);
    shiftCount += activeShifts.length;

    const inRangeInvoices = invoices.filter((inv: any) => {
      const date = clean(inv.invoice_date) || clean(inv.created_date).slice(0, 10);
      return date >= period.from && date <= period.to;
    });
    purchases += inRangeInvoices.reduce((sum: number, inv: any) => sum + invoiceNet(inv, suppliers), 0);
    invoiceCount += inRangeInvoices.filter((inv: any) => invoiceNet(inv, suppliers) > 0).length;
  }

  return { sales, purchases, shiftCount, invoiceCount };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const access = await getEffectiveDirectoryAccess(base44, user);
    const level = access.level;
    if (!['limited', 'full'].includes(level)) {
      return Response.json({ error: 'الحساب لا يملك صلاحية عرض الملخص المالي' }, { status: 403 });
    }

    const branches = access.branches;
    if (!branches.length) {
      return Response.json({ error: 'لم يتم تحديد نطاق الفروع المسموح به لهذا الحساب' }, { status: 403 });
    }

    const current = cycleFor(cairoToday());
    const previous = cycleFor(dayBefore(current.from));
    const suppliers = await loadAll(base44.asServiceRole.entities.Supplier, {}, 'name', 10000);
    const [currentSummary, previousSummary] = await Promise.all([
      periodSummary(base44, current, branches, suppliers),
      periodSummary(base44, previous, branches, suppliers),
    ]);

    return Response.json({
      success: true,
      scope: { branches },
      current: { period: current, ...currentSummary },
      previous: { period: previous, ...previousSummary },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر تحميل الملخص المالي' }, { status: 500 });
  }
}
