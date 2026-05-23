import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import {
  Loader2, Edit2, ZoomIn, CheckCircle, Search, Package, Truck,
  Ban, RotateCcw, AlertTriangle, User, Phone, MapPin, Calendar,
  ChevronRight, CheckCircle2
} from "lucide-react";
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

const CANCEL_REASONS = ["السعر غير مناسب", "العميل كان يسأل فقط", "التأخر في الرد"];

// Determine numeric stage from status
function getStage(status) {
  if (status === "طلب جديد") return 1;
  if (status === "جاري البحث" || status === "النواقص") return 2;
  if (status === "تم توفير الصنف") return 3;
  if (status === "تم التوصيل") return 4;
  return 1;
}

export default function OrderDetailDialog({ open, onOpenChange, order, teamMembers = [], isManager, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Stage 2 fields
  const [supplierName, setSupplierName] = useState(order.supplier_found || "");
  const [purchasePrice, setPurchasePrice] = useState(order.purchase_price || "");
  const [orderDone, setOrderDone] = useState(false);

  // Stage 3 fields
  const [customerContacted, setCustomerContacted] = useState(order.customer_contacted || false);
  const [contactNote, setContactNote] = useState(order.followup_notes || "");

  // Cancel
  const [showCancelPanel, setShowCancelPanel] = useState(false);
  const [cancelReason, setCancelReason] = useState(order.cancellation_reason || "");

  const isCancelled = order.status === "تم الإلغاء";
  const isDelivered = order.status === "تم التوصيل";
  const currentStage = getStage(order.status);

  const updateOrder = async (updates, newStatus, timelineNote) => {
    setSaving(true);
    const user = await base44.auth.me();
    const userName = user?.full_name || user?.email || "مجهول";
    const timeline = [...(order.timeline || []), {
      status: newStatus || order.status,
      by: userName,
      at: new Date().toISOString(),
      note: timelineNote || "",
    }];
    const updated = { ...updates, timeline };
    if (newStatus) updated.status = newStatus;
    await base44.entities.CustomerOrder.update(order.id, updated);
    setSaving(false);
    onUpdated?.({ ...order, ...updated });
  };

  // Stage 2 actions
  const handleStartSearch = () =>
    updateOrder({ supplier_found: supplierName, purchase_price: purchasePrice ? Number(purchasePrice) : undefined }, "جاري البحث", "بدء البحث");

  const handleMoveToShortage = () =>
    updateOrder({ supplier_found: supplierName, purchase_price: purchasePrice ? Number(purchasePrice) : undefined }, "النواقص", "نقل للنواقص");

  // Stage 3 action
  const handleMoveToAvailable = () =>
    updateOrder({ customer_contacted: customerContacted, followup_notes: contactNote, product_available: true }, "تم توفير الصنف", "تم توفير الصنف");

  // Stage 4 action
  const handleDeliver = () =>
    updateOrder({}, "تم التوصيل", "تم التسليم للعميل");

  // Cancel
  const handleCancel = () =>
    updateOrder({ cancellation_reason: cancelReason }, "تم الإلغاء", `إلغاء: ${cancelReason}`);

  const handleRestore = (newStatus) =>
    updateOrder({ cancellation_reason: "" }, newStatus, `استعادة إلى: ${newStatus}`);

  const cfg = STATUS_STYLE[order.status] || "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="text-gray-800">
                طلب #{order.order_number || order.id?.slice(-6)}
              </DialogTitle>
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

          <div className="space-y-3">

            {/* ── Cancel Button (top) ── */}
            {isManager && !isCancelled && !isDelivered && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8"
                  onClick={() => setShowCancelPanel(p => !p)}
                >
                  <Ban className="w-3.5 h-3.5" /> إلغاء الطلب
                </Button>
              </div>
            )}

            {/* Cancel Panel */}
            {showCancelPanel && isManager && (
              <div className="border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
                  <Ban className="w-4 h-4" /> إلغاء الطلب
                </p>
                <Select value={cancelReason} onValueChange={setCancelReason}>
                  <SelectTrigger className="h-8 text-sm border-red-200 text-red-700 bg-white">
                    <SelectValue placeholder="اختر سبب الإلغاء" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-8"
                    disabled={!cancelReason || saving}
                    onClick={handleCancel}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "تأكيد الإلغاء"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowCancelPanel(false)}>إغلاق</Button>
                </div>
              </div>
            )}

            {/* ── STAGE 1: بيانات الطلب ── */}
            <StageCard
              number={1}
              title="بيانات الطلب"
              active={true}
              done={currentStage > 1 || isDelivered || isCancelled}
              color="blue"
            >
              <div className="grid grid-cols-2 gap-2">
                <InfoItem icon={<User className="w-3.5 h-3.5" />} label="العميل" value={order.customer_name} bold />
                <InfoItem icon={<Phone className="w-3.5 h-3.5" />} label="الهاتف" value={order.phone} />
                <InfoItem icon={<Package className="w-3.5 h-3.5" />} label="الصنف" value={order.product_name} bold />
                <InfoItem icon={<MapPin className="w-3.5 h-3.5" />} label="الفرع" value={order.branch} />
                {order.request_source && <InfoItem label="مصدر الطلب" value={order.request_source} />}
                {order.priority && <InfoItem label="الأولوية" value={order.priority} />}
                {order.customer_code && <InfoItem label="كود العميل" value={order.customer_code} />}
                {order.assigned_employee && <InfoItem label="الموظف" value={order.assigned_employee} />}
                {order.request_date && <InfoItem icon={<Calendar className="w-3.5 h-3.5" />} label="التاريخ" value={order.request_date} />}
              </div>
              {order.notes && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                  <strong>ملاحظات:</strong> {order.notes}
                </div>
              )}
              {order.product_image && (
                <div className="mt-2 cursor-pointer inline-block" onClick={() => setLightbox(order.product_image)}>
                  <img src={order.product_image} alt="صنف" className="h-20 w-20 object-cover rounded-lg border hover:opacity-80" />
                </div>
              )}
            </StageCard>

            {/* ── STAGE 2: البحث ── */}
            <StageCard
              number={2}
              title="مرحلة البحث"
              active={currentStage >= 1 && !isCancelled && !isDelivered}
              done={currentStage > 2 || isDelivered}
              color="yellow"
            >
              {isManager && !isCancelled && !isDelivered ? (
                <div className="space-y-3">
                  {/* Search button triggers search phase */}
                  {order.status === "طلب جديد" && (
                    <Button
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1.5 text-xs h-8"
                      onClick={handleStartSearch}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      بدء البحث
                    </Button>
                  )}

                  {/* Supplier + Price fields */}
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-gray-500">اسم المورد</label>
                      <Input
                        value={supplierName}
                        onChange={e => setSupplierName(e.target.value)}
                        placeholder="اسم المورد..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <label className="text-xs text-gray-500">السعر</label>
                      <Input
                        type="number"
                        value={purchasePrice}
                        onChange={e => setPurchasePrice(e.target.value)}
                        placeholder="السعر"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* تم الطلب checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={orderDone}
                      onChange={e => setOrderDone(e.target.checked)}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    تم الطلب من المورد
                  </label>

                  {/* نقل للنواقص */}
                  {(order.status === "جاري البحث" || order.status === "طلب جديد") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs h-8"
                      onClick={handleMoveToShortage}
                      disabled={saving}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> نقل الصنف للنواقص
                    </Button>
                  )}

                  {/* Show existing data if already in search */}
                  {(order.supplier_found || order.purchase_price) && (
                    <div className="bg-yellow-50 rounded-lg p-2 text-xs text-yellow-800 space-y-1">
                      {order.supplier_found && <p>المورد: <strong>{order.supplier_found}</strong></p>}
                      {order.purchase_price && <p>السعر: <strong>{order.purchase_price}</strong></p>}
                    </div>
                  )}

                  {order.status === "النواقص" && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs text-purple-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      الصنف في قائمة النواقص — في انتظار التوفير
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm space-y-1 text-gray-600">
                  {order.supplier_found && <p>المورد: <strong>{order.supplier_found}</strong></p>}
                  {order.purchase_price && <p>سعر الشراء: <strong>{order.purchase_price}</strong></p>}
                  {!order.supplier_found && <p className="text-gray-400 text-xs">لم تبدأ مرحلة البحث بعد</p>}
                </div>
              )}
            </StageCard>

            {/* ── STAGE 3: توفير الصنف ── */}
            <StageCard
              number={3}
              title="توفير الصنف"
              active={currentStage >= 2 && !isCancelled && !isDelivered}
              done={currentStage > 3 || isDelivered}
              color="teal"
            >
              {isManager && !isCancelled && !isDelivered ? (
                <div className="space-y-3">
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs h-8"
                    onClick={handleMoveToAvailable}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                    تم توفير الصنف
                  </Button>

                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={customerContacted}
                      onChange={e => setCustomerContacted(e.target.checked)}
                      className="w-4 h-4 accent-teal-600"
                    />
                    تم التواصل مع العميل
                  </label>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">ملاحظة</label>
                    <Input
                      value={contactNote}
                      onChange={e => setContactNote(e.target.value)}
                      placeholder="ملاحظة..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  {order.status === "تم توفير الصنف" || currentStage > 3 || isDelivered ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-teal-700 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> تم توفير الصنف</p>
                      {order.customer_contacted && <p className="text-xs text-gray-500">تم التواصل مع العميل</p>}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs">في انتظار توفير الصنف</p>
                  )}
                </div>
              )}
            </StageCard>

            {/* ── STAGE 4: تم التوصيل ── */}
            <StageCard
              number={4}
              title="تم التوصيل"
              active={currentStage >= 3 && !isCancelled}
              done={isDelivered}
              color="green"
            >
              {isManager && !isCancelled && !isDelivered ? (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs h-8"
                  onClick={handleDeliver}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                  تم التوصيل
                </Button>
              ) : isDelivered ? (
                <p className="text-green-700 font-semibold text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> تم تسليم الطلب للعميل
                </p>
              ) : (
                <p className="text-gray-400 text-xs">في انتظار التوصيل</p>
              )}
            </StageCard>

            {/* ── Cancelled state ── */}
            {isCancelled && (
              <div className="border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                  <Ban className="w-4 h-4" /> تم إلغاء الطلب
                </p>
                {order.cancellation_reason && <p className="text-xs text-red-600">السبب: {order.cancellation_reason}</p>}
                {isManager && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <p className="text-xs text-gray-500 w-full flex items-center gap-1"><RotateCcw className="w-3 h-3" /> استعادة إلى:</p>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-blue-300 text-blue-600" onClick={() => handleRestore("طلب جديد")} disabled={saving}>طلب جديد</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-yellow-300 text-yellow-700" onClick={() => handleRestore("جاري البحث")} disabled={saving}>جاري البحث</Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Timeline ── */}
            {order.timeline?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">سجل الطلب</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {[...(order.timeline || [])].reverse().map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-2">
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

// ── Stage Card Component ──
const STAGE_COLORS = {
  blue:   { border: "border-blue-200",   bg: "bg-blue-50",   num: "bg-blue-600",   title: "text-blue-800"  },
  yellow: { border: "border-yellow-200", bg: "bg-yellow-50", num: "bg-yellow-500", title: "text-yellow-800" },
  teal:   { border: "border-teal-200",   bg: "bg-teal-50",   num: "bg-teal-600",   title: "text-teal-800"  },
  green:  { border: "border-green-200",  bg: "bg-green-50",  num: "bg-green-600",  title: "text-green-800" },
};

function StageCard({ number, title, active, done, color = "blue", children }) {
  const c = STAGE_COLORS[color];
  return (
    <div className={`rounded-xl border p-3 space-y-3 transition-opacity ${active ? `${c.border} ${c.bg}` : "border-gray-100 bg-gray-50 opacity-60"}`}>
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${done ? "bg-green-500" : active ? c.num : "bg-gray-300"}`}>
          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : number}
        </div>
        <span className={`text-sm font-semibold ${active ? c.title : "text-gray-400"}`}>{title}</span>
        {done && <span className="text-xs text-green-600 mr-auto">✓ مكتمل</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoItem({ icon, label, value, bold }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 flex items-center gap-1">{icon}{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-gray-800" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}