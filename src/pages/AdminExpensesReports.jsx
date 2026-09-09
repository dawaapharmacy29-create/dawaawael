import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Wallet, ShieldAlert, AlertCircle, Building2 } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { isShamiUnlocked } from "@/lib/shamiExpensesAccess";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const BRANCH_ACCENT = { "دواء شكري": "text-blue-700", "دواء الشامي": "text-purple-700" };
const MONTH_NAMES = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};
const monthLabel = (ym) => (ym ? `${MONTH_NAMES[ym.split("-")[1]]} ${ym.split("-")[0]}` : "");
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

/**
 * صفحة إجمالية للتقارير فقط: مقارنة مصروفات الفرعين شهرياً، بدون أي إضافة أو تعديل.
 * التسجيل والإدارة الفعلية تتم من صفحة كل فرع على حدة (المصروفات الإدارية — دواء شكري / دواء الشامي).
 */
export default function AdminExpensesReports() {
  const { isAdmin } = useUserRole();

  const { data: items = [] } = useQuery({ queryKey: ["admin-expense-items"], queryFn: () => base44.entities.AdminExpenseItem.list("sort_order") });
  const { data: records = [] } = useQuery({ queryKey: ["admin-expense-records"], queryFn: () => base44.entities.AdminExpenseRecord.list() });
  const { data: oneTimeExpenses = [] } = useQuery({ queryKey: ["admin-one-time-expenses"], queryFn: () => base44.entities.AdminOneTimeExpense.list("-month") });

  const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => monthsAgo(5 - i)), []);

  const branchMonthTotal = (branch, month) => {
    const branchItems = items.filter((i) => i.branch === branch && i.is_active !== false);
    const itemsTotal = branchItems.reduce((s, it) => {
      const rec = records.find((r) => r.branch === branch && r.item_id === it.id && r.month === month);
      return s + (rec?.amount || 0);
    }, 0);
    const oneTimeTotal = oneTimeExpenses.filter((e) => e.branch === branch && e.month === month).reduce((s, e) => s + (e.amount || 0), 0);
    return itemsTotal + oneTimeTotal;
  };

  const monthlyComparison = useMemo(
    () => last6Months.map((m) => {
      const perBranch = BRANCHES.map((b) => ({ branch: b, total: branchMonthTotal(b, m) }));
      return { month: m, perBranch, combined: perBranch.reduce((s, b) => s + b.total, 0) };
    }),
    [items, records, oneTimeExpenses, last6Months]
  );

  const currentMonth = monthsAgo(0);
  const currentMonthRow = monthlyComparison[monthlyComparison.length - 1];

  // أرقام فرع دواء الشامي تظهر فقط بعد فتح قفله بكلمة المرور (خلال نفس جلسة المتصفح)
  const shamiVisible = isShamiUnlocked();
  const fmtBranch = (branch, n) => (branch === "دواء الشامي" && !shamiVisible ? "•••" : fmt(n));
  const fmtCombined = (n) => (shamiVisible ? fmt(n) : "•••");

  const bigOneTimeExpenses = useMemo(
    () => oneTimeExpenses.filter((e) => (e.amount || 0) > 50000).sort((a, b) => b.month.localeCompare(a.month)),
    [oneTimeExpenses]
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4" dir="rtl">
        <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">هذه الصفحة مخصصة للمدير فقط</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-teal-600" /> تقارير المصروفات الإدارية — الإجمالي
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          مقارنة بين الفرعين فقط — للتسجيل والإضافة والتعديل ادخل صفحة الفرع المطلوب من قائمة "الحركة اليومية".
        </p>
        {!shamiVisible && (
          <p className="text-[11px] text-purple-600 font-medium mt-1">
            أرقام فرع دواء الشامي مخفية — تظهر بعد فتح صفحة "المصروفات الإدارية — دواء الشامي" بكلمة المرور.
          </p>
        )}
      </div>

      {/* إجمالي الشهر الحالي لكل فرع */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {currentMonthRow?.perBranch.map((b) => (
          <Card key={b.branch} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className={`w-4 h-4 ${BRANCH_ACCENT[b.branch]}`} />
              <p className={`text-sm font-semibold ${BRANCH_ACCENT[b.branch]}`}>{b.branch}</p>
            </div>
            <p className="text-2xl font-extrabold text-gray-800">{fmtBranch(b.branch, b.total)} <span className="text-sm font-normal text-gray-400">ج.م</span></p>
            <p className="text-xs text-gray-400 mt-1">مصروفات {monthLabel(currentMonth)}</p>
          </Card>
        ))}
        <Card className="p-4 bg-gradient-to-br from-teal-600 to-teal-700 text-white">
          <p className="text-sm font-semibold text-teal-100 mb-1">إجمالي الفرعين</p>
          <p className="text-2xl font-extrabold">{fmtCombined(currentMonthRow?.combined)} <span className="text-sm font-normal text-teal-100">ج.م</span></p>
          <p className="text-xs text-teal-100 mt-1">مصروفات {monthLabel(currentMonth)}</p>
        </Card>
      </div>

      {/* مقارنة آخر 6 أشهر */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <p className="font-semibold text-gray-700 text-sm">مقارنة المصروفات الإدارية — آخر 6 أشهر</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-2.5 text-right font-bold text-gray-600">الشهر</th>
                {BRANCHES.map((b) => (
                  <th key={b} className={`px-4 py-2.5 text-left font-bold ${BRANCH_ACCENT[b]}`}>{b}</th>
                ))}
                <th className="px-4 py-2.5 text-left font-extrabold text-teal-800 bg-teal-50">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthlyComparison.map((row) => (
                <tr key={row.month} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600">{monthLabel(row.month)}</td>
                  {row.perBranch.map((b) => (
                    <td key={b.branch} className="px-4 py-2.5 text-left font-medium text-gray-700">{fmtBranch(b.branch, b.total)}</td>
                  ))}
                  <td className="px-4 py-2.5 text-left font-bold text-teal-700 bg-teal-50/50">{fmtCombined(row.combined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* مصروفات كبيرة لمرة واحدة عبر الفرعين */}
      <div>
        <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-violet-600" /> مصروفات كبيرة لمرة واحدة عبر كل الفروع (أكبر من 50,000 ج.م)
        </h3>
        {bigOneTimeExpenses.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl text-sm">لا توجد مصروفات من نوع "مرة واحدة" بمبلغ أكبر من 50 ألف جنيه حتى الآن.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bigOneTimeExpenses.map((e) => (
              <div key={e.id} className="rounded-2xl p-4 border-2 border-violet-200 bg-violet-50/50">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-800 text-sm">{e.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.branch === "دواء شكري" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{e.branch}</span>
                </div>
                <p className="text-xl font-extrabold text-violet-700 mt-1">{e.branch === "دواء الشامي" && !shamiVisible ? "•••" : fmt(e.amount)} <span className="text-xs font-normal text-gray-400">ج.م</span></p>
                <p className="text-[11px] text-gray-400 mt-1">تم التسجيل في: {monthLabel(e.month)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}