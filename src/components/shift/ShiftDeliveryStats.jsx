import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, BarChart3, Repeat, Building2, Sun, Moon, MoonStar } from "lucide-react";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const BRANCH_COLORS = { "دواء شكري": "teal", "دواء الشامي": "orange" };
const SHIFT_TYPES = [
  { key: "صباحي", label: "الصباحي", icon: Sun, color: "text-amber-500" },
  { key: "مسائي", label: "المسائي", icon: Moon, color: "text-blue-500" },
  { key: "ليلي", label: "الليلي", icon: MoonStar, color: "text-indigo-500" },
];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIODS = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "day_before", label: "أول أمس" },
  { key: "this_month", label: "الشهر الحالي" },
  { key: "last_month", label: "الشهر السابق" },
];

function periodRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "today":
      return { from: fmtDate(today), to: fmtDate(today) };
    case "yesterday": {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      return { from: fmtDate(d), to: fmtDate(d) };
    }
    case "day_before": {
      const d = new Date(today); d.setDate(d.getDate() - 2);
      return { from: fmtDate(d), to: fmtDate(d) };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: fmtDate(first), to: fmtDate(last) };
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmtDate(first), to: fmtDate(last) };
    }
    default:
      return { from: "", to: "" };
  }
}

function distinctDayCount(arr) {
  const days = new Set(arr.map((r) => r.shift_date).filter(Boolean));
  return days.size || 1;
}

function StatCard({ label, value, icon: Icon, color, isCount }) {
  const colorMap = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  const iconColorMap = {
    green: "text-green-600", red: "text-red-600", blue: "text-blue-600",
    indigo: "text-indigo-600", amber: "text-amber-600", teal: "text-teal-600",
    orange: "text-orange-600",
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
      </div>
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-lg font-bold">
        {isCount ? value : `${Number(value).toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م`}
      </p>
    </div>
  );
}

