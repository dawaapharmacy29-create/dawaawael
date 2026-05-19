import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MedicineDashboard from "@/components/medicine/MedicineDashboard";
import MedicineSalesTab from "@/components/medicine/MedicineSalesTab";
import MedicineItemsAdmin from "@/components/medicine/MedicineItemsAdmin";
import MedicineBalanceTab from "@/components/medicine/MedicineBalanceTab";
import { useUserRole } from "@/lib/useUserRole";

export default function MedicineList() {
  const { isAdmin, isManager } = useUserRole();

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">أدوية اللسته</h1>
        <p className="text-gray-500 text-sm mt-0.5">متابعة مبيعات الأصناف الأسبوعية</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">أصناف اللسته</TabsTrigger>
          <TabsTrigger value="sales">تسجيل المبيعات</TabsTrigger>
          <TabsTrigger value="balance">الرصيد الفعلي</TabsTrigger>
          {(isAdmin || isManager) && <TabsTrigger value="admin">إدارة الأصناف</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard">
          <MedicineDashboard />
        </TabsContent>
        <TabsContent value="sales">
          <MedicineSalesTab />
        </TabsContent>
        <TabsContent value="balance">
          <MedicineBalanceTab />
        </TabsContent>
        {(isAdmin || isManager) && (
          <TabsContent value="admin">
            <MedicineItemsAdmin />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}