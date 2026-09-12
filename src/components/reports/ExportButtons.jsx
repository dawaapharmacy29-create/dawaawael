import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function toCSV(rows, headers) {
  const lines = [headers.join(",")];
  rows.forEach((r) => lines.push(r.map((c) => `"${c}"`).join(",")));
  return lines.join("\n");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(["\ufeff" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButtons({ invoices, expenses, year, branchData, monthlyData }) {
  const exportExcel = () => {
    // Invoices sheet
    const invHeaders = ["رقم الفاتورة", "المورد", "الفرع", "القيمة الإجمالية", "المرتجع", "المدفوع", "المتبقي", "طريقة الدفع", "الحالة"];
    const invRows = invoices.map((i) => [
      i.system_invoice_number,
      i.supplier_name || "",
      i.branch || "",
      i.total_value || 0,
      i.returned_value || 0,
      i.paid_value || 0,
      (i.total_value || 0) - (i.returned_value || 0) - (i.paid_value || 0),
      i.payment_type || "",
      i.status || "",
    ]);

    // Expenses sheet
    const expHeaders = ["الوصف", "المبلغ", "الفرع", "الفئة", "التاريخ"];
    const expRows = expenses.map((e) => [e.description, e.amount || 0, e.branch || "", e.category || "", e.date || ""]);

    // Monthly summary
    const sumHeaders = ["الشهر", "المشتريات", "المصروفات"];
    const sumRows = monthlyData.map((m) => [m.month, m.invoices, m.expenses]);

    const invCSV = toCSV(invRows, invHeaders);
    const expCSV = toCSV(expRows, expHeaders);
    const sumCSV = toCSV(sumRows, sumHeaders);

    const combined = `--- فواتير الشراء ---\n${invCSV}\n\n--- المصروفات ---\n${expCSV}\n\n--- الملخص الشهري ---\n${sumCSV}`;
    downloadFile(combined, `تقرير_مالي_${year}.csv`, "text/csv;charset=utf-8;");
  };

  const exportPDF = async () => {
    const holder = document.createElement("div");
    holder.dir = "rtl";
    holder.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:1050px;background:#fff;padding:32px;font-family:Cairo,Tahoma,Arial,sans-serif;color:#1f2937";

    const branchRows = branchData.map((row) => {
      const total = (row["مشتريات"] || 0) + (row["مصروفات"] || 0);
      return `<tr><td>${row.branch || "—"}</td><td>${(row["مشتريات"] || 0).toLocaleString("ar-EG")}</td><td>${(row["مصروفات"] || 0).toLocaleString("ar-EG")}</td><td>${total.toLocaleString("ar-EG")}</td></tr>`;
    }).join("");
    const monthRows = monthlyData.map((row) => `<tr><td>${row.month || "—"}</td><td>${(row.invoices || 0).toLocaleString("ar-EG")}</td><td>${(row.expenses || 0).toLocaleString("ar-EG")}</td></tr>`).join("");

    holder.innerHTML = `
      <div style="text-align:center;margin-bottom:24px"><h1 style="margin:0;font-size:28px">التقرير المالي - ${year}</h1><div style="color:#6b7280;margin-top:6px">صيدليات دواء</div></div>
      <h2 style="font-size:20px;margin:18px 0 10px">ملخص الفروع</h2>
      <table style="width:100%;border-collapse:collapse;text-align:right"><thead><tr><th>الفرع</th><th>المشتريات (جنيه)</th><th>المصروفات (جنيه)</th><th>الإجمالي (جنيه)</th></tr></thead><tbody>${branchRows}</tbody></table>
      <h2 style="font-size:20px;margin:28px 0 10px">الملخص الشهري</h2>
      <table style="width:100%;border-collapse:collapse;text-align:right"><thead><tr><th>الشهر</th><th>المشتريات</th><th>المصروفات</th></tr></thead><tbody>${monthRows}</tbody></table>
      <style>th{background:#0d9488;color:white;padding:10px;border:1px solid #d1d5db}td{padding:9px;border:1px solid #d1d5db}tbody tr:nth-child(even){background:#f8fafc}</style>
    `;
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(holder, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 16;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const image = canvas.toDataURL("image/png");
      if (imgHeight <= pageHeight - 16) {
        doc.addImage(image, "PNG", 8, 8, imgWidth, imgHeight);
      } else {
        const ratio = (pageHeight - 16) / imgHeight;
        doc.addImage(image, "PNG", 8, 8, imgWidth * ratio, pageHeight - 16);
      }
      doc.save(`تقرير_مالي_${year}.pdf`);
    } finally {
      document.body.removeChild(holder);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportExcel} className="text-green-700 border-green-300 hover:bg-green-50">
        <FileSpreadsheet className="w-4 h-4 ml-1" />
        تصدير إكسل
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} className="text-red-600 border-red-300 hover:bg-red-50">
        <FileDown className="w-4 h-4 ml-1" />
        تصدير PDF
      </Button>
    </div>
  );
}