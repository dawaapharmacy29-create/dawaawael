import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Clock, ShoppingBag, ClipboardList, FileText, FlaskConical, ShieldCheck } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { FINANCIAL_ACCESS_LABELS } from "@/lib/financialAccess";
import FinancialDashboard from "./FinancialDashboard";
import LimitedFinancialDashboard from "./LimitedFinancialDashboard";

function OperationalDashboard() {
  const { user, financialAccessLevel } = useUserRole();
  const name = user?.full_name || user?.name || "";
  const cards = [
    { to: "/shift-delivery", label: "تسليم الشيفت", desc: "تسجيل الشيفت ومراجعة تسليمات فرعك في الدورة الحالية", icon: Clock },
    { to: "/invoices", label: "فواتير الشراء", desc: "تسجيل ومتابعة الفواتير التشغيلية", icon: FileText },
    { to: "/pending-invoices", label: "انتظار المراجعة", desc: "مراجعة واعتماد الفواتير التشغيلية", icon: ClipboardList },
    { to: "/customer-orders", label: "طلبات العملاء", desc: "تسجيل ومتابعة طلبات العملاء", icon: ShoppingBag },
    { to: "/pharmacy-orders", label: "طلبات الصيدليات", desc: "تسجيل ومتابعة طلبات الصيدليات", icon: FlaskConical },
  ];

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">الصفحة الرئيسية</h1>
        <p className="text-sm text-gray-500 mt-1">أهلًا {name || "بك"} — الواجهة تعرض فقط المعلومات المناسبة لصلاحيات حسابك.</p>
      </div>
      <Card className="p-4 border-teal-200 bg-teal-50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700 mt-0.5" />
          <div><p className="font-bold text-teal-900">الوضع التشغيلي الآمن</p><p className="text-xs text-teal-800 mt-1">التفاصيل المالية الإجمالية، أرصدة الموردين، التارجتات والتقارير الحساسة غير محملة على هذا الحساب. مستوى الوصول الحالي: {FINANCIAL_ACCESS_LABELS[financialAccessLevel] || "تشغيلي فقط"}.</p></div>
        </div>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({to,label,desc,icon:Icon}) => <Link key={to} to={to}><Card className="p-5 h-full hover:shadow-md transition-shadow"><Icon className="w-6 h-6 text-teal-600 mb-3"/><h2 className="font-black text-gray-800">{label}</h2><p className="text-xs text-gray-500 mt-1">{desc}</p></Card></Link>)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { financialAccessLevel } = useUserRole();
  if (financialAccessLevel === "full") return <FinancialDashboard />;
  if (financialAccessLevel === "limited") return <LimitedFinancialDashboard />;
  return <OperationalDashboard />;
}
