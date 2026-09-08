import BranchSupplierBalances from "@/components/supplier/BranchSupplierBalances";

// صفحة مستقلة بالكامل لأرصدة موردين فرع دواء شكري فقط.
export default function SupplierBalancesShokry() {
  return <BranchSupplierBalances branch="دواء شكري" accentColor="text-blue-700" />;
}
