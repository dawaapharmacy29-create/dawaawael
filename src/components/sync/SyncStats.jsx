import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, ListChecks, CalendarDays } from "lucide-react";

export default function SyncStats({ stats }) {
  const cards = [
    {
      label: "آخر مزامنة ناجحة",
      value: stats.lastSync ? new Date(stats.lastSync).toLocaleString("ar-EG") : "—",
      icon: CalendarDays,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "أحداث اليوم",
      value: stats.today,
      icon: ListChecks,
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "متزامن",
      value: stats.synced,
      icon: CheckCircle2,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "بانتظار إعادة المحاولة",
      value: stats.pendingRetry,
      icon: Clock,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "فشل",
      value: stats.failed,
      icon: XCircle,
      color: "text-red-600 bg-red-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{c.label}</span>
              <div className={`p-1.5 rounded-lg ${c.color}`}>
                <c.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-bold text-gray-800 truncate" title={String(c.value)}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}