import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2, Edit2, ZoomIn, CheckCircle, Phone, MessageCircle, Search, Package, Truck, XCircle, Ban, RotateCcw, AlertTriangle } from "lucide-react";
import OrderFormDialog from "./OrderFormDialog";

const STATUS_STYLE = {
  "طلب جديد": "bg-blue-100 text-blue-700 border-blue-200",
  "جاري البحث": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "النواقص": "bg-purple-100 text-purple-700 border-purple-200",
  "تم توفير الصنف": "bg-teal-100 text-teal-700 border-teal-200",
  "تم التوصيل": "bg-green-100 text-green-700 border-green-200",
  "الصنف غير متوفر حاليا": "bg-orange-100 text-orange-700 border-orange-200",
  "تم الإلغاء": "bg-red-100 text-red-700 border-red-200",
};

const CANCEL_REASONS = ["السعر غير مناسب", "تأخر الرد", "العميل كان يسأل فقط", "وجده في مكان آخر", "أخرى"];

export default function OrderDetailDialog({ open, onOpenChange, order, teamMembers = [], isManager, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [searchForm, setSearchForm] = useState({
    supplier_found: order.supplier_found || "",
    purchase_price: order.purchase_price || "",
    selling_price: order.selling_price || "",
    search_notes: order.search_notes || "",
    expected_availability_date: order.expected_availability_date || "",
    last_followup_date: order.last_followup_date || "",
  });
  const [availableForm, setAvailableForm] = useState({
    customer_contacted: order.customer_contacted || false,
    contact_method: order.contact_method || "",
    followup_notes: order.followup_notes || "",
  });
  const [cancelReason, setCancelReason] = useState(order.cancellation_reason || "");
  const [note, setNote] = useState("");

  const updateOrder = async (updates, newStatus, timelineNote) => {
    setSaving(true);
    const user = await base44.auth.me();
    const userName = user?.full_name || user?.email || "مجهول";
    const timeline = [...(order.timeline || []), {
      status: newStatus || order.status,
      by: userName,
      at: new Date().toISOString(),
      note: timelineNote || note || "",
    }];
    const updated = { ...updates, timeline };
    if (newStatus) updated.status = newStatus;
    await base44.entities.CustomerOrder.update(order.id, updated);
    setSaving(false);
    onUpdated?.({ ...order, ...updated });
    setNote("");
  };

  const getSearchData = () => ({
    ...searchForm,
    purchase_price: searchForm.purchase_price !== "" ? Number(searchForm.purchase_price) : undefined,
    selling_price: searchForm.selling_price !== "" ? Number(searchForm.selling_price) : undefined,
  });

  const handleMoveToSearch = () => updateOrder(getSearchData(), "جاري البحث", "تم نقل الطلب لمرحلة البحث");
  const handleSaveSearch = () => updateOrder(getSearchData(), null, "تم تحديث بيانات البحث");
  const handleMoveToShortage = () => updateOrder(getSearchData(), "النواقص", "تم نقل الطلب لقائمة النواقص");
  const handleMoveToAvailable = () => updateOrder({ ...availableForm, product_available: true }, "تم توفير الصنف", "تم توفير الصنف");
  const handleDeliver = () => updateOrder({}, "تم التوصيل", "تم التسليم للعميل");
  const handleUnavailable = () => updateOrder({}, "الصنف غير متوفر حاليا", "الصنف غير متوفر حاليا");
  const handleCancel = () => updateOrder({ cancellation_reason: cancelReason }, "تم الإلغاء", `إلغاء: ${cancelReason}`);
  const handleRestore = (newStatus) => updateOrder({ cancellation_reason: "" }, newStatus, `استعادة الطلب إلى: ${newStatus}`);

  const cfg = STATUS_STYLE[order.status] || "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="text-teal-700">طلب #{order.order_number || order.id?.slice(-6)}</DialogTitle>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cfg}`}>{order.status}</span>
                {isManager && (
                  <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} className="gap-1 h-7 text-xs">
                    <Edit2 className="w-3 h-3" /> تعديل
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            {/* Customer Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
              <Info label="اسم العميل" value={order.customer_name} />
              <Info label="الهاتف" value={order.phone} />
              {order.customer_code && <Info label="كود العميل" value={order.customer_code} />}
              <Info label="الصنف" value={order.product_name} bold />
              <Info label="الأولوية" value={order.priority} />
              <Info label="الفرع" value={order.branch} />
              <Info label="مصدر الطلب" value={order.request_source} />
              {order.assigned_employee && <Info label="الموظف" value={order.assigned_employee} />}
              <Info label="التاريخ" value={order.request_date || (order.created_date ? new Date(order.created_date).toLocaleDateString("ar-EG") : "—")} />
            </div>

            {order.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>ملاحظات:</strong> {order.notes}
              </div>
            )}

            {/* Product Image */}
            {order.product_image && (
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-2">صورة الصنف</h4>
                <div className="relative inline-block cursor-pointer" onClick={() => setLightbox(order.product_image)}>
                  <img src={order.product_image} alt="صنف" className="h-28 w-28 object-cover rounded-xl border hover:opacity-80 transition-opacity" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 rounded-xl flex items-center justify-center transition-colors">
                    <ZoomIn className="w-5 h-5 text-white opacity-0 hover:opacity-100" />
                  </div>
                </div>
              </div>
            )}

            {/* Stage: جاري البحث */}
            {(order.status === "جاري البحث" || order.supplier_found) && (
              <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                  <Search className="w-4 h-4" /> مرحلة البحث
                </h4>
                {isManager ? (
                  <div className="space-y-3">
                    <FieldInput label="المورد / مكان التوفير" value={searchForm.supplier_found} onChange={(v) => setSearchForm(p => ({ ...p, supplier_found: v }))} />
                    <FieldInput label="ملاحظات" value={searchForm.search_notes} onChange={(v) => setSearchForm(p => ({ ...p, search_notes: v }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput label="سعر الشراء" type="number" value={searchForm.purchase_price} onChange={(v) => setSearchForm(p => ({ ...p, purchase_price: v }))} />
                      <FieldInput label="سعر البيع" type="number" value={searchForm.selling_price} onChange={(v) => setSearchForm(p => ({ ...p, selling_price: v }))} />
                      <FieldInput label="تاريخ التوفر المتوقع" type="date" value={searchForm.expected_availability_date} onChange={(v) => setSearchForm(p => ({ ...p, expected_availability_date: v }))} />
                      <FieldInput label="آخر متابعة" type="date" value={searchForm.last_followup_date} onChange={(v) => setSearchForm(p => ({ ...p, last_followup_date: v }))} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {order.supplier_found && <Info label="المورد" value={order.supplier_found} />}
                    {order.purchase_price && <Info label="سعر الشراء" value={order.purchase_price} />}
                    {order.selling_price && <Info label="سعر البيع" value={order.selling_price} />}
                    {order.search_notes && <Info label="ملاحظات" value={order.search_notes} />}
                  </div>
                )}
              </div>
            )}

            {/* Stage: النواقص */}
            {order.status === "النواقص" && (
              <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> صنف في قائمة النواقص
                </h4>
                <p className="text-xs text-purple-600">هذا الصنف مُدرج في قائمة النواقص — في انتظار التوفير أو الترتيب مع المورد.</p>
                {order.search_notes && <Info label="ملاحظات البحث" value={order.search_notes} />}
                {order.supplier_found && <Info label="المورد" value={order.supplier_found} />}
              </div>
            )}

            {/* Stage: تم توفير الصنف */}
            {(order.status === "تم توفير الصنف" || order.product_available) && (
              <div className="border border-teal-200 bg-teal-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-teal-800 flex items-center gap-2">
                  <Package className="w-4 h-4" /> الصنف متوفر
                </h4>
                {isManager ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-teal-700 flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={availableForm.customer_contacted} onChange={(e) => setAvailableForm(p => ({ ...p, customer_contacted: e.target.checked }))} className="w-4 h-4" />
                        تم التواصل مع العميل؟
                      </label>
                    </div>
                    {availableForm.customer_contacted && (
                      <Select value={availableForm.contact_method} onValueChange={(v) => setAvailableForm(p => ({ ...p, contact_method: v }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="طريقة التواصل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="واتساب">واتساب</SelectItem>
                          <SelectItem value="مكالمة هاتفية">مكالمة هاتفية</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <FieldInput label="ملاحظات المتابعة" value={availableForm.followup_notes} onChange={(v) => setAvailableForm(p => ({ ...p, followup_notes: v }))} />
                  </div>
                ) : (
                  <div className="text-sm space-y-1">
                    <Info label="تم التواصل" value={order.customer_contacted ? "نعم" : "لا"} />
                    {order.contact_method && <Info label="طريقة التواصل" value={order.contact_method} />}
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            {order.timeline?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">سجل الطلب</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {[...(order.timeline || [])].reverse().map((t, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs bg-gray-50 rounded-lg p-2.5">
                      <span className={`px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${STATUS_STYLE[t.status] || "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                      <div className="flex-1">
                        <span className="font-medium text-gray-700">{t.by}</span>
                        {t.note && <span className="text-gray-500"> — {t.note}</span>}
                      </div>
                      <span className="text-gray-400 whitespace-nowrap">{t.at ? new Date(t.at).toLocaleDateString("ar-EG") : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isManager && (
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">ملاحظة (اختياري)</label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة على الإجراء..." className="h-8 text-sm" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.status === "طلب جديد" && (
                    <Button size="sm" onClick={handleMoveToSearch} disabled={saving} className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} بدء البحث
                    </Button>
                  )}
                  {order.status === "جاري البحث" && (
                    <>
                      <Button size="sm" onClick={handleSaveSearch} disabled={saving} variant="outline" className="gap-1.5 border-yellow-300 text-yellow-700">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} حفظ بيانات البحث
                      </Button>
                      <Button size="sm" onClick={handleMoveToAvailable} disabled={saving} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
                        <Package className="w-3.5 h-3.5" /> تم توفير الصنف
                      </Button>
                      <Button size="sm" onClick={handleDeliver} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                        <Truck className="w-3.5 h-3.5" /> تم التوصيل
                      </Button>
                      <Button size="sm" onClick={handleMoveToShortage} disabled={saving} variant="outline" className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50">
                        <AlertTriangle className="w-3.5 h-3.5" /> نقل للنواقص
                      </Button>
                    </>
                  )}
                  {order.status === "النواقص" && (
                    <>
                      <Button size="sm" onClick={handleMoveToAvailable} disabled={saving} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
                        <Package className="w-3.5 h-3.5" /> تم توفير الصنف
                      </Button>
                      <Button size="sm" onClick={handleDeliver} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                        <Truck className="w-3.5 h-3.5" /> تم التوصيل
                      </Button>
                      <Button size="sm" onClick={handleMoveToSearch} disabled={saving} variant="outline" className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50">
                        <Search className="w-3.5 h-3.5" /> رجوع لجاري البحث
                      </Button>
                    </>
                  )}
                  {order.status === "تم توفير الصنف" && (
                    <>
                      <Button size="sm" onClick={handleDeliver} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                        <Truck className="w-3.5 h-3.5" /> تم التوصيل
                      </Button>
                      <Button size="sm" onClick={handleUnavailable} disabled={saving} variant="outline" className="gap-1.5 border-orange-300 text-orange-600">
                        <XCircle className="w-3.5 h-3.5" /> غير متوفر حاليًا
                      </Button>
                    </>
                  )}
                  {!["تم التوصيل", "تم الإلغاء", "النواقص"].includes(order.status) && (
                    <div className="flex items-center gap-2">
                      <Select value={cancelReason} onValueChange={setCancelReason}>
                        <SelectTrigger className="h-8 w-44 text-xs border-red-200 text-red-600"><SelectValue placeholder="سبب الإلغاء" /></SelectTrigger>
                        <SelectContent>{CANCEL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleCancel} disabled={saving || !cancelReason} variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50">
                        <Ban className="w-3.5 h-3.5" /> إلغاء
                      </Button>
                    </div>
                  )}

                  {/* Cancel button for النواقص */}
                  {order.status === "النواقص" && (
                    <div className="flex items-center gap-2">
                      <Select value={cancelReason} onValueChange={setCancelReason}>
                        <SelectTrigger className="h-8 w-44 text-xs border-red-200 text-red-600"><SelectValue placeholder="سبب الإلغاء" /></SelectTrigger>
                        <SelectContent>{CANCEL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleCancel} disabled={saving || !cancelReason} variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50">
                        <Ban className="w-3.5 h-3.5" /> إلغاء
                      </Button>
                    </div>
                  )}

                  {/* Restore from cancelled or unavailable */}
                  {["تم الإلغاء", "الصنف غير متوفر حاليا"].includes(order.status) && (
                    <div className="w-full border-t pt-3 mt-1">
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> استعادة الطلب إلى:</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => handleRestore("طلب جديد")} disabled={saving} variant="outline" className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50">
                          طلب جديد
                        </Button>
                        <Button size="sm" onClick={() => handleRestore("جاري البحث")} disabled={saving} variant="outline" className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50">
                          جاري البحث
                        </Button>
                        <Button size="sm" onClick={() => handleRestore("تم التوصيل")} disabled={saving} variant="outline" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50">
                          تم التوصيل
                        </Button>
                        <Button size="sm" onClick={() => handleRestore("الصنف غير متوفر حاليا")} disabled={saving || order.status === "الصنف غير متوفر حاليا"} variant="outline" className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50">
                          في انتظار التوافر
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showEdit && (
        <OrderFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          editOrder={order}
          teamMembers={teamMembers}
          onSaved={() => { setShowEdit(false); onUpdated?.({ ...order }); }}
        />
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="صنف" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 left-4 text-white text-2xl font-bold" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </>
  );
}

function Info({ label, value, bold }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm mt-0.5 ${bold ? "font-bold text-teal-700" : "font-medium text-gray-800"}`}>{value || "—"}</div>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text" }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}