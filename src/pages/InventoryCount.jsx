import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Settings2, Zap, ClipboardList, BarChart2, PackageSearch } from "lucide-react";
import ProductUploader from "@/components/inventory-count/ProductUploader";
import CountSettings from "@/components/inventory-count/CountSettings";
import TaskGenerator from "@/components/inventory-count/TaskGenerator";
import DailyCountScreen from "@/components/inventory-count/DailyCountScreen";
import AccuracyReport from "@/components/inventory-count/AccuracyReport";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

export default function InventoryCount() {
  const [branch, setBranch] = useState("فرع زكريا");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [tab, setTab] = useState("count");

  const { data: products = [] } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => base44.entities.InventoryProduct.list(),
    staleTime: 60000,
  });

  const { data: allSettings = [] } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: () => base44.entities.InventorySettings.list(),
    staleTime: 60000,
  });

  const branchSettings = allSettings.find(s => s.branch === branch);
  const branchProducts = products.filter(p => p.branch === branch && p.is_active !== false);

  return (
    <div className="p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <PackageSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">الجرد الدوري الذكي</h1>
            <p className="text-xs text-gray-500">{branchProducts.length} صنف في الفرع المحدد</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Branch selector */}
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-40 border-teal-300 text-teal-700 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setUploadOpen(true)}>
            <Upload className="w-3.5 h-3.5" /> رفع أصناف
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-3.5 h-3.5" /> الإعدادات
          </Button>
          <Button size="sm" className="gap-1 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => setGenerateOpen(true)}>
            <Zap className="w-3.5 h-3.5" /> توليد مهمة
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {!branchSettings && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-800 flex items-center gap-2">
          <Settings2 className="w-4 h-4 shrink-0" />
          لم تُضبط إعدادات الجرد لهذا الفرع بعد —
          <button className="underline font-medium" onClick={() => setSettingsOpen(true)}>اضبطها الآن</button>
        </div>
      )}

      {branchProducts.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
          <Upload className="w-4 h-4 shrink-0" />
          لم يتم رفع أصناف لهذا الفرع بعد —
          <button className="underline font-medium" onClick={() => setUploadOpen(true)}>ارفع ملف الأصناف</button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 gap-2 bg-transparent p-0 flex flex-wrap">
          <TabsTrigger value="count" className="rounded-lg px-4 py-2 text-sm font-semibold border data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:border-teal-600 border-gray-300 text-gray-600 bg-white gap-1.5">
            <ClipboardList className="w-4 h-4" /> جرد اليوم
          </TabsTrigger>
          <TabsTrigger value="report" className="rounded-lg px-4 py-2 text-sm font-semibold border data-[state=active]:bg-gray-800 data-[state=active]:text-white data-[state=active]:border-gray-800 border-gray-300 text-gray-600 bg-white gap-1.5">
            <BarChart2 className="w-4 h-4" /> تقرير الدقة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="count">
          <DailyCountScreen branch={branch} />
        </TabsContent>

        <TabsContent value="report">
          <AccuracyReport branch={branch} />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <ProductUploader onClose={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <CountSettings branch={branch} onClose={() => setSettingsOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Generate Task Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <TaskGenerator
            branch={branch}
            products={products}
            settings={branchSettings}
            onDone={() => setGenerateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}