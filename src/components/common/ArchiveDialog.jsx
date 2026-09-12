import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ArchiveDialog({ open, onOpenChange, title = "أرشفة السجل", description, defaultReason = "أرشفة إدارية", onConfirm, isLoading = false }) {
  const [reason, setReason] = useState(defaultReason);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setReason(defaultReason);
      setNote("");
    }
  }, [open, defaultReason]);

  const submit = async () => {
    if (!reason.trim()) return;
    await onConfirm?.({ reason: reason.trim(), note: note.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle className="text-right">{title}</DialogTitle></DialogHeader>
        {description && <p className="text-sm text-gray-600 text-right">{description}</p>}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>سبب الأرشفة *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الأرشفة" />
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظة للرجوع إليها لاحقًا</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="مثال: سبب النقل أو التصحيح أو أي تفاصيل مهمة..." />
          </div>
        </div>
        <DialogFooter className="gap-2 flex-row-reverse">
          <Button className="bg-amber-600 hover:bg-amber-700" disabled={!reason.trim() || isLoading} onClick={submit}>{isLoading ? "جاري الأرشفة..." : "تأكيد الأرشفة"}</Button>
          <Button variant="outline" disabled={isLoading} onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
