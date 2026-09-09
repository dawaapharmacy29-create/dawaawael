import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, Plus, Pencil, Trash2, AlertCircle, CheckCircle2, ShieldAlert, Settings2, ClipboardList, Sparkles, History } from "lucide-react";
import { useUserRole } from "@/lib/useUserRole";

const MONTH_NAMES = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};
const monthLabel = (ym) => ym ? `${MONTH_NAMES[ym.split("-")[1]]} ${ym.split("-")[0]}` : "";
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const prevMonthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmt = (n) => (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });

const emptyOneTimeForm = { name: "", month: "", amount: "", notes: "" };

/**
 * صفحة مصروفات إدارية مستقلة تماماً لفرع واحد — تُستخدم من صفحتَي
 * AdminExpensesShokry و AdminExpensesShami، كل واحدة بتمرر branch الخاص بيها.
 */
export default function BranchAdminExpenses({ branch, accentColor = "text-teal-600" }) {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [tab, setTab] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(monthsAgo(0));
  const [amountDrafts, setAmountDrafts] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({ name: "", notes: "", start_month: "" });
  const [oneTimeDialogOpen, setOneTimeDialogOpen] = useState(false);
  const [editingOneTime, setEditingOneTime] = useState(null);
  const [oneTimeForm, setOneTimeForm] = useState(emptyOneTimeForm);

  const { data: allItems = [] } = useQuery({
    queryKey: ["admin-expense-items"],
    queryFn: () => base44.entities.AdminExpenseItem.list("sort_order"),
  });
  const { data: allRecords = [] } = useQuery({
    queryKey: ["admin-expense-records"],
    queryFn: () => base44.entities.AdminExpenseRecord.list(),
  });
  const { data: allOneTime = [] } = useQuery({
    queryKey: ["admin-one-time-expenses"],
    queryFn: () => base44.entities.AdminOneTimeExpense.list("-month"),
  });

  const items = useMemo(() => allItems.filter((i) => i.branch === branch && i.is_active !== false), [allItems, branch]);
  const records = useMemo(() => allRecords.filter((r) => r.branch === branch), [allRecords, branch]);
  const oneTimeExpenses = useMemo(() => allOneTime.filter((e) => e.branch === branch), [allOneTime, branch]);

  const recordFor = (itemId, month) => records.find((r) => r.item_id === itemId && r.month === month);

  const saveMutation = useMutation({
    mutationFn: async ({ item, month, amount }) => {
      const existing = recordFor(item.id, month);
      if (existing) return base44.entities.AdminExpenseRecord.update(existing.id, { amount });
      return base44.entities.AdminExpenseRecord.create({ branch, item_id: item.id, item_name: item.name, month, amount });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-expense-records"] }),
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const payload = { branch, name: itemForm.name, notes: itemForm.notes, start_month: itemForm.start_month || "" };
      if (editingItem) return base44.entities.AdminExpenseItem.update(editingItem.id, payload);
      return base44.entities.AdminExpenseItem.create({ ...payload, sort_order: items.length });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-expense-items"] });
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemForm({ name: "", notes: "", start_month: "" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.AdminExpenseItem.update(id, { is_active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-expense-items"] }),
  });

  const saveOneTimeMutation = useMutation({
    mutationFn: async () => {
      const payload = { branch, name: oneTimeForm.name, month: oneTimeForm.month, amount: Number(oneTimeForm.amount) || 0, notes: oneTimeForm.notes };
      if (editingOneTime) return base44.entities.AdminOneTimeExpense.update(editingOneTime.id, payload);
      return base44.entities.AdminOneTimeExpense.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-one-time-expenses"] });
      setOneTimeDialogOpen(false);
      setEditingOneTime(null);
      setOneTimeForm(emptyOneTimeForm);
    },
  });

  const deleteOneTimeMutation = useMutation({
    mutationFn: (id) => base44.entities.AdminOneTimeExpense.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-one-time-expenses"] }),
  });

  const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => monthsAgo(5 - i)), []);
  const monthOptions = last6Months.map((m, i) => ({
    value: m,
    label: i === 5 ? "الشهر الحالي" : i === 4 ? "الشهر السابق" : monthLabel(m),
  })).reverse();

  const handleCommit = (item) => {
    const key = `${item.id}_${selectedMonth}`;
    const draft = amountDrafts[key];
    if (draft === undefined || draft === "") { setEditingKey(null); return; }
    saveMutation.mutate({ item, month: selectedMonth, amount: Number(draft) || 0 });
    setEditingKey(null);
  };

  const startEditing = (item) => {
    const key = `${item.id}_${selectedMonth}`;
    const rec = recordFor(item.id, selectedMonth);
    setAmountDrafts((d) => ({ ...d, [key]: rec ? rec.amount : "" }));
    setEditingKey(key);
  };

  // نسخ رقم الشهر السابق تلقائياً في خانة التسجيل — مع إمكانية التعديل قبل التأكيد
  const copyFromPrev = (item) => {
    const key = `${item.id}_${selectedMonth}`;
    const prevRec = recordFor(item.id, prevMonthOf(selectedMonth));
    if (!prevRec) return;
    setAmountDrafts((d) => ({ ...d, [key]: prevRec.amount }));
    setEditingKey(key);
  };

  const openNewOneTime = () => {
    setEditingOneTime(null);
    setOneTimeForm({ ...emptyOneTimeForm, month: selectedMonth });
    setOneTimeDialogOpen(true);
  };
  const openEditOneTime = (e) => {
    setEditingOneTime(e);
    setOneTimeForm({ name: e.name, month: e.month, amount: String(e.amount || ""), notes: e.notes || "" });
    setOneTimeDialogOpen(true);
  };

  const visibleItemsForMonth = useMemo(
    () => items.filter((i) => (i.start_month ? selectedMonth >= i.start_month : true)),
    [items, selectedMonth]
  );
  const oneTimeForSelectedMonth = useMemo(
    () => oneTimeExpenses.filter((e) => e.month === selectedMonth),
    [oneTimeExpenses, selectedMonth]
  );

  const monthTotal = useMemo(
    () => items.reduce((s, it) => s + (recordFor(it.id, selectedMonth)?.amount || 0), 0)
      + oneTimeForSelectedMonth.reduce((s, e) => s + (e.amount || 0), 0),
    [items, records, selectedMonth, oneTimeForSelectedMonth]
  );

  const totalTrend = useMemo(
    () => last6Months.map((m) => ({
      month: monthLabel(m),
      total: items.reduce((s, it) => s + (recordFor(it.id, m)?.amount || 0), 0)
        + oneTimeExpenses.filter((e) => e.month === m).reduce((s, e) => s + (e.amount || 0), 0),
    })),
    [items, records, oneTimeExpenses, last6Months]
  );

  const bigOneTimeExpenses = useMemo(
    () => oneTimeExpenses.filter((e) => (e.amount || 0) > 50000).sort((a, b) => b.month.localeCompare(a.month)),
    [oneTimeExpenses]
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4" dir="rtl">
        <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">هذه الصفحة مخصصة للمدير فقط</h2>
          <p className="text-gray-500 mt-1 text-sm">ليس لديك صلاحية للوصول إلى المصروفات الإدارية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      <div>
        <h1 className={`text-2xl font-bold flex items-center gap-2 ${accentColor}`}>
          <Wallet className="w-6 h-6" /> المصروفات الإدارية — {branch}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">نظام مصروفات مستقل بالكامل عن باقي الفروع — رواتب، إيجارات، دعاية...</p>
      </div>

      <div className="flex gap-1 border-b">
        <button onClick={() => setTab("monthly")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "monthly" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <ClipboardList className="w-4 h-4" /> التسجيل الشهري
        </button>
        <button onClick={() => setTab("items")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "items" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Settings2 className="w-4 h-4" /> بنود المصروفات
        </button>
      </div>

      {tab === "items" ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">البنود هنا كلها بنود شهرية متكررة خاصة بـ{branch}. لإضافة مصروف لمرة واحدة استخدم زرار "مصروف لمرة واحدة" من تبويب التسجيل الشهري.</p>
          <Button onClick={() => { setEditingItem(null); setItemForm({ name: "", notes: "", start_month: "" }); setItemDialogOpen(true); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Plus className="w-4 h-4" /> بند جديد
          </Button>
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl">لا توجد بنود بعد.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-white border rounded-xl px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      {item.start_month ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">متكرر من {monthLabel(item.start_month)}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">متكرر شهرياً</span>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600" onClick={() => { setEditingItem(item); setItemForm({ name: item.name, notes: item.notes || "", start_month: item.start_month || "" }); setItemDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => { if (confirm("حذف البند؟")) deleteItemMutation.mutate(item.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
                {monthOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setSelectedMonth(opt.value)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${selectedMonth === opt.value ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {opt.label} <span className="opacity-60">({monthLabel(opt.value)})</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">أو شهر آخر:</span>
                <input type="month" value={selectedMonth} onChange={(e) => e.target.value && setSelectedMonth(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white" />
              </div>
            </div>
            <Button onClick={openNewOneTime} variant="outline" className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50">
              <Sparkles className="w-4 h-4" /> مصروف لمرة واحدة
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border border-dashed rounded-xl">
              لا توجد بنود مصروفات بعد لـ{branch}. أضفها من تبويب "بنود المصروفات".
            </div>
          ) : (
            <>
              <div className={`rounded-2xl p-5 text-white flex items-center justify-between ${branch === "دواء شكري" ? "bg-gradient-to-br from-blue-600 to-blue-700" : "bg-gradient-to-br from-purple-600 to-purple-700"}`}>
                <div>
                  <p className="text-white/80 text-sm">إجمالي مصروفات {monthLabel(selectedMonth)} — {branch}</p>
                  <p className="text-3xl font-extrabold mt-1">{fmt(monthTotal)} <span className="text-base font-normal text-white/80">ج.م</span></p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Wallet className="w-7 h-7" />
                </div>
              </div>

              {visibleItemsForMonth.length === 0 ? (
                <div className="text-center py-10 text-gray-400 border border-dashed rounded-xl text-sm">
                  لا توجد بنود مطلوب تسجيلها في شهر {monthLabel(selectedMonth)}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleItemsForMonth.map((item) => {
                    const rec = recordFor(item.id, selectedMonth);
                    const isMissing = !rec;
                    const key = `${item.id}_${selectedMonth}`;
                    const isEditing = editingKey === key;
                    const draftValue = amountDrafts[key] ?? "";
                    const sharePct = rec && monthTotal > 0 ? (rec.amount / monthTotal) * 100 : null;
                    const prevRec = recordFor(item.id, prevMonthOf(selectedMonth));
                    return (
                      <div key={item.id} className={`rounded-2xl p-4 border-2 transition-colors ${isMissing ? "border-red-400 bg-red-50/50" : "border-emerald-200 bg-emerald-50/40"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                          {isMissing ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-red-600"><AlertCircle className="w-3.5 h-3.5" /> غير مسجّل</span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> مسجّل</span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input type="number" autoFocus value={draftValue} onChange={(e) => setAmountDrafts((d) => ({ ...d, [key]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") handleCommit(item); if (e.key === "Escape") setEditingKey(null); }} placeholder="0" className="bg-white" />
                            <span className="text-xs text-gray-400 shrink-0">ج.م</span>
                            <Button size="sm" onClick={() => handleCommit(item)} disabled={saveMutation.isPending} className="h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-lg font-bold ${isMissing ? "text-gray-300" : "text-gray-800"}`}>
                                {isMissing ? "—" : fmt(rec.amount)} <span className="text-xs font-normal text-gray-400">ج.م</span>
                              </p>
                              {sharePct !== null && <p className="text-[11px] text-teal-600 font-semibold mt-0.5">{sharePct.toFixed(1)}% من إجمالي الشهر</p>}
                              {isMissing && prevRec ? (
                                <button onClick={() => copyFromPrev(item)}
                                  className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors">
                                  <History className="w-3 h-3" /> زي الشهر السابق ({fmt(prevRec.amount)} ج.م)
                                </button>
                              ) : null}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => startEditing(item)} className="h-9 w-9 p-0 border-gray-300">
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" /> مصروفات لمرة واحدة — {monthLabel(selectedMonth)}
                </h3>
                {oneTimeForSelectedMonth.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl text-sm">لا توجد مصروفات لمرة واحدة مسجّلة في هذا الشهر.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {oneTimeForSelectedMonth.map((e) => (
                      <div key={e.id} className="rounded-2xl p-4 border-2 border-violet-200 bg-violet-50/50">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-gray-800 text-sm">{e.name}</p>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" onClick={() => openEditOneTime(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm("حذف المصروف؟")) deleteOneTimeMutation.mutate(e.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <p className="text-xl font-extrabold text-violet-700 mt-1">{fmt(e.amount)} <span className="text-xs font-normal text-gray-400">ج.م</span></p>
                        {e.notes && <p className="text-[11px] text-gray-400 mt-1">{e.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border p-4">
                <h3 className="font-bold text-gray-700 text-sm mb-3">إجمالي المصروفات الإدارية — آخر 6 أشهر</h3>
                <div className="space-y-1.5">
                  {totalTrend.map((t) => (
                    <div key={t.month} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-500">{t.month}</span>
                      <span className="font-bold text-teal-700">{fmt(t.total)} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-600" /> مصروفات كبيرة لمرة واحدة (أكبر من 50,000 ج.م)
                </h3>
                {bigOneTimeExpenses.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl text-sm">لا توجد مصروفات من نوع "مرة واحدة" بمبلغ أكبر من 50 ألف جنيه حتى الآن.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bigOneTimeExpenses.map((e) => (
                      <div key={e.id} className="rounded-2xl p-4 border-2 border-violet-200 bg-violet-50/50">
                        <p className="font-bold text-gray-800 text-sm">{e.name}</p>
                        <p className="text-xl font-extrabold text-violet-700 mt-1">{fmt(e.amount)} <span className="text-xs font-normal text-gray-400">ج.م</span></p>
                        <p className="text-[11px] text-gray-400 mt-1">تم التسجيل في: {monthLabel(e.month)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>{editingItem ? "تعديل بند" : "بند شهري جديد"} — {branch}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم البند *</label>
              <Input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: الرواتب، الإيجارات، الدعاية..." />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">يبدأ من شهر (اختياري)</label>
              <input type="month" value={itemForm.start_month} onChange={(e) => setItemForm((f) => ({ ...f, start_month: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
              <p className="text-[11px] text-gray-400 mt-1">
                {itemForm.start_month
                  ? `هيظهر البند من شهر ${monthLabel(itemForm.start_month)} ويستمر تلقائياً في كل الشهور التالية.`
                  : "اتركها فارغة لو البند مطلوب في كل الشهور بلا استثناء."}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ملاحظات (اختياري)</label>
              <Input value={itemForm.notes} onChange={(e) => setItemForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button className="bg-teal-600 hover:bg-teal-700" disabled={!itemForm.name.trim() || saveItemMutation.isPending} onClick={() => saveItemMutation.mutate()}>
              {saveItemMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={oneTimeDialogOpen} onOpenChange={setOneTimeDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>{editingOneTime ? "تعديل مصروف لمرة واحدة" : "إضافة مصروف إداري لمرة واحدة"} — {branch}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم المصروف *</label>
              <Input value={oneTimeForm.name} onChange={(e) => setOneTimeForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: الأضحية، توزيع الأرباح..." />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الشهر *</label>
              <input type="month" value={oneTimeForm.month} onChange={(e) => setOneTimeForm((f) => ({ ...f, month: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">المبلغ *</label>
              <Input type="number" value={oneTimeForm.amount} onChange={(e) => setOneTimeForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ملاحظات (اختياري)</label>
              <Input value={oneTimeForm.notes} onChange={(e) => setOneTimeForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button className="bg-violet-600 hover:bg-violet-700" disabled={!oneTimeForm.name.trim() || !oneTimeForm.month || !oneTimeForm.amount || saveOneTimeMutation.isPending} onClick={() => saveOneTimeMutation.mutate()}>
              {saveOneTimeMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setOneTimeDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}