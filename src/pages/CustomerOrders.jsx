import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, ShoppingBag, Bell } from "lucide-react";
import OrderStatCards from "@/components/orders/OrderStatCards";
import OrderTable from "@/components/orders/OrderTable";
import OrderFormDialog from "@/components/orders/OrderFormDialog";
import OrderDetailDialog from "@/components/orders/OrderDetailDialog";
import OrderAnalytics from "@/components/orders/OrderAnalytics";
import OrderAlerts from "@/components/orders/OrderAlerts";
import BranchEfficiencyCard from "@/components/orders/BranchEfficiencyCard";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const STATUSES = ["طلب جديد", "جاري البحث", "تم الطلب", "النواقص", "تم توفير الصنف", "تم التوصيل", "الصنف غير متوفر حاليا", "تم الإلغاء"];

export default function CustomerOrders() {
  const { isAdmin, isManager, user } = useUserRole();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => base44.entities.CustomerOrder.list("-created_date", 500),
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomerOrder.delete(id),
    onSuccess: () => qc.invalidateQueries(["customer-orders"]),
  });

  // Role-based filtering: non-admin sees only their branch
  const userBranch = user?.branch;
  const filteredOrders = orders.filter((o) => {
    if (!isManager && userBranch && o.branch !== userBranch) return false;
    if (filterBranch !== "all" && o.branch !== filterBranch) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterEmployee && o.assigned_employee !== filterEmployee) return false;
    if (filterDateFrom && o.request_date < filterDateFrom) return false;
    if (filterDateTo && o.request_date > filterDateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.product_name?.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_code?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tabs = [
    { id: "orders", label: "الطلبات" },
    { id: "analytics", label: "الإحصائيات" },
  ];

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">طلبات العملاء</h1>
            <p className="text-xs text-gray-500">{orders.length} طلب إجمالي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderAlerts orders={orders} />
          <Button onClick={() => setShowForm(true)} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Plus className="w-4 h-4" /> طلب جديد
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <OrderStatCards orders={orders} onFilterStatus={setFilterStatus} activeStatus={filterStatus} />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "analytics" ? (
        <OrderAnalytics orders={orders} />
      ) : (
        <>
          {/* Branch Filter Buttons */}
          {isManager && (
            <div className="flex gap-2 flex-wrap">
              {["all", ...BRANCHES].map((b) => (
                <button
                  key={b}
                  onClick={() => setFilterBranch(b)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filterBranch === b
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                  }`}
                >
                  {b === "all" ? "كل الفروع" : b}
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم العميل، الصنف، الرقم..."
                className="pr-9 h-9 text-sm"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>كل الموظفين</SelectItem>
                {teamMembers.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-36 h-9 text-sm" placeholder="من تاريخ" />
            <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-36 h-9 text-sm" placeholder="إلى تاريخ" />
            {(filterStatus !== "all" || filterBranch !== "all" || filterEmployee || filterDateFrom || filterDateTo || search) && (
              <Button variant="ghost" size="sm" className="text-gray-400 h-9" onClick={() => { setFilterStatus("all"); setFilterBranch("all"); setFilterEmployee(""); setFilterDateFrom(""); setFilterDateTo(""); setSearch(""); }}>
                مسح الفلاتر
              </Button>
            )}
          </div>

          {/* Table */}
          <OrderTable
            orders={filteredOrders}
            isLoading={isLoading}
            onSelect={setSelectedOrder}
            onDelete={(id) => deleteMutation.mutate(id)}
            isManager={isManager}
          />

          {/* Branch Efficiency */}
          <BranchEfficiencyCard orders={filteredOrders} />
        </>
      )}

      {showForm && (
        <OrderFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          teamMembers={teamMembers}
          onSaved={() => qc.invalidateQueries(["customer-orders"])}
        />
      )}

      {selectedOrder && (
        <OrderDetailDialog
          open={!!selectedOrder}
          onOpenChange={(v) => !v && setSelectedOrder(null)}
          order={selectedOrder}
          teamMembers={teamMembers}
          isManager={isManager}
          onUpdated={(updated) => {
            setSelectedOrder(updated);
            qc.invalidateQueries(["customer-orders"]);
          }}
        />
      )}
    </div>
  );
}