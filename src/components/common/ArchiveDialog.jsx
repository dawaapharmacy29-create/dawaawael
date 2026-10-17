import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ArchiveDialog({ open, onOpenChange, title = "أرشفة السجل", description, defaultReason = "أرشفة إدارية", onConfirm, isLoading = false, confirmLabel = "تأكيد الأرشفة", pendingLabel = "جاري الأرشفة...", reasonLabel = "سبب الأرشفة", confirmClassName = "bg-amber-600 hover:bg-amber-700" }) {
  const [reason, setReason] = useState(defaultReason);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(defaultReason);
      setNote("");
      setError("");
    }
  }, [open, defaultReason]);

  const submit = async () => {
    if (!reason.trim() || isLoading || submitting) return;
    setSubmitting(true); setError("");
    try { await onConfirm?.({ reason: reason.trim(), note: note.trim() }); }
    catch (e) { setError(e?.response?.data?.error || e?.message || "تعذر تنفيذ العملية"); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isLoading && !submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle className="text-right">{title}</DialogTitle></DialogHeader>
        {description && <p className="text-sm text-gray-600 text-right">{description}</p>}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{reasonLabel} *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonLabel} />
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظة للرجوع إليها لاحقًا</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="مثال: سبب النقل أو التصحيح أو أي تفاصيل مهمة..." />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2 flex-row-reverse">
          <Button className={confirmClassName} disabled={!reason.trim() || isLoading || submitting} onClick={submit}>{isLoading || submitting ? pendingLabel : confirmLabel}</Button>
          <Button variant="outline" disabled={isLoading || submitting} onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
