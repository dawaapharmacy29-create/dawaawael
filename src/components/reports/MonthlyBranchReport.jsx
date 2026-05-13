import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyBranchReport({ invoices, expenses }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  // Build available months
  const availableMonths = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    for (let m = 12; m >= 1; m--) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      availableMonths.push({ key, label: `${MONTHS_AR[m - 1]} ${y}` });
    }
  }

  const filteredInvoices = invoices.filter((i) => getMonthKey(i.invoice_date || i.created_date) === selectedMonth);
  const filteredExpenses = expenses.filter((e) => getMonthKey(e.date || e.created_date) === selectedMonth);

  const branchStats = BRANCHES.map((branch) => {
    const bInv = filteredInvoices.filter((i) => i.branch === branch);
    const bExp = filteredExpenses.filter((e) => e.branch === branch);
    const cash = bInv.filter((i) => i.payment_type === "كاش").reduce((s, i) => s + (i.total_value || 0), 0);
    const credit = bInv.filter((i) => i.payment_type === "آجل").reduce((s, i) => s + (i.total_value || 0), 0);
    const other = bInv.filter((i) => i.payment_type !== "كاش" && i.payment_type !== "آجل").reduce((s, i) => s + (i.total_value || 0), 0);
    const totalPurchases = bInv.reduce((s, i) => s + (i.total_value || 0), 0);
    const totalExpenses = bExp.reduce((s, e) => s + (e.amount || 0), 0);
    return { branch, count: bInv.length, totalPurchases, cash, credit, other, totalExpenses };
  });

  const monthLabel = availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFontSize(14);
    doc.text(`Monthly Report - ${monthLabel}`, 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 105, 22, { align: "center" });

    let y = 32;
    const startX = 14;

    branchStats.forEach((stat) => {
      // Branch header
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.rect(startX, y, 182, 8, "F");
      doc.text(stat.branch, startX + 3, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 10;

      // Stats rows
      const rows = [
        ["عدد الفواتير", String(stat.count)],
        ["إجمالي المشتريات", stat.totalPurchases.toLocaleString("en-EG") + " EGP"],
        ["مشتريات كاش", stat.cash.toLocaleString("en-EG") + " EGP"],
        ["مشتريات آجل", stat.credit.toLocaleString("en-EG") + " EGP"],
        ["مشتريات أخرى (انستا/فودافون)", stat.other.toLocaleString("en-EG") + " EGP"],
        ["المصروفات", stat.totalExpenses.toLocaleString("en-EG") + " EGP"],
      ];

      doc.setFontSize(9);
      rows.forEach(([label, value], idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(startX, y, 182, 7, "F");
        }
        doc.text(label, startX + 3, y + 4.5);
        doc.text(value, startX + 179, y + 4.5, { align: "right" });
        y += 7;
      });

      y += 6;
      if (y > 260) { doc.addPage(); y = 20; }
    });

    // Totals
    const totalPurch = branchStats.reduce((s, b) => s + b.totalPurchases, 0);
    const totalCash = branchStats.reduce((s, b) => s + b.cash, 0);
    const totalCredit = branchStats.reduce((s, b) => s + b.credit, 0);
    const totalExp = branchStats.reduce((s, b) => s + b.totalExpenses, 0);
    const totalCount = branchStats.reduce((s, b) => s + b.count, 0);

    doc.setFillColor(15, 118, 110);
    doc.setTextColor(255, 255, 255);
    doc.rect(startX, y, 182, 8, "F");
    doc.setFontSize(11);
    doc.text("الإجمالي الكلي", startX + 3, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const totalRows = [
      ["إجمالي الفواتير", String(totalCount)],
      ["إجمالي المشتريات", totalPurch.toLocaleString("en-EG") + " EGP"],
      ["إجمالي الكاش", totalCash.toLocaleString("en-EG") + " EGP"],
      ["إجمالي الآجل", totalCredit.toLocaleString("en-EG") + " EGP"],
      ["إجمالي المصروفات", totalExp.toLocaleString("en-EG") + " EGP"],
    ];
    doc.setFontSize(9);
    totalRows.forEach(([label, value], idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(236, 253, 245);
        doc.rect(startX, y, 182, 7, "F");
      }
      doc.text(label, startX + 3, y + 4.5);
      doc.text(value, startX + 179, y + 4.5, { align: "right" });
      y += 7;
    });

    doc.save(`monthly_report_${selectedMonth}.pdf`);
  };

  const fmt = (n) => n.toLocaleString("ar-EG");

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700">التقرير الشهري لكل فرع (Backup)</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
          >
            {availableMonths.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={exportPDF} className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5">
            <FileDown className="w-4 h-4" /> تصدير PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="p-2 border text-right">الفرع</th>
              <th className="p-2 border text-center">عدد الفواتير</th>
              <th className="p-2 border text-center">إجمالي المشتريات</th>
              <th className="p-2 border text-center">كاش</th>
              <th className="p-2 border text-center">آجل</th>
              <th className="p-2 border text-center">المصروفات</th>
            </tr>
          </thead>
          <tbody>
            {branchStats.map((stat) => (
              <tr key={stat.branch} className="hover:bg-gray-50">
                <td className="p-2 border font-semibold text-gray-700">{stat.branch}</td>
                <td className="p-2 border text-center">{stat.count}</td>
                <td className="p-2 border text-center font-semibold text-blue-700">{fmt(stat.totalPurchases)} ج</td>
                <td className="p-2 border text-center text-green-700">{fmt(stat.cash)} ج</td>
                <td className="p-2 border text-center text-orange-700">{fmt(stat.credit)} ج</td>
                <td className="p-2 border text-center text-red-600">{fmt(stat.totalExpenses)} ج</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-teal-50 font-bold">
              <td className="p-2 border text-teal-800">الإجمالي</td>
              <td className="p-2 border text-center text-teal-800">{branchStats.reduce((s, b) => s + b.count, 0)}</td>
              <td className="p-2 border text-center text-blue-800">{fmt(branchStats.reduce((s, b) => s + b.totalPurchases, 0))} ج</td>
              <td className="p-2 border text-center text-green-800">{fmt(branchStats.reduce((s, b) => s + b.cash, 0))} ج</td>
              <td className="p-2 border text-center text-orange-800">{fmt(branchStats.reduce((s, b) => s + b.credit, 0))} ج</td>
              <td className="p-2 border text-center text-red-800">{fmt(branchStats.reduce((s, b) => s + b.totalExpenses, 0))} ج</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}