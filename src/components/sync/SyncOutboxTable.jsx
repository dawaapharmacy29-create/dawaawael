import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RotateCcw, Search } from "lucide-react";

const STATUS_STYLES = {
  synced: "bg-green-100 text-green-700 border-green-300",
  pending: "bg-blue-100 text-blue-700 border-blue-300",
  pending_retry: "bg-amber-100 text-amber-700 border-amber-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};

const EVENT_LABELS = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
};

export default function SyncOutboxTable({ records, onRetry, retryingId }) {
  const [search, setSearch] = useState("");

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.entity_name || "").toLowerCase().includes(q) ||
      (r.record_id || "").toLowerCase().includes(q) ||
      (r.event_id || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="بحث بالجدول أو رقم السجل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      <div className="rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">الجدول</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">العملية</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">رقم السجل</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600">المحاولات</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600">الحالة</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">رسالة الخطأ</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">التاريخ</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">لا توجد أحداث</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.entity_name}</td>
                  <td className="px-3 py-2">
                    <span className="text-gray-600">{EVENT_LABELS[r.event_type] || r.event_type}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 font-mono text-xs max-w-[120px] truncate" title={r.record_id}>
                    {r.record_id}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">{r.attempts || 0}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="outline" className={STATUS_STYLES[r.status] || "border-gray-300"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-red-600 text-xs max-w-[200px] truncate" title={r.last_error}>
                    {r.last_error || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                    {r.synced_at ? new Date(r.synced_at).toLocaleString("ar-EG") : new Date(r.created_date).toLocaleString("ar-EG")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {(r.status === "pending_retry" || r.status === "failed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryingId === r.event_id}
                        onClick={() => onRetry(r.event_id)}
                        className="h-7 px-2 text-xs"
                      >
                        <RotateCcw className="w-3 h-3 ml-1" />
                        {retryingId === r.event_id ? "..." : "إعادة"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">إجمالي: {filtered.length} حدث</p>
    </div>
  );
}