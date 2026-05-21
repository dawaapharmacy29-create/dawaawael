import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Package, PlayCircle, ArrowRight } from "lucide-react";
import DailyCountScreen from "./DailyCountScreen";

const TODAY = new Date().toISOString().split("T")[0];

function getStatusForDate(date) {
  if (!date) return null;
  const diff = Math.floor((new Date(date) - new Date(TODAY)) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: "انتهى الموعد", color: "bg-gray-100 text-gray-500" };
  if (diff === 0) return { label: "اليوم", color: "bg-green-100 text-green-700" };
  if (diff === 1) return { label: "غداً", color: "bg-blue-100 text-blue-700" };
  return { label: `بعد ${diff} أيام`, color: "bg-yellow-100 text-yellow-700" };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function EmployeeScheduleView() {
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState(null); // task to count

  const { data: allSchedules = [], isLoading } = useQuery({
    queryKey: ["weekly-schedule-all"],
    queryFn: () => base44.entities.WeeklySchedule.list(),
    staleTime: 30000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["inventory-tasks-all"],
    queryFn: () => base44.entities.InventoryCountTask.list("-task_date", 200),
    staleTime: 15000,
  });

  const startMutation = useMutation({
    mutationFn: (taskId) =>
      base44.entities.InventoryCountTask.update(taskId, {
        status: "جاري",
        started_at: new Date().toISOString(),
      }),
    onSuccess: (_, taskId) => {
      qc.invalidateQueries(["inventory-tasks-all"]);
      const task = tasks.find(t => t.id === taskId);
      if (task) setActiveTask({ ...task, status: "جاري" });
    },
  });

  // If a session is active, show the counting screen
  if (activeTask) {
    return (
      <div dir="rtl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1 text-gray-500"
          onClick={() => setActiveTask(null)}
        >
          <ArrowRight className="w-4 h-4" /> العودة للمواعيد
        </Button>
        <DailyCountScreen task={activeTask} />
      </div>
    );
  }

  // Flatten all assignments across all branches, sorted by date
  const allAssignments = allSchedules.flatMap(s =>
    (s.assignments || []).map(a => ({ ...a, branch: s.branch }))
  ).filter(a => a.scheduled_date)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  // Group by employee
  const byEmployee = {};
  allAssignments.forEach(a => {
    if (!byEmployee[a.employee_name]) byEmployee[a.employee_name] = [];
    byEmployee[a.employee_name].push(a);
  });

  const employees = Object.keys(byEmployee).sort();

  if (isLoading) return <div className="text-center text-gray-400 py-8">جاري التحميل...</div>;

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>لا توجد مواعيد جرد مجدولة</p>
      </div>
    );
  }

  const handleStart = (task) => {
    if (task.status === "جاري") {
      setActiveTask(task);
    } else {
      startMutation.mutate(task.id);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      <h3 className="font-bold text-gray-700 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-teal-600" />
        مواعيد الجرد القادمة لكل موظف
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map(emp => (
          <div key={emp} className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-teal-50 border-b px-4 py-2 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              <span className="font-semibold text-teal-800">{emp}</span>
              <Badge className="mr-auto bg-teal-100 text-teal-700 text-xs">{byEmployee[emp].length} موعد</Badge>
            </div>
            <div className="divide-y">
              {byEmployee[emp].map((a, i) => {
                const status = getStatusForDate(a.scheduled_date);
                const relatedTask = tasks.find(t => t.task_date === a.scheduled_date && t.branch === a.branch && t.assigned_employee === emp);
                const canStart = relatedTask && relatedTask.status !== "مكتمل" && relatedTask.status !== "متأخر";
                const isStarting = startMutation.isPending && startMutation.variables === relatedTask?.id;

                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{formatDate(a.scheduled_date)}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Package className="w-3 h-3" />{a.branch}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {relatedTask && (
                        <Badge className={
                          relatedTask.status === "مكتمل" ? "bg-green-100 text-green-700 text-xs" :
                          relatedTask.status === "جاري" ? "bg-blue-100 text-blue-700 text-xs" :
                          relatedTask.status === "متأخر" ? "bg-red-100 text-red-700 text-xs" :
                          "bg-gray-100 text-gray-600 text-xs"
                        }>{relatedTask.status}</Badge>
                      )}
                      {canStart && (
                        <Button
                          size="sm"
                          className={`text-xs h-7 gap-1 ${relatedTask.status === "جاري" ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-600 hover:bg-teal-700"}`}
                          onClick={() => handleStart(relatedTask)}
                          disabled={isStarting}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          {isStarting ? "..." : relatedTask.status === "جاري" ? "متابعة" : "بدء الجرد"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}