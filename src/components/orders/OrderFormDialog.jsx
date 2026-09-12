import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Upload, X } from "lucide-react";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const SOURCES = ["واتساب", "مكالمة هاتفية", "داخل الصيدلية"];
const PRIORITIES = ["عاجل", "متوسط", "عادي"];

export default function OrderFormDialog({ open, onOpenChange, teamMembers = [], onSaved, editOrder = null }) {
  const [form, setForm] = useState(editOrder || {
    customer_name: "",
    phone: "",
    customer_code: "",
    branch: "",
    request_source: "",
    product_name: "",
    quantity: 1,
    customer_type: "عادي",
    request_type: "عادي",
    promised_at: "",
    product_image: "",
    notes: "",
    priority: "عادي",
    assigned_employee: "",
    recorded_by: "",
    request_date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [credential, setCredential] = useState("");
  const [saveError, setSaveError] = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // الأسماء الرسمية الموحدة مع تطبيق الإدارة
  const { data: nameMap = [] } = useQuery({
    queryKey: ["employee-name-map"],
    queryFn: () => base44.entities.EmployeeNameMap.filter({ is_active: true }, "canonical_name"),
    staleTime: 60000,
  });
  const branchNames = nameMap.filter((m) => m.branch === "كل الفروع" || (!form.branch ? true : m.branch?.trim() === form.branch?.trim()));
  const nameOptions = [...new Set(branchNames.map((m) => m.canonical_name).filter(Boolean))];
  const selectedRecorder = nameMap.find((m) =>
    m.canonical_name === form.recorded_by &&
    (m.branch === "كل الفروع" || (!form.branch ? true : m.branch?.trim() === form.branch?.trim()))
  );
  const recorderNeedsVerification = !editOrder;

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("product_image", file_url);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaveError("");
    if (!form.customer_name || !form.phone || !form.product_name || !form.branch || !form.recorded_by) {
      setSaveError("يجب استكمال اسم العميل والهاتف والفرع والصنف واسم مُسجِّل الطلب");
      return;
    }
    if (!editOrder && !selectedRecorder?.admin_staff_id) {
      setSaveError("اسم مُسجِّل الطلب غير مربوط بحساب الإدارة");
      return;
    }
    if (recorderNeedsVerification && !credential) {
      setSaveError("يجب إدخال الرقم السري الخاص بمُسجِّل الطلب");
      return;
    }

    setSaving(true);
    try {
      if (!editOrder) {
        const createRes = await base44.functions.invoke("createVerifiedCustomerOrder", {
          mode: "direct_verified",
          admin_staff_id: selectedRecorder.admin_staff_id,
          credential,
          order: form,
        });
        const created = createRes?.data || {};
        if (!created.success) {
          setSaveError(created.error || "تعذر التحقق من الهوية أو حفظ الطلب");
          return;
        }
        setCredential("");
        onSaved?.();
        onOpenChange(false);
        return;
      }

      const updateRes = await base44.functions.invoke("updateCustomerOrderSafe", {
        id: editOrder.id,
        updates: {
          customer_name: form.customer_name,
          phone: form.phone,
          customer_code: form.customer_code,
          request_source: form.request_source,
          product_name: form.product_name,
          product_image: form.product_image,
          notes: form.notes,
          priority: form.priority,
          assigned_employee: form.assigned_employee,
          request_date: form.request_date,
          quantity: Math.max(1, Number(form.quantity || 1)),
          customer_type: form.customer_type,
          request_type: form.request_type,
          promised_at: form.promised_at,
        },
        timeline_note: "تعديل بيانات الطلب",
      });
      const updateResult = updateRes?.data || {};
      if (!updateResult.success) throw new Error(updateResult.error || "تعذر تعديل الطلب");
      setCredential("");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setSaveError(e?.message || "حدث خطأ أثناء حفظ الطلب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto px-4 py-5 sm:p-6" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-teal-700">{editOrder ? "تعديل الطلب" : "طلب عميل جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">اسم العميل *</label>
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="اسم العميل" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">رقم الهاتف *</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">كود العميل</label>
              <Input value={form.customer_code} onChange={(e) => set("customer_code", e.target.value)} placeholder="كود اختياري" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">الفرع</label>
              <Select value={form.branch} disabled={!!editOrder} onValueChange={(v) => { setForm((p) => ({ ...p, branch: v, recorded_by: "" })); setCredential(""); setSaveError(""); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">نوع العميل</label>
              <Select value={form.customer_type || "عادي"} onValueChange={(v) => set("customer_type", v)}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="مهم">مهم</SelectItem><SelectItem value="عادي">عادي</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">نوع الطلب</label>
              <Select value={form.request_type || "عادي"} onValueChange={(v) => set("request_type", v)}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="عادي">عادي</SelectItem><SelectItem value="نواقص">نواقص</SelectItem><SelectItem value="استفسار">استفسار</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">مصدر الطلب</label>
              <Select value={form.request_source} onValueChange={(v) => set("request_source", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="المصدر" /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">الأولوية</label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_90px] gap-3">
            <div className="space-y-1"><label className="text-xs font-medium text-gray-600">اسم الصنف *</label><Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} placeholder="اسم الدواء أو المنتج" className="h-9 text-sm" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-gray-600">الكمية</label><Input type="number" min="1" value={form.quantity || 1} onChange={(e) => set("quantity", e.target.value)} className="h-9 text-sm text-center" /></div>
          </div>

          {/* Image Upload */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">صورة الصنف</label>
            {form.product_image ? (
              <div className="relative inline-block">
                <img src={form.product_image} alt="product" className="h-24 w-24 object-cover rounded-lg border" />
                <button onClick={() => set("product_image", "")} className="absolute -top-1 -left-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-4 cursor-pointer hover:border-teal-300 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> : <Upload className="w-4 h-4 text-gray-400" />}
                <span className="text-sm text-gray-400">{uploading ? "جاري الرفع..." : "رفع صورة الصنف"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">الموظف المسؤول</label>
              <Select value={form.assigned_employee || "unassigned"} onValueChange={(v) => set("assigned_employee", v === "unassigned" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">— بدون تعيين —</SelectItem>
                  {teamMembers.filter((m) => !form.branch || (m.branches || []).includes(form.branch)).map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">تاريخ الطلب</label>
              <Input type="date" value={form.request_date} onChange={(e) => set("request_date", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">مُسجِّل الطلب (اسمك الرسمي) <span className="text-red-500">*</span></label>
            <Select value={form.recorded_by || "none"} disabled={!!editOrder} onValueChange={(v) => { set("recorded_by", v === "none" ? "" : v); setCredential(""); setSaveError(""); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر اسمك الرسمي" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>— اختر اسمك —</SelectItem>
                {nameOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {recorderNeedsVerification && form.recorded_by && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">الرقم السري لمُسجِّل الطلب <span className="text-red-500">*</span></label>
              <Input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="أدخل الرقم السري من تطبيق الإدارة"
                autoComplete="current-password"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-gray-400">لا يتم حفظ الرقم السري؛ يُستخدم فقط للتحقق من أن الاسم المختار هو الموظف الحقيقي.</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">موعد الرد أو التوفير المتوقع</label>
            <Input type="datetime-local" value={form.promised_at ? String(form.promised_at).slice(0,16) : ""} onChange={(e) => set("promised_at", e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {saveError && <p className="text-xs text-red-600 bg-red-50 rounded-md p-2">{saveError}</p>}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || !form.customer_name || !form.phone || !form.product_name || !form.branch || !form.recorded_by || (recorderNeedsVerification && !credential)} className="flex-1 bg-teal-600 hover:bg-teal-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editOrder ? "حفظ التعديلات" : "حفظ الطلب")}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}