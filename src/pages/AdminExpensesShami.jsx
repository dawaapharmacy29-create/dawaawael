import { useState } from "react";
import BranchAdminExpenses from "@/components/admin-expenses/BranchAdminExpenses";
import ShamiPasswordGate from "@/components/admin-expenses/ShamiPasswordGate";
import { isShamiUnlocked, setShamiUnlocked } from "@/lib/shamiExpensesAccess";

export default function AdminExpensesShami() {
  const [unlocked, setUnlocked] = useState(isShamiUnlocked());

  if (!unlocked) {
    return <ShamiPasswordGate onUnlock={() => { setShamiUnlocked(); setUnlocked(true); }} />;
  }

  return <BranchAdminExpenses branch="دواء الشامي" accentColor="text-purple-700" />;
}