import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Package, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

export default function ProductsManager() {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(null); // branch name being deleted
  const [confirm, setConfirm] = useState(null);   // branch name awaiting confirm
  const [done, setDone] = useState(null);          // branch name just deleted
  const [progress, setProgress] = useState(0);

  const { data: allProducts = [], isLoading, refetch } = useQuery({
    queryKey: ["inventory-products-all"],
    queryFn: () => base44.entities.InventoryProduct.list(),
    staleTime: 30000,
  });

  const countByBranch = (branch) => allProducts.filter(p => p.branch === branch).length;

  const handleDelete = async (branch) => {
    setDeleting(branch);
    setConfirm(null);
    setProgress(0);

    const toDelete = allProducts.filter(p => p.branch === branch);
    for (let i = 0; i < toDelete.length; i++) {
      await base44.entities.InventoryProduct.delete(toDelete[i].id);
      setProgress(Math.round(((i + 1) / toDelete.length) * 100));
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 600));
    }

    qc.invalidateQueries(["inventory-products-all"]);
    qc.invalidateQueries(["inventory-products"]);
    await refetch();
    setDeleting(null);
    setDone(branch);
    setTimeout(() => setDone(null), 3000);
  };

  if (isLoading) return <div className="text-center text-gray-400 py-8">جاري التحميل...</div>;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2 text-yellow-800 text-sm">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>حذف أصناف الفرع يُزيل جميع البيانات نهائياً. استخدم هذا قبل رفع ملف جديد.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BRANCHES.map(branch => {
          const count = countByBranch(branch);
          const isDeleting = deleting === branch;
          const isDone = done === branch;
          const isConfirming = confirm === branch;

          return (
            <div key={branch} className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                <span className="font-bold text-gray-800">{branch}</span>
              </div>

              <div className="text-center py-3">
                <p className="text-3xl font-bold text-gray-700">{count}</p>
                <p className="text-xs text-gray-400 mt-1">صنف مسجّل</p>
              </div>

              {isDone && (
                <div className="flex items-center gap-1.5 justify-center text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> تم الحذف بنجاح
                </div>
              )}

              {isDeleting && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>جاري الحذف...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {!isDeleting && !isDone && count > 0 && (
                isConfirming ? (
                  <div className="space-y-2">
                    <p className="text-xs text-center text-red-600 font-medium">هل أنت متأكد من حذف {count} صنف؟</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-xs h-8"
                        onClick={() => handleDelete(branch)}
                      >
                        <Trash2 className="w-3.5 h-3.5 ml-1" /> تأكيد الحذف
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-8"
                        onClick={() => setConfirm(null)}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 text-red-600 border-red-200 hover:bg-red-50 gap-1"
                    onClick={() => setConfirm(branch)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف أصناف الفرع
                  </Button>
                )
              )}

              {!isDeleting && !isDone && count === 0 && (
                <p className="text-xs text-center text-gray-400">لا توجد أصناف</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}