export default function ShiftDeliveryStats({ deliveries }) {
  const [period, setPeriod] = useState("this_month");

  const { from, to } = useMemo(() => periodRange(period), [period]);

  const filtered = useMemo(() => {
    return (deliveries || []).filter((r) => {
      if (r.is_archived === true || r.status === "مراجعة") return false;
      const d = r.shift_date;
      if (!d) return false;
      return d >= from && d <= to;
    });
  }, [deliveries, from, to]);

  const recordedDays = useMemo(() => distinctDayCount(filtered), [filtered]);

  const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  const overall = useMemo(() => {
    const totalSales = sum(filtered, "total_sales");
    const totalExpenses = sum(filtered, "total_expenses");
    const netAmount = sum(filtered, "net_amount");
    const shiftCount = filtered.length;
    return {
      totalSales,
      totalExpenses,
      netAmount,
      shiftCount,
      avgShift: shiftCount > 0 ? netAmount / shiftCount : 0,
      avgDailySales: totalSales / recordedDays,
      avgDailyExpenses: totalExpenses / recordedDays,
    };
  }, [filtered, recordedDays]);

  const branchAverages = useMemo(() =>
    BRANCHES.map((b) => {
      const recs = filtered.filter((r) => r.branch === b);
      const totalSales = sum(recs, "total_sales");
      const totalExpenses = sum(recs, "total_expenses");
      const branchDays = distinctDayCount(recs);
      return {
        branch: b,
        avgDailySales: recs.length > 0 ? totalSales / branchDays : 0,
        avgDailyExpenses: recs.length > 0 ? totalExpenses / branchDays : 0,
      };
    })
  , [filtered]);

  // إجمالي مبيعات كل فرع في الشهر الحالي دائماً بغض النظر عن الفترة المختارة
  const currentMonthBranchTotals = useMemo(() => {
    const { from: cmFrom, to: cmTo } = periodRange("this_month");
    const cmRecords = (deliveries || []).filter((r) => r.is_archived !== true && r.status !== "مراجعة" && r.shift_date && r.shift_date >= cmFrom && r.shift_date <= cmTo);
    return BRANCHES.map((b) => ({
      branch: b,
      totalSales: sum(cmRecords.filter((r) => r.branch === b), "total_sales"),
    }));
  }, [deliveries]);

  const branchStats = useMemo(() =>
    BRANCHES.map((b) => {
      const recs = filtered.filter((r) => r.branch === b);
      const sales = sum(recs, "total_sales");
      const expenses = sum(recs, "total_expenses");
      const net = sum(recs, "net_amount");
      const count = recs.length;
      const shiftAverages = SHIFT_TYPES.map((st) => {
        const stRecs = recs.filter((r) => r.shift_type === st.key);
        const stSales = sum(stRecs, "total_sales");
        return { ...st, count: stRecs.length, avg: stRecs.length > 0 ? stSales / stRecs.length : 0 };
      });
      return { branch: b, sales, expenses, net, count, avg: count > 0 ? sales / count : 0, shiftAverages };
    })
  , [filtered]);

  return (
    <div className="space-y-8" dir="rtl">
      {/* شريط اختيار الفترة */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800">لوحة الإحصائيات والفروع</h2>
        <div className="flex gap-1.5 flex-wrap bg-gray-100 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                period === p.key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── الإحصائيات العامة ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-3">الإحصائيات العامة</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="إجمالي المبيعات" value={overall.totalSales} icon={TrendingUp} color="green" />
          <StatCard label="إجمالي المصروفات" value={overall.totalExpenses} icon={TrendingDown} color="red" />
          <StatCard label="صافي الفترة" value={overall.netAmount} icon={Wallet} color="blue" />
          <StatCard label="عدد الشفتات" value={overall.shiftCount} icon={Repeat} color="indigo" isCount />
          <StatCard label="متوسط الشفت" value={overall.avgShift} icon={BarChart3} color="amber" />
          <StatCard label="متوسط المبيعات اليومي" value={overall.avgDailySales} icon={TrendingUp} color="teal" />
        </div>
      </div>

      {/* ── إجمالي مبيعات كل فرع (الشهر الحالي) ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-3">إجمالي مبيعات كل فرع (الشهر الحالي)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {currentMonthBranchTotals.map((b) => (
            <StatCard key={b.branch} label={b.branch} value={b.totalSales} icon={Building2} color={BRANCH_COLORS[b.branch]} />
          ))}
        </div>
      </div>

      {/* ── متوسط المبيعات اليومي ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-3">متوسط المبيعات اليومي</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="إجمالي كل الفروع" value={overall.avgDailySales} icon={BarChart3} color="teal" />
          {branchAverages.map((b) => (
            <StatCard key={b.branch} label={b.branch} value={b.avgDailySales} icon={Building2} color={BRANCH_COLORS[b.branch]} />
          ))}
        </div>
      </div>

      {/* ── متوسط المصروف اليومي ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-3">متوسط المصروف اليومي</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="إجمالي كل الفروع" value={overall.avgDailyExpenses} icon={BarChart3} color="amber" />
          {branchAverages.map((b) => (
            <StatCard key={b.branch} label={b.branch} value={b.avgDailyExpenses} icon={Building2} color="red" />
          ))}
        </div>
      </div>

      {/* ── تقارير الفروع ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-3">تقارير الفروع</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {branchStats.map((s) => (
            <div key={s.branch} className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">{s.branch}</h3>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">المبيعات</span><span className="font-medium">{s.sales.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م</span></div>
                <div className="flex justify-between"><span className="text-gray-500">المصروفات</span><span className="font-medium text-red-600">{s.expenses.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م</span></div>
                <div className="flex justify-between border-t pt-1.5"><span className="font-bold">الصافي</span><span className="font-bold text-green-600">{s.net.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م</span></div>
                <div className="flex justify-between"><span className="text-gray-500">الشفتات</span><span className="font-medium">{s.count}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">متوسط الشفت</span><span className="font-medium">{s.avg.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م</span></div>
              </div>

              <div className="mt-3 pt-3 border-t space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 mb-1.5">متوسط كل نوع شفت</p>
                {s.shiftAverages.map((st) => (
                  <div key={st.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <st.icon className={`w-3.5 h-3.5 ${st.color}`} /> {st.label}
                      {st.count > 0 && <span className="text-[10px] text-gray-400">({st.count})</span>}
                    </span>
                    <span className="font-medium">
                      {st.count > 0 ? `${st.avg.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
