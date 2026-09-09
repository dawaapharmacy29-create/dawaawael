import { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Building2, Layers, Loader2 } from "lucide-react";
import { BRANCHES, buildFinancialSummary, fmtCurrency } from "@/lib/financial-report-utils";

const TEAL = "#0d9488";

function fmt(n) {
  return (n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

function SummaryPage({ title, subtitle, summary }) {
  const cards = [
    { label: "إجمالي المبيعات", value: summary.totalSales, color: "#0d9488" },
    { label: "إجمالي المشتريات", value: summary.totalPurchases, color: "#2563eb" },
    { label: "صافي المبيعات", value: summary.netSales, color: "#059669" },
    { label: "متوسط المبيعات اليومي", value: summary.avgSales, color: "#0891b2" },
    { label: "متوسط المشتريات اليومي", value: summary.avgPurchases, color: "#7c3aed" },
    { label: "متوسط المصروفات اليومي", value: summary.avgExpenses, color: "#d97706" },
  ];

  return (
    <div style={{ width: 700, background: "#fff", fontFamily: "Cairo, sans-serif" }}>
      <div style={{ background: TEAL, padding: "20px 28px" }}>
        <p style={{ color: "#fff", fontWeight: 800, fontSize: 20, margin: 0 }}>{title}</p>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "4px 0 0" }}>{subtitle}</p>
      </div>
      <div style={{ padding: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 16px", background: "#fafafa" }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: c.color, marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 6px" }}>{c.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: c.color, margin: 0 }}>{fmt(c.value)} <span style={{ fontSize: 13, fontWeight: 500 }}>ج</span></p>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 28px 24px", color: "#9ca3af", fontSize: 11, textAlign: "center" }}>
        عدد أيام الفترة: {summary.days} يوم — صيدليات دواء
      </div>
    </div>
  );
}

export default function FinancialReportExport({ handovers, invoices, dateFrom, dateTo, periodLabel }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("all"); // all | single
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef(null);

  const buildPages = () => {
    if (mode === "single") {
      return [{
        title: `تقرير مالي — ${selectedBranch}`,
        subtitle: periodLabel,
        summary: buildFinancialSummary(handovers, invoices, dateFrom, dateTo, selectedBranch),
      }];
    }
    const pages = [{
      title: "تقرير مالي مجمّع — كل الفروع",
      subtitle: periodLabel,
      summary: buildFinancialSummary(handovers, invoices, dateFrom, dateTo, "all"),
    }];
    BRANCHES.forEach((b) => {
      pages.push({
        title: `تقرير مالي — ${b}`,
        subtitle: periodLabel,
        summary: buildFinancialSummary(handovers, invoices, dateFrom, dateTo, b),
      });
    });
    return pages;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const pages = buildPages();
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      for (let i = 0; i < pages.length; i++) {
        const holder = document.createElement("div");
        holder.style.position = "fixed";
        holder.style.top = "-10000px";
        holder.style.left = "-10000px";
        document.body.appendChild(holder);

        const { createRoot } = await import("react-dom/client");
        const root = createRoot(holder);
        await new Promise((resolve) => {
          root.render(<SummaryPage {...pages[i]} />);
          setTimeout(resolve, 50);
        });

        const canvas = await html2canvas(holder.firstChild, { scale: 2, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) doc.addPage();
        doc.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

        root.unmount();
        document.body.removeChild(holder);
      }

      const filename = mode === "single" ? `تقرير_مالي_${selectedBranch}.pdf` : `تقرير_مالي_كل_الفروع.pdf`;
      doc.save(filename);
      setOpen(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-teal-600 hover:bg-teal-700 gap-2">
        <FileDown className="w-4 h-4" /> تصدير تقرير PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>تصدير تقرير مالي PDF</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">الفترة: {periodLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("all")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition ${mode === "all" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <Layers className="w-5 h-5" /> تقرير مجمّع
                <span className="text-[10px] font-normal text-gray-400">صفحة إجمالية + صفحة لكل فرع</span>
              </button>
              <button
                onClick={() => setMode("single")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition ${mode === "single" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <Building2 className="w-5 h-5" /> فرع محدد
                <span className="text-[10px] font-normal text-gray-400">صفحة واحدة</span>
              </button>
            </div>
            {mode === "single" && (
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button onClick={handleExport} disabled={exporting} className="bg-teal-600 hover:bg-teal-700 gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {exporting ? "جارٍ التصدير..." : "تصدير"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
