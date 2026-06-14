import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Circle, PackageSearch, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const BRANCHES = ["دواء شكري", "دواء الشامي"];

const emptyForm = {
  product_name: "",
  product_code: "",
  branch: "دواء شكري",
  requested_quantity: "",
  actual_balance: "",
  notes: "",
};

export default function ReplenishmentList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterOrdered, setFilterOrdered] = useState("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["replenishment-orders"],
    queryFn: () => base44.entities.ReplenishmentOrder.list("-created_date", 300),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ReplenishmentOrder.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replenishment-orders"] });
      setShowForm(false);
      setForm(emptyForm);
      toast({ description: "تمت إضافة الصنف بنجاح" });
    },
  });

  const toggleOrdered = useMutation({
    mutationFn: ({ id, is_ordered }) =>
      base44.entities.ReplenishmentOrder.update(id, { is_ordered }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["replenishment-orders"] }),
  });

  // دورة الحالات: null/false → "نواقص" → true → null/false
  const cycleStatus = (item) => {
    let next;
    if (!item.is_ordered || item.is_ordered === false) next = "نواقص";
    else if (item.is_ordered === "نواقص") next = true;
    else next = false;
    toggleOrdered.mutate({ id: item.id, is_ordered: next });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReplenishmentOrder.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replenishment-orders"] });
      toast({ description: "تم حذف الصنف" });
    },
  });

  const handleSubmit = () => {
    if (!form.product_name || !form.requested_quantity) return;
    createMutation.mutate({
      ...form,
      requested_quantity: parseFloat(form.requested_quantity) || 0,
      actual_balance: parseFloat(form.actual_balance) || 0,
      added_at: new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    });
  };

  const filtered = items.filter((item) => {
    if (filterBranch !== "all" && item.branch !== filterBranch) return false;
    if (filterOrdered === "ordered" && item.is_ordered !== true) return false;
    if (filterOrdered === "pending" && item.is_ordered) return false;
    if (filterOrdered === "shortage" && item.is_ordered !== "نواقص") return false;
    return true;
  });

  const orderedCount = items.filter((i) => i.is_ordered === true).length;
  const shortageCount = items.filter((i) => i.is_ordered === "نواقص").length;
  const pendingCount = items.filter((i) => !i.is_ordered || i.is_ordered === false).length;

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
            <PackageSearch className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">قائمة الطلبات المطلوبة</h2>
            <p className="text-xs text-gray-500">
              <span className="text-orange-600 font-semibold">{pendingCount}</span> لم يُطلب •{" "}
              <span className="text-amber-600 font-semibold">{shortageCount}</span> نواقص •{" "}
              <span className="text-emerald-600 font-semibold">{orderedCount}</span> تم الطلب
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm">
          <Plus className="w-4 h-4" /> إضافة صنف
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {["all", ...BRANCHES].map((b) => (
          <button
            key={b}
            onClick={() => setFilterBranch(b)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterBranch === b
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {b === "all" ? "كل الفروع" : b}
          </button>
        ))}
        <div className="h-4 w-px bg-gray-200 mx-1" />
        {[
          { id: "all", label: "الكل" },
          { id: "pending", label: "⏳ لم يُطلب" },
          { id: "shortage", label: "⚠️ نواقص" },
          { id: "ordered", label: "✅ تم الطلب" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterOrdered(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterOrdered === f.id
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-4 py-3 text-right font-medium">اسم الصنف</th>
                <th className="px-4 py-3 text-right font-medium">الكود</th>
                <th className="px-4 py-3 text-right font-medium">الفرع</th>
                <th className="px-4 py-3 text-center font-medium">الرصيد الفعلي</th>
                <th className="px-4 py-3 text-center font-medium">الكمية المطلوبة</th>
                <th className="px-4 py-3 text-center font-medium">تم الطلب؟</th>
                <th className="px-4 py-3 text-center font-medium">ملاحظات</th>
                <th className="px-4 py-3 text-center font-medium text-gray-400">وقت الإضافة</th>
                <th className="px-4 py-3 text-center font-medium">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 transition-colors ${item.is_ordered === true ? "bg-emerald-50/40" : item.is_ordered === "نواقص" ? "bg-amber-50/40" : ""}`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800">{item.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{item.product_code || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{item.branch}</td>
                  <td className="px-4 py-2.5 text-center text-gray-700">{item.actual_balance ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-blue-700">{item.requested_quantity}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => cycleStatus(item)}
                      className="flex items-center gap-1.5 mx-auto text-xs font-medium transition-colors"
                      title="اضغط للتغيير"
                    >
                      {item.is_ordered === true ? (
                        <><CheckCircle2 className="w-5 h-5 text-emerald-500" /><span className="text-emerald-600">تم</span></>
                      ) : item.is_ordered === "نواقص" ? (
                        <><AlertCircle className="w-5 h-5 text-amber-500" /><span className="text-amber-600">نواقص</span></>
                      ) : (
                        <><Circle className="w-5 h-5 text-gray-300" /><span className="text-gray-400">لا</span></>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-gray-500">{item.notes || "—"}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-gray-400 whitespace-nowrap">{item.added_at || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    لا توجد أصناف مضافة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة صنف مطلوب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">اسم الصنف *</label>
              <Input
                value={form.product_name}
                onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                placeholder="اسم الصنف"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">كود الصنف</label>
              <Input
                value={form.product_code}
                onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))}
                placeholder="اختياري"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">الفرع *</label>
              <Select value={form.branch} onValueChange={(v) => setForm((f) => ({ ...f, branch: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">الرصيد الفعلي</label>
                <Input
                  type="number"
                  min="0"
                  value={form.actual_balance}
                  onChange={(e) => setForm((f) => ({ ...f, actual_balance: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">الكمية المطلوبة *</label>
                <Input
                  type="number"
                  min="1"
                  value={form.requested_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, requested_quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">ملاحظات</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="اختياري"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button
              disabled={!form.product_name || !form.requested_quantity || createMutation.isPending}
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}