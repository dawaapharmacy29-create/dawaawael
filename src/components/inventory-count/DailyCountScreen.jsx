import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Search, ScanLine, ChevronDown, ChevronUp, Save } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const TODAY = new Date().toISOString().split("T")[0];

const getDiffClass = (diff) => {
  if (diff === null || diff === undefined) return "";
  if (diff === 0) return "bg-green-50 border-green-200";
  if (diff < 0) return "bg-red-50 border-red-200";
  return "bg-blue-50 border-blue-200";
};

const getDiffBadge = (diff) => {
  if (diff === null || diff === undefined) return null;
  if (diff === 0) return <Badge className="bg-green-100 text-green-800">مطابق ✓</Badge>;
  if (diff < 0) return <Badge className="bg-red-100 text-red-800">عجز {Math.abs(diff)}</Badge>;
  return <Badge className="bg-blue-100 text-blue-800">زيادة +{diff}</Badge>;
};

export default function DailyCountScreen({ branch }) {
  const qc = useQueryClient();
  const barcodeRef = useRef();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [saving, setSaving] = useState({});
  const [localEntries, setLocalEntries] = useState({});

  const { data: tasks = [] } = useQuery({
    queryKey: ["inventory-tasks", branch],
    queryFn: () => base44.entities.InventoryCountTask.filter({ branch }),
    staleTime: 15000,
  });

  const activeTasks = tasks
    .filter(t => t.status !== "مكتمل")
    .sort((a, b) => b.task_date?.localeCompare(a.task_date));

  const todayTask = activeTasks.find(t => t.task_date === TODAY) || activeTasks[0];
  const displayTaskId = selectedTaskId || todayTask?.id;

  const { data: allEntries = [] } = useQuery({
    queryKey: ["inventory-entries", displayTaskId],
    queryFn: () => base44.entities.InventoryCountEntry.filter({ task_id: displayTaskId }),
    enabled: !!displayTaskId,
    staleTime: 10000,
  });

  useEffect(() => {
    const map = {};
    allEntries.forEach(e => { map[e.id] = e; });
    setLocalEntries(map);
  }, [allEntries]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InventoryCountEntry.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries(["inventory-entries", displayTaskId]);
      qc.invalidateQueries(["inventory-tasks", branch]);
    }
  });

  const filteredEntries = Object.values(localEntries).filter(e =>
    !search || e.product_name?.includes(search) || e.product_code?.includes(search)
  );

  const pending = filteredEntries.filter(e => e.status === "لم يُجرد");
  const done = filteredEntries.filter(e => e.status === "مكتمل");
  const accuracy = done.length > 0
    ? Math.round((done.filter(e => e.difference === 0).length / done.length) * 100)
    : null;

  const handleActualChange = (id, value) => {
    setLocalEntries(prev => {
      const entry = prev[id];
      const actual = value === "" ? null : Number(value);
      const diff = actual !== null ? actual - (entry.expected_quantity || 0) : null;
      return { ...prev, [id]: { ...entry, actual_quantity: actual, difference: diff } };
    });
  };

  const handleSaveEntry = async (id) => {
    const entry = localEntries[id];
    if (entry.actual_quantity === null || entry.actual_quantity === undefined) return;
    setSaving(p => ({ ...p, [id]: true }));
    const diff = entry.actual_quantity - (entry.expected_quantity || 0);
    await updateMutation.mutateAsync({
      id,
      data: {
        actual_quantity: entry.actual_quantity,
        difference: diff,
        notes: entry.notes || "",
        status: "مكتمل",
      }
    });
    // Update product discrepancy count
    if (diff !== 0 && entry.product_id) {
      const prods = await base44.entities.InventoryProduct.filter({ id: entry.product_id });
      if (prods[0]) {
        const cnt = (prods[0].discrepancy_count || 0) + 1;
        await base44.entities.InventoryProduct.update(entry.product_id, {
          last_counted_date: TODAY,
          discrepancy_count: cnt,
          stock_quantity: entry.actual_quantity,
        });
      }
    } else if (entry.product_id) {
      await base44.entities.InventoryProduct.update(entry.product_id, {
        last_counted_date: TODAY,
        stock_quantity: entry.actual_quantity,
      });
    }
    setSaving(p => ({ ...p, [id]: false }));
  };

  const handleNotesChange = (id, notes) => {
    setLocalEntries(prev => ({ ...prev, [id]: { ...prev[id], notes } }));
  };

  // Barcode: highlight matching product
  const handleBarcodeSearch = (e) => {
    setBarcodeInput(e.target.value);
    if (e.target.value) setSearch(e.target.value);
  };

  // Complete task
  const handleCompleteTask = async () => {
    const completedCount = Object.values(localEntries).filter(e => e.status === "مكتمل").length;
    const acc = completedCount > 0
      ? Math.round((Object.values(localEntries).filter(e => e.status === "مكتمل" && e.difference === 0).length / completedCount) * 100)
      : 0;
    await base44.entities.InventoryCountTask.update(displayTaskId, {
      status: "مكتمل",
      completed_count: completedCount,
      accuracy_rate: acc,
    });
    qc.invalidateQueries(["inventory-tasks", branch]);
  };

  const currentTask = tasks.find(t => t.id === displayTaskId);

  return (
    <div dir="rtl" className="space-y-4">
      {/* Task selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-600">مهمة الجرد:</span>
        {activeTasks.length === 0 ? (
          <span className="text-sm text-gray-400">لا توجد مهام نشطة — قم بتوليد مهمة جديدة</span>
        ) : (
          activeTasks.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                t.id === displayTaskId
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-teal-400"
              }`}
            >
              {t.task_date} ({t.items_count} صنف)
            </button>
          ))
        )}
      </div>

      {displayTaskId && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{allEntries.length}</p>
              <p className="text-xs text-gray-500 mt-1">إجمالي الأصناف</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{done.length}</p>
              <p className="text-xs text-green-600 mt-1">تم الجرد</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{pending.length}</p>
              <p className="text-xs text-yellow-600 mt-1">لم يُجرد</p>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-teal-700">{accuracy !== null ? `${accuracy}%` : "--"}</p>
              <p className="text-xs text-teal-600 mt-1">دقة الجرد</p>
            </div>
          </div>

          {/* Search & barcode */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute right-2 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                className="pr-7"
                placeholder="بحث باسم أو كود الصنف..."
                value={search}
                onChange={e => { setSearch(e.target.value); setBarcodeInput(""); }}
              />
            </div>
            <div className="relative">
              <ScanLine className="absolute right-2 top-2.5 w-4 h-4 text-teal-500" />
              <Input
                ref={barcodeRef}
                className="pr-7 w-40 border-teal-300"
                placeholder="باركود..."
                value={barcodeInput}
                onChange={handleBarcodeSearch}
              />
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {pending.length > 0 && (
              <p className="text-xs font-semibold text-gray-500 px-1">— لم يُجرد ({pending.length})</p>
            )}
            {filteredEntries.sort((a, b) => {
              if (a.status === "لم يُجرد" && b.status !== "لم يُجرد") return -1;
              if (a.status !== "لم يُجرد" && b.status === "لم يُجرد") return 1;
              return 0;
            }).map(entry => (
              <div
                key={entry.id}
                className={`border rounded-xl p-3 transition-colors ${entry.status === "مكتمل" ? getDiffClass(entry.difference) : "bg-white border-gray-200"}`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{entry.product_name}</p>
                    {entry.product_code && <p className="text-xs text-gray-400">كود: {entry.product_code}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.status === "مكتمل" ? getDiffBadge(entry.difference) : (
                      <Badge className="bg-gray-100 text-gray-600"><Clock className="w-3 h-3 ml-1" />لم يُجرد</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">متوقع</p>
                    <p className="text-lg font-bold text-gray-700">{entry.expected_quantity}</p>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">فعلي</p>
                    <Input
                      type="number"
                      min={0}
                      className="w-24 h-9 text-center text-lg font-bold"
                      value={entry.actual_quantity ?? ""}
                      onChange={e => handleActualChange(entry.id, e.target.value)}
                      disabled={entry.status === "مكتمل"}
                    />
                  </div>
                  {entry.status !== "مكتمل" && entry.actual_quantity !== null && entry.actual_quantity !== undefined && entry.actual_quantity !== "" && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">فارق</p>
                      <p className={`text-lg font-bold ${entry.difference < 0 ? "text-red-600" : entry.difference > 0 ? "text-blue-600" : "text-green-600"}`}>
                        {entry.difference > 0 ? "+" : ""}{entry.difference}
                      </p>
                    </div>
                  )}
                </div>

                {entry.status !== "مكتمل" && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="ملاحظات..."
                      className="text-xs h-8 flex-1"
                      value={entry.notes || ""}
                      onChange={e => handleNotesChange(entry.id, e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-teal-600 hover:bg-teal-700 text-xs"
                      onClick={() => handleSaveEntry(entry.id)}
                      disabled={saving[entry.id] || entry.actual_quantity === null || entry.actual_quantity === undefined || entry.actual_quantity === ""}
                    >
                      <Save className="w-3 h-3" />
                      {saving[entry.id] ? "..." : "حفظ"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Complete Task */}
          {currentTask?.status !== "مكتمل" && done.length > 0 && (
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleCompleteTask}
            >
              <CheckCircle2 className="w-4 h-4" />
              إنهاء مهمة الجرد ({done.length}/{allEntries.length} مكتمل)
            </Button>
          )}
        </>
      )}
    </div>
  );
}