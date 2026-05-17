import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RotateCcw, CheckCircle2 } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import { format } from "date-fns";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

const emptyForm = () => ({
  item_name: "", quantity: "", price: "", expiry_date: "", branch: "", notes: ""
});

const STATUS_COLORS = {
  "منتهي": "bg-red-100 text-red-800",
  "تم الإرجاع للشركة": "bg-blue-100 text-blue-800",
  "تم التبديل / التصريف": "bg-green-100 text-green-800",
};

export default function ExpiredItemsTab() {
  const { isAdmin, isManager } = useUserRole();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [actionItem, setActionItem] = useState(null); // { item, type: 'return'|'dispose' }

  const { data: items = [] } = useQuery({
    queryKey: ["expired-items"],
    queryFn: () => base44.entities.ExpiredItem.list(),
  });

  // Sort by expiry_date ascending
  const sortedItems = [...items].sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ExpiredItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries(["expired-items"]); setShowAdd(false); setForm(emptyForm()); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ExpiredItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["expired-items"]); setActionItem(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ExpiredItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["expired-items"])
  });

  const handleAdd = () => {
    if (!form.item_name || !form.quantity || !form.price || !form.expiry_date || !form.branch) return;
    createMutation.mutate({ ...form, quantity: Number(form.quantity), price: Number(form.price), status: "منتهي", source: "إدخال مباشر" });
  };

  const handleReturn = () => {
    updateMutation.mutate({ id: actionItem.item.id, data: { status: "تم الإرجاع للشركة" } });
  };

  const handleDispose = () => {
    updateMutation.mutate({ id: actionItem.item.id, data: { status: "تم التبديل / التصريف" } });
  };

  const canAct = isAdmin || isManager;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">الأصناف المنتهية (أكسبير)</h3>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1 bg-gray-900 hover:bg-black text-white">
          <Plus className="w-4 h-4" /> إضافة صنف منتهي
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="px-3 py-2 text-right">اسم الصنف</th>
              <th className="px-3 py-2 text-right">الفرع</th>
              <th className="px-3 py-2 text-right">العدد</th>
              <th className="px-3 py-2 text-right">السعر</th>
              <th className="px-3 py-2 text-right">تاريخ الصلاحية</th>
              <th className="px-3 py-2 text-right">المصدر</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              {canAct && <th className="px-3 py-2 text-right">إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">لا توجد أصناف منتهية</td></tr>
            )}
            {sortedItems.map(item => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{item.item_name}</td>
                <td className="px-3 py-2">{item.branch}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{item.price} ج</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    {format(new Date(item.expiry_date), "MM/yyyy")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-gray-500">{item.source || "إدخال مباشر"}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700"}`}>
                    {item.status}
                  </span>
                </td>
                {canAct && (
                  <td className="px-3 py-2">
                    {item.status === "منتهي" && (
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1 text-blue-600 border-blue-300"
                          onClick={() => setActionItem({ item, type: "return" })}>
                          <RotateCcw className="w-3 h-3" /> إرجاع للشركة
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1 text-green-600 border-green-300"
                          onClick={() => setActionItem({ item, type: "dispose" })}>
                          <CheckCircle2 className="w-3 h-3" /> تبديل/تصريف
                        </Button>
                      </div>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-500"
                        onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إضافة صنف منتهي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="اسم الصنف" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
            <Select value={form.branch} onValueChange={v => setForm({ ...form, branch: v })}>
              <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="العدد" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <Input type="number" placeholder="السعر" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <Input type="month" placeholder="تاريخ الصلاحية" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
            <Input placeholder="ملاحظات (اختياري)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleAdd} disabled={createMutation.isPending} className="bg-gray-900 hover:bg-black">
              {createMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={!!actionItem} onOpenChange={() => setActionItem(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {actionItem?.type === "return" ? "إرجاع للشركة" : "تبديل / تصريف"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">الصنف: <strong>{actionItem?.item?.item_name}</strong></p>
            <p className="text-sm text-gray-500">
              {actionItem?.type === "return"
                ? "سيتم تسجيل هذا الصنف كمرتجع للشركة."
                : "سيتم تسجيل هذا الصنف كتم تبديله أو تصريفه."}
            </p>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={actionItem?.type === "return" ? handleReturn : handleDispose}
              disabled={updateMutation.isPending} className="bg-gray-900 hover:bg-black">
              تأكيد
            </Button>
            <Button variant="outline" onClick={() => setActionItem(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}