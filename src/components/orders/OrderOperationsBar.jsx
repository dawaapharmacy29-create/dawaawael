import { AlertTriangle, Clock3, Flame, Inbox, PackageCheck, UserRoundX, CheckCircle2, Archive } from "lucide-react";

const CLOSED = ["تم التوصيل", "تم الإلغاء", "الصنف غير متوفر حاليا"];
const ACTIVE = ["طلب جديد", "جاري البحث", "تم الطلب", "النواقص", "تم توفير الصنف", "تم توفير بديل"];

function ageHours(order) {
  const value = order.requested_at || order.created_date || order.request_date;
  const time = value ? new Date(value).getTime() : Date.now();
  return Math.max(0, (Date.now() - time) / 3600000);
}

export function matchesOrderQueue(order, queue) {
  if (queue === "all") return true;
  if (queue === "active") return ACTIVE.includes(order.status);
  if (queue === "urgent") return order.priority === "عاجل" && !CLOSED.includes(order.status);
  if (queue === "overdue") {
    const limit = order.priority === "عاجل" ? 2 : order.priority === "متوسط" ? 12 : 24;
    return !CLOSED.includes(order.status) && ageHours(order) >= limit;
  }
  if (queue === "unassigned") return ACTIVE.includes(order.status) && !order.assigned_employee;
  if (queue === "available") return ["تم توفير الصنف", "تم توفير بديل"].includes(order.status) && !order.customer_contacted;
  if (queue === "done") return order.status === "تم التوصيل";
  if (queue === "archived") return ["تم الإلغاء", "الصنف غير متوفر حاليا"].includes(order.status);
  return true;
}

export function getOrderAge(order) {
  const hours = ageHours(order);
  if (hours < 1) return "أقل من ساعة";
  if (hours < 24) return `${Math.floor(hours)} س`;
  return `${Math.floor(hours / 24)} يوم`;
}

export function isOrderOverdue(order) {
  return matchesOrderQueue(order, "overdue");
}

const QUEUES = [
  { id: "active", label: "قيد التنفيذ", icon: Inbox, tone: "teal" },
  { id: "urgent", label: "عاجلة", icon: Flame, tone: "red" },
  { id: "overdue", label: "متأخرة", icon: AlertTriangle, tone: "amber" },
  { id: "unassigned", label: "بدون مسؤول", icon: UserRoundX, tone: "violet" },
  { id: "available", label: "جاهزة للتواصل", icon: PackageCheck, tone: "cyan" },
  { id: "done", label: "تم التسليم", icon: CheckCircle2, tone: "green" },
  { id: "archived", label: "الأرشيف", icon: Archive, tone: "gray" },
  { id: "all", label: "كل الطلبات", icon: Clock3, tone: "slate" },
];

const TONES = {
  teal: "border-teal-200 bg-teal-50 text-teal-700",
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  green: "border-green-200 bg-green-50 text-green-700",
  gray: "border-gray-200 bg-gray-50 text-gray-600",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function OrderOperationsBar({ orders, activeQueue, onQueueChange }) {
  return (
    <section className="bg-white rounded-2xl border shadow-sm p-3">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <h2 className="text-sm font-bold text-gray-800">قوائم العمل السريعة</h2>
          <p className="text-[11px] text-gray-400">اختار القائمة وابدأ بالطلبات التي تحتاج تدخل الآن</p>
        </div>
        <span className="text-[11px] text-gray-400 hidden sm:block">العاجل يتأخر بعد ساعتين · المتوسط 12 ساعة · العادي 24 ساعة</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {QUEUES.map(({ id, label, icon: Icon, tone }) => {
          const count = orders.filter((order) => matchesOrderQueue(order, id)).length;
          const active = activeQueue === id;
          return (
            <button
              key={id}
              onClick={() => onQueueChange(id)}
              className={`rounded-xl border px-2.5 py-2 text-right transition-all ${TONES[tone]} ${active ? "ring-2 ring-offset-1 ring-current shadow-sm" : "hover:shadow-sm"}`}
            >
              <div className="flex items-center justify-between gap-1">
                <Icon className="w-4 h-4" />
                <strong className="text-lg leading-none">{count}</strong>
              </div>
              <div className="text-[11px] font-semibold mt-1 truncate">{label}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
