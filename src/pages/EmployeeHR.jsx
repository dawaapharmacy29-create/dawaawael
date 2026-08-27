import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Clock, CalendarDays, Users } from "lucide-react";
import LoansTab from "@/components/hr/LoansTab";
import PermissionsTab from "@/components/hr/PermissionsTab";
import LeavesTab from "@/components/hr/LeavesTab";

export default function EmployeeHR() {
  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="bg-teal-100 p-2 rounded-lg">
          <Users className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">شؤون الموظفين</h1>
          <p className="text-sm text-gray-500">السلف والإذونات والإجازات السنوية</p>
        </div>
      </div>
      <Tabs defaultValue="loans" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger value="loans" className="flex flex-col items-center gap-1 py-2">
            <Wallet className="w-4 h-4" /> <span className="text-xs">السلف</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex flex-col items-center gap-1 py-2">
            <Clock className="w-4 h-4" /> <span className="text-xs">الإذونات</span>
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex flex-col items-center gap-1 py-2">
            <CalendarDays className="w-4 h-4" /> <span className="text-xs">الإجازات السنوية</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="loans"><LoansTab /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="leaves"><LeavesTab /></TabsContent>
      </Tabs>
    </div>
  );
}