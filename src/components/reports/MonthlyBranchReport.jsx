import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getInvoiceNetAmount, getInvoiceCashAmount, getInvoiceCreditAmount } from "@/lib/purchaseCalculations";

const BRANCHES = ["دواء شكري", "دواء الشامي"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyBranchReport({ invoices, expenses, suppliers = [], singleBranch }) {
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

  // Build supplier stats from invoices
  const supplierMap = {};
  filteredInvoices.forEach((inv) => {
    const name = inv.supplier_name || "غير محدد";
    if (!supplierMap[name]) supplierMap[name] = { name, count: 0, total: 0, cash: 0, credit: 0, other: 0 };
    supplierMap[name].count += 1;
    const net = getInvoiceNetAmount(inv, suppliers);
    const cash = Math.min(getInvoiceCashAmount(inv), net);
    const credit = Math.min(getInvoiceCreditAmount(inv), net);
    supplierMap[name].total += net;
    supplierMap[name].cash += cash;
    supplierMap[name].credit += credit;
    supplierMap[name].other += Math.max(net - cash - credit, 0);
  });
  const supplierStats = Object.values(supplierMap).sort((a, b) => b.total - a.total);

  const monthLabel = availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth;

  const exportPDF = async () => {
    const holder = document.createElement("div");
    holder.dir = "rtl";
    holder.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:760px;background:#fff;padding:28px;font-family:Cairo,Tahoma,Arial,sans-serif;color:#1f2937";

    const cards = supplierStats.map((stat) => {
      const name = String(stat.name || "غير محدد").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      return `<div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:14px"><div style="background:#0d9488;color:#fff;padding:10px 14px;font-weight:700">${name}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0"><div class="cell">عدد الفواتير: <b>${stat.count}</b></div><div class="cell">إجمالي المشتريات: <b>${stat.total.toLocaleString("ar-EG")} ج</b></div><div class="cell">كاش: <b>${stat.cash.toLocaleString("ar-EG")} ج</b></div><div class="cell">آجل: <b>${stat.credit.toLocaleString("ar-EG")} ج</b></div><div class="cell">أخرى: <b>${stat.other.toLocaleString("ar-EG")} ج</b></div></div></div>`;
    }).join("");

    holder.innerHTML = `<div style="text-align:center;margin-bottom:22px"><h1 style="margin:0;font-size:24px">تقرير الموردين - ${monthLabel}</h1><div style="color:#6b7280;margin-top:6px">تاريخ الإنشاء: ${new Date().toLocaleDateString("ar-EG")}</div></div>${cards || '<div style="text-align:center;color:#9ca3af">لا توجد بيانات</div>'}<style>.cell{padding:9px 12px;border-bottom:1px solid #f1f5f9}</style>`;
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(holder, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 16;
      const fullImgHeight = (canvas.height * imgWidth) / canvas.width;
      if (fullImgHeight <= pageHeight - 16) {
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 8, 8, imgWidth, fullImgHeight);
      } else {
        const pageCanvas = document.createElement("canvas");
        const ctx = pageCanvas.getContext("2d");
        const sourcePageHeight = Math.floor(canvas.width * (pageHeight - 16) / imgWidth);
        pageCanvas.width = canvas.width;
        let sourceY = 0;
        let pageIndex = 0;
        while (sourceY < canvas.height) {
          const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
          pageCanvas.height = sliceHeight;
          ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          if (pageIndex > 0) doc.addPage();
          const sliceImgHeight = sliceHeight * imgWidth / canvas.width;
          doc.addImage(pageCanvas.toDataURL("image/png"), "PNG", 8, 8, imgWidth, sliceImgHeight);
          sourceY += sliceHeight;
          pageIndex += 1;
        }
      }
      doc.save(`تقرير_الموردين_${selectedMonth}.pdf`);
    } finally {
      document.body.removeChild(holder);
    }
  };

  const fmt = (n) => n.toLocaleString("ar-EG");

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700">تقرير الموردين الشهري</h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
        >
          {availableMonths.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {supplierStats.length === 0 ? (
        <p className="text-center text-gray-400 py-6">لا توجد فواتير لهذا الشهر</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="p-2 border text-right">المورد</th>
                <th className="p-2 border text-center">عدد الفواتير</th>
                <th className="p-2 border text-center">إجمالي المشتريات</th>
                <th className="p-2 border text-center">كاش</th>
                <th className="p-2 border text-center">آجل</th>
                <th className="p-2 border text-center">أخرى</th>
              </tr>
            </thead>
            <tbody>
              {supplierStats.map((stat) => (
                <tr key={stat.name} className="hover:bg-gray-50">
                  <td className="p-2 border font-semibold text-gray-700">{stat.name}</td>
                  <td className="p-2 border text-center">{stat.count}</td>
                  <td className="p-2 border text-center font-semibold text-blue-700">{fmt(stat.total)} ج</td>
                  <td className="p-2 border text-center text-green-700">{fmt(stat.cash)} ج</td>
                  <td className="p-2 border text-center text-orange-700">{fmt(stat.credit)} ج</td>
                  <td className="p-2 border text-center text-gray-600">{fmt(stat.other)} ج</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-teal-50 font-bold">
                <td className="p-2 border text-teal-800">الإجمالي</td>
                <td className="p-2 border text-center text-teal-800">{supplierStats.reduce((s, b) => s + b.count, 0)}</td>
                <td className="p-2 border text-center text-blue-800">{fmt(supplierStats.reduce((s, b) => s + b.total, 0))} ج</td>
                <td className="p-2 border text-center text-green-800">{fmt(supplierStats.reduce((s, b) => s + b.cash, 0))} ج</td>
                <td className="p-2 border text-center text-orange-800">{fmt(supplierStats.reduce((s, b) => s + b.credit, 0))} ج</td>
                <td className="p-2 border text-center text-gray-700">{fmt(supplierStats.reduce((s, b) => s + b.other, 0))} ج</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}