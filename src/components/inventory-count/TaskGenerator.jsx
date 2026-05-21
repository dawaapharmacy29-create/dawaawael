import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Calendar } from "lucide-react";
import { differenceInDays } from "date-fns";

const TODAY = new Date().toISOString().split("T")[0];

function computePriorityScore(product, settings) {
  let score = 0;
  const daysUnderExpiry = product.near_expiry_date
    ? differenceInDays(new Date(product.near_expiry_date), new Date())
    : 9999;

  if (settings.priority_near_expiry && daysUnderExpiry <= 90) score += 40 - (daysUnderExpiry / 90) * 40;
  if (settings.priority_expensive && product.price > 100) score += 20;
  if (settings.priority_fast_moving && product.is_fast_moving) score += 25;
  if (settings.priority_repeated_discrepancy && product.discrepancy_count > 0) score += product.discrepancy_count * 10;
  if (settings.priority_random) score += Math.random() * 5;

  // Penalize recently counted items
  if (product.last_counted_date) {
    const daysSince = differenceInDays(new Date(), new Date(product.last_counted_date));
    score += Math.min(daysSince, 30);
  } else {
    score += 30;
  }

  return score;
}

export default function TaskGenerator({ branch, products, settings, onDone }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(TODAY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!settings) return;
    setLoading(true);

    const branchProducts = products.filter(p => p.branch === branch && p.is_active !== false);
    const itemsPerDay = settings.items_per_day || 20;

    // Score & sort
    const scored = branchProducts.map(p => ({
      ...p,
      _score: computePriorityScore(p, settings)
    })).sort((a, b) => b._score - a._score);

    const selected = scored.slice(0, itemsPerDay);

    // Create task
    const task = await base44.entities.InventoryCountTask.create({
      task_date: date,
      branch,
      product_ids: selected.map(p => p.id),
      status: "مجدول",
      items_count: selected.length,
      completed_count: 0,
    });

    // Create entries
    const entries = selected.map(p => ({
      task_id: task.id,
      product_id: p.id,
      product_code: p.product_code || "",
      product_name: p.product_name,
      branch: p.branch,
      count_date: date,
      expected_quantity: p.stock_quantity || 0,
      actual_quantity: null,
      difference: null,
      status: "لم يُجرد",
    }));

    await base44.entities.InventoryCountEntry.bulkCreate(entries);

    qc.invalidateQueries(["inventory-tasks"]);
    qc.invalidateQueries(["inventory-entries"]);
    setResult({ taskId: task.id, count: selected.length });
    setLoading(false);
    onDone?.();
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-2 text-teal-700">
        <Zap className="w-5 h-5" />
        <h3 className="font-bold text-base">توليد مهمة جرد يومية — {branch}</h3>
      </div>

      {!settings && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          يرجى حفظ إعدادات الجرد لهذا الفرع أولاً قبل توليد المهام.
        </div>
      )}

      <div className="space-y-1">
        <Label>تاريخ المهمة</Label>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {settings && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800 space-y-1">
          <p>عدد الأصناف اليومي: <strong>{settings.items_per_day}</strong></p>
          <p>الأصناف المتاحة في الفرع: <strong>{products.filter(p => p.branch === branch && p.is_active !== false).length}</strong></p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ تم توليد مهمة تشمل <strong>{result.count}</strong> صنف بنجاح!
        </div>
      )}

      <Button
        className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
        onClick={handleGenerate}
        disabled={!settings || loading || products.length === 0}
      >
        <Zap className="w-4 h-4" />
        {loading ? "جاري التوليد..." : "توليد مهمة الجرد"}
      </Button>
    </div>
  );
}