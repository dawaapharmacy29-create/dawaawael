import { useState, useMemo } from "react";
import { Building2, ChevronDown, Users, Receipt, TrendingUp } from "lucide-react";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const BRANCH_COLORS = { "دواء شكري": "#3b82f6", "دواء الشامي": "#a855f7" };

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

export default function BranchBreakdown({ invoices }) {
  const [expanded, setExpanded] = useState(null);

  const branchesData = useMemo(() => BRANCHES.map((branch) => {
    const list = invoices.filter((i) => i.branch === branch);
    const supplierMap = {};
    list.forEach((i) => {
      const name = i.supplier_name || "غير محدد";
      if (!supplierMap[name]) supplierMap[name] = { name, total: 0, count: 0 };
      supplierMap[name].total += i.total_value || 0;
      supplierMap[name].count += 1;
    });
    return {
      branch,
      total: list.reduce((s, i) => s + (i.total_value || 0), 0),
      count: list.length,
      color: BRANCH_COLORS[branch],
      suppliers: Object.values(supplierMap).sort((a, b) => b.total - a.total),
    };
  }), [invoices]);

  return (
    <div className="space-y-3">
      {branchesData.map((b) => (
        <div key={b.branch} className="rounded-xl border overflow-hidden bg-white">
          <button
            onClick={() => setExpanded(expanded === b.branch ? null : b.branch)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: b.color + "1a" }}>
                <Building2 className="w-5 h-5" style={{ color: b.color }} />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">{b.branch}</p>
                <p className="text-xs text-gray-500">{b.count} فاتورة · {b.suppliers.length} مورد</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold" style={{ color: b.color }}>{fmt(b.total)} ج.م</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded === b.branch ? "rotate-180" : ""}`} />
            </div>
          </button>

          {expanded === b.branch && (
            <div className="border-t bg-gray-50">
              {b.suppliers.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">لا يوجد موردين</p>
              ) : (
                <div className="divide-y">
                  {b.suppliers.map((s) => (
                    <div key={s.name} className="flex items-center justify-between p-3 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Receipt className="w-3 h-3" /> {s.count}
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold text-gray-800">
                          <TrendingUp className="w-3 h-3 text-teal-500" /> {fmt(s.total)} ج.م
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
