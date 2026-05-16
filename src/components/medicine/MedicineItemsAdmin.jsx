import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FlaskConical } from "lucide-react";

export default function MedicineItemsAdmin() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["medicine-items"],
    queryFn: () => base44.entities.MedicineItem.list("name"),
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MedicineItem.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medicine-items"] }); setNewName(""); setNewCode(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MedicineItem.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicine-items"] }),
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), item_code: newCode.trim(), is_active: true });
  };

  return (
    <div className="space-y-4 max-w-md">
      <Card className="p-4">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-teal-600" /> إضافة صنف جديد
        </h3>
        <form onSubmit={handleAdd} className="space-y-2">
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم الدواء..." className="flex-1" />
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="كود الصنف" className="w-32" />
          </div>
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700 gap-1 w-full" disabled={createMutation.isPending}>
            <Plus className="w-4 h-4" /> إضافة
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-700 mb-3">الأصناف الحالية ({items.length})</h3>
        {isLoading ? (
          <p className="text-center text-gray-400 py-4">جاري التحميل...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 py-4">لا توجد أصناف بعد</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border">
                <div>
                  <span className="font-medium text-gray-700">{item.name}</span>
                  {item.item_code && (
                    <p className="text-xs text-teal-600 font-mono mt-0.5">كود: {item.item_code}</p>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}