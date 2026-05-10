import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { FileText, Users, Receipt, TrendingUp, Building2 } from "lucide-react";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

const branchColor = {
  "فرع زكريا": "bg-blue-50 border-blue-200 text-blue-700",
  "فرع بسيسة": "bg-purple-50 border-purple-200 text-purple-700",
  "فرع المنشية": "bg-orange-50 border-orange-200 text-orange-700",
};

export default function Dashboard() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => base44.entities.PurchaseInvoice.list("-created_date"),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => base44.entities.Expense.list(),
  });

  const totalInvoiceValue = invoices.reduce((s, i) => s + (i.total_value || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const pending = invoices.filter((i) => i.status === "انتظار المراجعة").length;

  const stats = [
    { label: "إجمالي الفواتير", value: invoices.length, icon: FileText, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "قيمة المشتريات", value: totalInvoiceValue.toLocaleString("ar-EG") + " ج", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "الموردين", value: suppliers.length, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "المصروفات", value: totalExpenses.toLocaleString("ar-EG") + " ج", icon: Receipt, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">الصفحة الرئيسية</h1>
        <p className="text-gray-500 text-sm mt-0.5">نظرة عامة على النشاط</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-800">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Branches Summary */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> ملخص الفروع
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BRANCHES.map((branch) => {
            const branchInvoices = invoices.filter((i) => i.branch === branch);
            const branchTotal = branchInvoices.reduce((s, i) => s + (i.total_value || 0), 0);
            const branchPaid = branchInvoices.reduce((s, i) => s + (i.paid_value || 0), 0);
            const branchExpenses = expenses.filter((e) => e.branch === branch);
            const branchExpTotal = branchExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            return (
              <Card key={branch} className={`p-4 border-2 ${branchColor[branch]}`}>
                <h3 className="font-bold text-base mb-3">{branch}</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span>عدد الفواتير</span>
                    <span className="font-semibold">{branchInvoices.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>قيمة المشتريات</span>
                    <span className="font-semibold">{branchTotal.toLocaleString("ar-EG")} ج</span>
                  </div>
                  <div className="flex justify-between">
                    <span>المدفوع</span>
                    <span className="font-semibold">{branchPaid.toLocaleString("ar-EG")} ج</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <span>المصروفات</span>
                    <span className="font-semibold">{branchExpTotal.toLocaleString("ar-EG")} ج</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pending invoices */}
      {pending > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <p className="text-yellow-800 font-semibold text-sm">
            ⏳ يوجد {pending} فاتورة في انتظار المراجعة
          </p>
        </Card>
      )}
    </div>
  );
}