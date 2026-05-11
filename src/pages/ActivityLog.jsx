import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

const ACTION_LABELS = {
  create: { label: "إضافة", color: "bg-green-100 text-green-700" },
  update: { label: "تعديل", color: "bg-blue-100 text-blue-700" },
  delete: { label: "حذف", color: "bg-red-100 text-red-700" },
  payment: { label: "دفعة", color: "bg-purple-100 text-purple-700" },
};

const ENTITY_LABELS = {
  invoice: "فاتورة",
  expense: "مصروف",
  supplier: "مورد",
  payment: "سداد",
};

export default function ActivityLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => base44.entities.ActivityLog.list("-created_date", 100),
  });

  const fmt = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-EG") + " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-6 h-6 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">سجل العمليات</h1>
          <p className="text-gray-500 text-sm mt-0.5">جميع العمليات المنفذة في النظام</p>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          جاري التحميل...
        </Card>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center text-gray-400">لا توجد عمليات مسجلة بعد</Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const action = ACTION_LABELS[log.action_type] || { label: log.action_type, color: "bg-gray-100 text-gray-700" };
            return (
              <Card key={log.id} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <Badge className={`${action.color} border-0 shrink-0 mt-0.5`}>{action.label}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      {log.entity_label ? `: ${log.entity_label}` : ""}
                    </p>
                    {log.details && <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {log.user_name || log.user_email}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0 text-left">{fmt(log.created_date)}</span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}