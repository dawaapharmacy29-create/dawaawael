import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Database, Plug, Send, RotateCcw } from "lucide-react";
import SyncStats from "@/components/sync/SyncStats";
import SyncOutboxTable from "@/components/sync/SyncOutboxTable";

export default function SupabaseSyncCenter() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [retryingId, setRetryingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sync-outbox"],
    queryFn: () => base44.entities.SyncOutbox.list("-created_date", 200),
    staleTime: 15000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = {
    synced: records.filter((r) => r.status === "synced").length,
    pendingRetry: records.filter((r) => r.status === "pending_retry").length,
    failed: records.filter((r) => r.status === "failed").length,
    today: records.filter((r) => (r.created_date || "").slice(0, 10) === todayStr).length,
    lastSync: records
      .filter((r) => r.synced_at)
      .map((r) => r.synced_at)
      .sort()
      .pop() || null,
  };

  const testConnection = useMutation({
    mutationFn: () => base44.functions.invoke("retrySyncOutbox", { mode: "test_connection" }),
    onSuccess: (res) => {
      setTestResult(res?.data || res);
      qc.invalidateQueries({ queryKey: ["sync-outbox"] });
    },
  });

  const retrySpecific = useMutation({
    mutationFn: (eventId) => {
      setRetryingId(eventId);
      return base44.functions.invoke("retrySyncOutbox", { mode: "retry_specific", event_id: eventId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-outbox"] }),
    onSettled: () => setRetryingId(null),
  });

  const retryBatch = useMutation({
    mutationFn: () => base44.functions.invoke("retrySyncOutbox", { mode: "retry_pending", limit: 50 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-outbox"] }),
  });

  const filtered = records.filter((r) => statusFilter === "all" || r.status === statusFilter);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">مركز مزامنة Supabase</h1>
            <p className="text-xs text-gray-500">ربط أحادي الاتجاه من Base44 إلى Supabase</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={testConnection.isPending}
            onClick={() => testConnection.mutate()}
          >
            <Plug className="w-4 h-4 ml-1" />
            اختبار الاتصال
          </Button>
          <Button
            size="sm"
            disabled={retryBatch.isPending || stats.pendingRetry === 0}
            onClick={() => retryBatch.mutate()}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Send className="w-4 h-4 ml-1" />
            إعادة إرسال الدفعة
          </Button>
        </div>
      </div>

      {testResult && (
        <Card className={testResult.success ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
          <CardContent className="p-3 text-sm">
            <span className="font-medium">{testResult.success ? "✅ الاتصال ناجح" : "❌ فشل الاتصال"}</span>
            {testResult.error && <span className="text-red-600 mr-2">— {testResult.error}</span>}
            {testResult.status && <span className="text-gray-500 mr-2">(HTTP {testResult.status})</span>}
          </CardContent>
        </Card>
      )}

      {retryBatch.data?.data && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-sm text-blue-700">
            تمت معالجة {retryBatch.data.data.processed} حدث — متزامن: {retryBatch.data.data.synced}، فشل: {retryBatch.data.data.failed}، يعيد المحاولة: {retryBatch.data.data.retried}
          </CardContent>
        </Card>
      )}

      <SyncStats stats={stats} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">سجل أحداث المزامنة</CardTitle>
            <RadioGroup
              value={statusFilter}
              onValueChange={setStatusFilter}
              className="flex gap-1 flex-wrap"
            >
              {[
                { v: "all", l: "الكل" },
                { v: "synced", l: "متزامن" },
                { v: "pending_retry", l: "بانتظار" },
                { v: "failed", l: "فشل" },
              ].map((s) => (
                <label key={s.v} className="flex items-center gap-1 cursor-pointer text-xs">
                  <RadioGroupItem value={s.v} id={`f-${s.v}`} />
                  {s.l}
                </label>
              ))}
            </RadioGroup>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-3 border-gray-200 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <SyncOutboxTable records={filtered} onRetry={(id) => retrySpecific.mutate(id)} retryingId={retryingId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}