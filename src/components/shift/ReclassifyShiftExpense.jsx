import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

export default function ReclassifyShiftExpense({ record, expenseIndex, onSaved }) {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { data: items = [], isPending, isError } = useQuery({
    queryKey: ["expense-items"],
    queryFn: () => base44.entities.ExpenseItem.list(),
    enabled: isAdmin && open,
  });
  const expense = record?.expenses?.[expenseIndex];
  if (!isAdmin || !expense || record.is_archived) return null;
  const save = async () => {
    if (saving || !category || category === expense.category) return;
    setSaving(true); setError("");
    try {
      const res = await base44.functions.invoke("updateShiftDeliveryAdmin", {
        id: record.id, action: "reclassify_expense", expense_index: expenseIndex,
        expected_expense: expense, expected_updated_date: record.updated_date || "", category,
      });
      if (!res.data?.success) throw new Error(res.data?.error || "تعذر تغيير البند");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shift-deliveries"] }),
        qc.invalidateQueries({ queryKey: ["daily-close-shifts"] }),
      ]);
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "تعذر تغيير البند");
    } finally { setSaving(false); }
  };
  return <>
    <Button size="sm" variant="outline" className="h-7 text-xs text-blue-700" onClick={() => { setCategory(expense.category || ""); setError(""); setOpen(true); }}>
      <Pencil className="w-3 h-3" /> تغيير البند
    </Button>
    <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v); }}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>تغيير بند المصروف</DialogTitle></DialogHeader>
        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
          <p>{record.branch} — {record.submitted_by}</p>
          <p>البند الحالي: {expense.category || "بدون تصنيف"}</p>
          <p>القيمة: {Number(expense.amount || 0).toLocaleString("ar-EG")} ج.م</p>
          {expense.description && <p>{expense.description}</p>}
        </div>
        <label className="text-sm">البند الجديد
          <select className="w-full h-10 border rounded-lg px-2 mt-2" value={category} onChange={e => setCategory(e.target.value)} disabled={saving || isPending}>
            <option value="">اختر البند</option>
            {items.filter(i => i.is_active !== false).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-gray-500">يتغير تصنيف هذا المصروف فقط. تظل القيمة والملاحظات وبقية بيانات التسليم كما هي.</p>
        {(error || isError) && <p role="alert" className="text-sm text-red-600">{error || "تعذر تحميل بنود المصروفات"}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>إلغاء</Button>
          <Button disabled={saving || isPending || isError || !category || category === expense.category} onClick={save}>{saving ? "جاري الحفظ..." : "تأكيد تغيير البند"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
