import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Flame, PackageSearch, TrendingUp } from "lucide-react";
import { getOrderAge, isOrderOverdue, matchesOrderQueue } from "./OrderOperationsBar";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const COMPLETED = ["تم التوصيل", "تم توفير الصنف", "تم توفير بديل"];
const CLOSED = [...COMPLETED, "تم الإلغاء", "الصنف غير متوفر حاليا"];

function durationHours(order) {
  const start = new Date(order.requested_at || order.created_date || order.request_date || Date.now()).getTime();
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  const last = timeline.length ? new Date(timeline[timeline.length - 1]?.at || Date.now()).getTime() : new Date(order.updated_date || Date.now()).getTime();
  return Math.max(0, (last - start) / 3600000);
}

function topProduct(orders) {
  const counts = new Map();
  orders.forEach((order) => {
    const name = String(order.product_name || "").trim();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ["لا يوجد", 0];
}

function formatDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 24) return `${hours.toFixed(1)} ساعة`;
  return `${(hours / 24).toFixed(1)} يوم`;
}

export default function OrderBranchOverview({ orders, activeBranch, onBranchChange }) {
  const visibleBranches = BRANCHES.map((branch) => {
    const rows = orders.filter((order) => order.branch === branch);
    const active = rows.filter((order) => matchesOrderQueue(order, "active")).length;
    const urgent = rows.filter((order) => order.priority === "عاجل" && !CLOSED.includes(order.status)).length;
    const overdue = rows.filter(isOrderOverdue).length;
    const delivered = rows.filter((order) => order.status === "تم التوصيل").length;
    const completed = rows.filter((order) => COMPLETED.includes(order.status)).length;
    const terminal = rows.filter((order) => CLOSED.includes(order.status));
    const successRate = terminal.length ? Math.round((terminal.filter((order) => COMPLETED.includes(order.status)).length / terminal.length) * 100) : 0;
    const finishedDurations = terminal.map(durationHours).filter((value) => value > 0);
    const avgDuration = finishedDurations.length ? finishedDurations.reduce((sum, value) => sum + value, 0) / finishedDurations.length : 0;
    const [product, productCount] = topProduct(rows);
    const oldest = rows.filter((order) => matchesOrderQueue(order, "active")).sort((a, b) => durationHours(b) - durationHours(a))[0];
    return { branch, total: rows.length, active, urgent, overdue, delivered, completed, successRate, avgDuration, product, productCount, oldest };
  });

  const total = orders.length;
  const totalActive = orders.filter((order) => matchesOrderQueue(order, "active")).length;
  const totalOverdue = orders.filter(isOrderOverdue).length;
  const totalDelivered = orders.filter((order) => order.status === "تم التوصيل").length;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: "إجمالي الطلبات", value: total, icon: PackageSearch, tone: "text-slate-700 bg-slate-50 border-slate-200" },
          { label: "قيد التنفيذ الآن", value: totalActive, icon: TrendingUp, tone: "text-teal-700 bg-teal-50 border-teal-200" },
          { label: "تحتاج تدخل", value: totalOverdue, icon: AlertTriangle, tone: "text-red-700 bg-red-50 border-red-200" },
          { label: "تم تسليمها", value: totalDelivered, icon: CheckCircle2, tone: "text-green-700 bg-green-50 border-green-200" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`rounded-xl border p-3 flex items-center justify-between ${tone}`}>
            <div><div className="text-[11px] opacity-75">{label}</div><div className="text-2xl font-black mt-0.5">{value}</div></div>
            <Icon className="w-5 h-5 opacity-70" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {visibleBranches.map((item) => {
          const selected = activeBranch === item.branch;
          return (
            <button key={item.branch} onClick={() => onBranchChange(selected ? "all" : item.branch)} className={`text-right bg-white rounded-2xl border p-4 transition-all hover:shadow-md ${selected ? "border-teal-500 ring-2 ring-teal-100" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-black text-gray-900">{item.branch}</h3><span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{item.total} طلب</span></div>
                  <p className="text-[11px] text-gray-400 mt-1">اضغط لعرض طلبات الفرع فقط</p>
                </div>
                <div className="text-left"><div className="text-2xl font-black text-teal-700">{item.successRate}%</div><div className="text-[10px] text-gray-400">نسبة الإنجاز</div></div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-l from-teal-500 to-emerald-400 rounded-full" style={{ width: `${item.successRate}%` }} />
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <Metric label="نشط" value={item.active} tone="text-teal-700 bg-teal-50" />
                <Metric label="عاجل" value={item.urgent} tone="text-red-700 bg-red-50" icon={Flame} />
                <Metric label="متأخر" value={item.overdue} tone="text-amber-700 bg-amber-50" icon={AlertTriangle} />
                <Metric label="تم التسليم" value={item.delivered} tone="text-green-700 bg-green-50" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] border-t pt-3">
                <Info label="متوسط زمن الإغلاق" value={formatDuration(item.avgDuration)} icon={Clock3} />
                <Info label="الأكثر طلبًا" value={item.productCount ? `${item.product} (${item.productCount})` : "—"} icon={PackageSearch} />
                <Info label="أقدم طلب نشط" value={item.oldest ? `${getOrderAge(item.oldest)} · ${item.oldest.product_name}` : "لا يوجد"} icon={ArrowLeft} danger={item.oldest && isOrderOverdue(item.oldest)} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, tone, icon: Icon }) {
  return <div className={`rounded-lg px-2 py-2 text-center ${tone}`}><div className="flex justify-center items-center gap-1">{Icon && <Icon className="w-3 h-3" />}<strong className="text-lg leading-none">{value}</strong></div><div className="text-[10px] mt-1 opacity-75">{label}</div></div>;
}

function Info({ label, value, icon: Icon, danger }) {
  return <div className="flex items-start gap-2 min-w-0"><Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${danger ? "text-red-500" : "text-gray-400"}`} /><div className="min-w-0"><div className="text-gray-400">{label}</div><div className={`font-semibold truncate ${danger ? "text-red-600" : "text-gray-700"}`} title={value}>{value}</div></div></div>;
}
