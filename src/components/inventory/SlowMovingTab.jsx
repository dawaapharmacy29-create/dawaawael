import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowRightLeft, RotateCcw, AlertTriangle, Search, X } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";
import ConfirmDialog from "@/components/invoices/ConfirmDialog";
import { format, differenceInDays } from "date-fns";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

const emptyForm = () => ({
  item_name: "", quantity: "", price: "", expiry_date: "", branch: "", notes: ""
});

export default function SlowMovingTab() {
  const { isAdmin, isManager, user } = useUserRole();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [actionItem, setActionItem] = useState(null);
  const [transferBranch, setTransferBranch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("الكل");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["slow-moving-items"],
    queryFn: () => base44.entities.SlowMovingItem.list(),
  });

  // Filter + Sort by expiry_date ascending
  const sortedItems = [...items]
    .filter(i => i.status === "راكد")
    .filter(i => !search || i.item_name.includes(search))
    .filter(i => filterBranch === "الكل" || i.branch === filterBranch)
    .filter(i => !filterFrom || i.expiry_date >= filterFrom)
    .filter(i => !filterTo || i.expiry_date <= filterTo)
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SlowMovingItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries(["slow-moving-items"]); setShowAdd(false); setForm(emptyForm()); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SlowMovingItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["slow-moving-items"]); setActionItem(null); setTransferBranch(""); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SlowMovingItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["slow-moving-items"])
  });

  const expiredCreateMutation = useMutation({
    mutationFn: (data) => base44.entities.ExpiredItem.create(data),
    onSuccess: () => queryClient.invalidateQueries(["expired-items"])
  });

  const handleAdd = () => {
    if (!form.item_name || !form.quantity || !form.price || !form.expiry_date || !form.branch) return;
    createMutation.mutate({ ...form, quantity: Number(form.quantity), price: Number(form.price), status: "راكد" });
  };

  const handleTransfer = () => {
    if (!transferBranch || transferBranch === actionItem.item.branch) return;
    updateMutation.mutate({ id: actionItem.item.id, data: { branch: transferBranch, status: "تم النقل" } });
    // Create new record in new branch
    base44.entities.SlowMovingItem.create({
      item_name: actionItem.item.item_name,
      quantity: actionItem.item.quantity,
      price: actionItem.item.price,
      expiry_date: actionItem.item.expiry_date,
      branch: transferBranch,
      status: "راكد",
      notes: `منقول من ${actionItem.item.branch}`
    }).then(() => queryClient.invalidateQueries(["slow-moving-items"]));
  };

  const handleReturn = () => {
    updateMutation.mutate({ id: actionItem.item.id, data: { status: "تم الإرجاع للشركة" } });
  };

  const handleToExpired = () => {
    expiredCreateMutation.mutate({
      item_name: actionItem.item.item_name,
      quantity: actionItem.item.quantity,
      price: actionItem.item.price,
      expiry_date: actionItem.item.expiry_date,
      branch: actionItem.item.branch,
      status: "منتهي",
      source: "محول من الراكد",
      notes: actionItem.item.notes || ""
    });
    updateMutation.mutate({ id: actionItem.item.id, data: { status: "تم التحويل لمنتهي" } });
  };

  const getExpiryColor = (expiry_date) => {
    const days = differenceInDays(new Date(expiry_date), new Date());
    if (days < 0) return "bg-red-100 text-red-800";
    if (days <= 30) return "bg-orange-100 text-orange-800";
    if (days <= 90) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const canAct = isAdmin || isManager;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-700">الأصناف الراكدة</h3>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1">
          <Plus className="w-4 h-4" /> إضافة صنف راكد
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute right-2 top-2 w-4 h-4 text-gray-400" />
          <Input className="pr-7" placeholder="بحث باسم الصنف..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="absolute left-2 top-2" onClick={() => setSearch("")}><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="الكل">كل الفروع</SelectItem>
            {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="month" className="w-36" placeholder="من" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        <Input type="month" className="w-36" placeholder="إلى" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        {(filterBranch !== "الكل" || filterFrom || filterTo) && (
          <Button size="sm" variant="ghost" className="text-gray-400 text-xs" onClick={() => { setFilterBranch("الكل"); setFilterFrom(""); setFilterTo(""); }}>
            <X className="w-3 h-3" /> مسح
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-right">اسم الصنف</th>
              <th className="px-3 py-2 text-right">الفرع</th>
              <th className="px-3 py-2 text-right">العدد</th>
              <th className="px-3 py-2 text-right">السعر</th>
              <th className="px-3 py-2 text-right">تاريخ الصلاحية</th>
              {canAct && <th className="px-3 py-2 text-right">إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">لا توجد أصناف راكدة</td></tr>
            )}
            {sortedItems.map(item => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{item.item_name}</td>
                <td className="px-3 py-2">{item.branch}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{item.price} ج</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getExpiryColor(item.expiry_date)}`}>
                    {format(new Date(item.expiry_date), "MM/yyyy")}
                  </span>
                </td>
                {canAct && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1"
                        onClick={() => setActionItem({ item, type: "transfer" })}>
                        <ArrowRightLeft className="w-3 h-3" /> نقل
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1 text-orange-600 border-orange-300"
                        onClick={() => setActionItem({ item, type: "expire" })}>
                        <AlertTriangle className="w-3 h-3" /> منتهي
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1 text-blue-600 border-blue-300"
                        onClick={() => setActionItem({ item, type: "return" })}>
                        <RotateCcw className="w-3 h-3" /> إرجاع
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-500"
                        onClick={() => setConfirmDeleteId(item.id)}>
                        <Trash2 className="w-3 h-3" /> حذف
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title="تأكيد الحذف"
        description="هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع عن هذا الإجراء."
        onConfirm={() => { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
        confirmLabel="حذف"
      />

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إضافة صنف راكد</DialogTitle></DialogHeader>
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
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={!!actionItem} onOpenChange={() => { setActionItem(null); setTransferBranch(""); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {actionItem?.type === "transfer" && "نقل الصنف لفرع آخر"}
              {actionItem?.type === "return" && "إرجاع الصنف للشركة"}
              {actionItem?.type === "expire" && "تحويل إلى تبويب المنتهي"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">الصنف: <strong>{actionItem?.item?.item_name}</strong></p>
            {actionItem?.type === "transfer" && (
              <>
                <p className="text-sm text-gray-500">الفرع الحالي: {actionItem?.item?.branch}</p>
                <Select value={transferBranch} onValueChange={setTransferBranch}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع المستقبل" /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.filter(b => b !== actionItem?.item?.branch).map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {actionItem?.type === "return" && (
              <p className="text-sm text-gray-500">سيتم تسجيل هذا الصنف كمرتجع للشركة.</p>
            )}
            {actionItem?.type === "expire" && (
              <p className="text-sm text-gray-500">سيتم نقل هذا الصنف إلى تبويب الأكسبير (المنتهي).</p>
            )}
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={actionItem?.type === "transfer" ? handleTransfer : actionItem?.type === "return" ? handleReturn : handleToExpired}
              disabled={updateMutation.isPending || (actionItem?.type === "transfer" && !transferBranch)}>
              تأكيد
            </Button>
            <Button variant="outline" onClick={() => { setActionItem(null); setTransferBranch(""); }}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}