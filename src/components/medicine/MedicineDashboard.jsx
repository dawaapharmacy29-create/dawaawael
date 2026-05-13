import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Award } from "lucide-react";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];
const branchColor = {
  "فرع زكريا": "bg-blue-50 border-blue-200 text-blue-700",
  "فرع بسيسة": "bg-purple-50 border-purple-200 text-purple-700",
  "فرع المنشية": "bg-orange-50 border-orange-200 text-orange-700",
};

export default function MedicineDashboard() {
  const { data: items = [] } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["medicine-sales"],
    queryFn: () => base44.entities.MedicineSale.list("-week_start", 200),
    staleTime: 15000,
  });

  const activeItems = items.filter((i) => i.is_active !== false);

  // إجمالي مبيعات كل صنف
  const itemTotals = activeItems.map((item) => {
    let total = 0;
    let byBranch = {};
    sales.forEach((s) => {
      (s.sales || []).forEach((sale) => {
        if (sale.medicine_name === item.name || sale.medicine_id === item.id) {
          total += sale.quantity || 0;
          byBranch[s.branch] = (byBranch[s.branch] || 0) + (sale.quantity || 0);
        }
      });
    });
    // أكثر فرع مبيعاً
    const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { item, total, byBranch, topBranch };
  });

  // إجمالي مبيعات كل فرع عبر جميع الأصناف
  const branchTotals = BRANCHES.map((b) => ({
    branch: b,
    total: sales.reduce((sum, s) => {
      if (s.branch !== b) return sum;
      return sum + (s.sales || []).reduce((ss, sale) => ss + (sale.quantity || 0), 0);
    }, 0),
  }));
  const topBranch = [...branchTotals].sort((a, b) => b.total - a.total)[0]?.branch;

  return (
    <div className="space-y-6">
      {/* وسام الفرع الأكثر مبيعاً */}
      {topBranch && (
        <Card className={`p-4 border-2 flex items-center gap-4 ${branchColor[topBranch]}`}>
          <Award className="w-10 h-10 text-yellow-500 shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-500">🏆 الفرع الأكثر مبيعاً</p>
            <p className="text-xl font-bold">{topBranch}</p>
            <p className="text-sm">{branchTotals.find((b) => b.branch === topBranch)?.total?.toLocaleString("ar-EG")} وحدة إجمالي</p>
          </div>
        </Card>
      )}

      {/* إجمالي مبيعات كل صنف */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">إجمالي مبيعات كل صنف</h2>
        {activeItems.length === 0 ? (
          <Card className="p-8 text-center text-gray-400">لا توجد أصناف بعد — أضفها من تبويب "إدارة الأصناف"</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemTotals.map(({ item, total, byBranch, topBranch: tb }) => (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <span className="text-lg font-bold text-teal-600">{total.toLocaleString("ar-EG")}</span>
                </div>
                <div className="space-y-1.5">
                  {BRANCHES.map((b) => {
                    const qty = byBranch[b] || 0;
                    const pct = total > 0 ? Math.round((qty / total) * 100) : 0;
                    return (
                      <div key={b}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className={`font-medium ${b === tb ? "text-teal-700" : "text-gray-600"}`}>
                            {b} {b === tb && "🥇"}
                          </span>
                          <span className="text-gray-500">{qty} وحدة</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}