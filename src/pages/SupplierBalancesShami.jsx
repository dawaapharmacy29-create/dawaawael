import BranchSupplierBalances from "@/components/supplier/BranchSupplierBalances";

// صفحة مستقلة بالكامل لأرصدة موردين فرع دواء الشامي فقط.
export default function SupplierBalancesShami() {
  return <BranchSupplierBalances branch="دواء الشامي" accentColor="text-purple-700" />;
}
