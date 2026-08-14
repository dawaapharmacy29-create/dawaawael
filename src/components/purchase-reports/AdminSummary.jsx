import { Crown, TrendingUp, Building2, Users, Receipt, Award } from "lucide-react";

const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

export default function AdminSummary({ branchTotals, supplierTotals, topSupplier, topBranch, totalPurchases, totalInvoices }) {
  return (
    <div className="space-y-4">
      {/* Top highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {topBranch && (
          <div className="rounded-xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">أعلى فرع شراء</p>
                <p className="text-sm font-bold text-gray-800">{topBranch.branch}</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-700">{fmt(topBranch.total)} ج.م</p>
            <p className="text-[10px] text-gray-400 mt-1">{topBranch.count} فاتورة</p>
          </div>
        )}
        {topSupplier && (
          <div className="rounded-xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">أعلى مورد شراء</p>
                <p className="text-sm font-bold text-gray-800">{topSupplier.name}</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-700">{fmt(topSupplier.total)} ج.م</p>
            <p className="text-[10px] text-gray-400 mt-1">{topSupplier.count} فاتورة</p>
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-teal-600" />
          <div>
            <p className="text-xs text-gray-600">إجمالي مشتريات جميع الفروع</p>
            <p className="text-[10px] text-gray-400">{totalInvoices} فاتورة</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-teal-700">{fmt(totalPurchases)} ج.م</p>
      </div>

      {/* Branch table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" /> إجمالي كل فرع
          </p>
        </div>
        <div className="divide-y">
          {branchTotals.map((b) => (
            <div key={b.branch} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <span className="text-sm font-medium text-gray-700">{b.branch}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400 flex items-center gap-1"><Receipt className="w-3 h-3" /> {b.count}</span>
                <span className="text-sm font-bold text-gray-800">{fmt(b.total)} ج.م</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supplier table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" /> إجمالي كل مورد
          </p>
        </div>
        <div className="divide-y max-h-80 overflow-y-auto">
          {supplierTotals.map((s, idx) => (
            <div key={s.name} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-gray-700">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400 flex items-center gap-1"><Receipt className="w-3 h-3" /> {s.count}</span>
                <span className="text-sm font-bold text-gray-800">{fmt(s.total)} ج.م</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
