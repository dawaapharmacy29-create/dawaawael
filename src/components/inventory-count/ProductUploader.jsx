import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";


const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];

const COL_MAP = {
  "كود": "product_code", "كود الصنف": "product_code", "product_code": "product_code", "code": "product_code",
  "اسم": "product_name", "اسم الصنف": "product_name", "product_name": "product_name", "name": "product_name",
  "الكمية": "stock_quantity", "كمية": "stock_quantity", "stock_quantity": "stock_quantity", "quantity": "stock_quantity", "qty": "stock_quantity",
  "الشركة": "company", "شركة": "company", "company": "company",
  "التصنيف": "category", "تصنيف": "category", "category": "category",
  "السعر": "price", "سعر": "price", "price": "price",
  "تاريخ الصلاحية": "near_expiry_date", "expiry": "near_expiry_date",
};

export default function ProductUploader({ onClose }) {
  const qc = useQueryClient();
  const fileRef = useRef();
  const [branch, setBranch] = useState("");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
      return row;
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length === 0) { setError("الملف فارغ أو لا يحتوي على بيانات"); return; }

        const mapped = rows.map(row => {
          const item = {};
          Object.entries(row).forEach(([k, v]) => {
            const key = COL_MAP[k.trim()] || COL_MAP[k.trim().toLowerCase()];
            if (key) item[key] = v;
          });
          return item;
        }).filter(i => i.product_name);

        if (mapped.length === 0) { setError("لم يتم التعرف على أعمدة الملف. تأكد من وجود عمود 'اسم الصنف'"); return; }
        setPreview(mapped);
      } catch (err) {
        setError("تعذّر قراءة الملف: " + err.message);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (!branch || !preview) return;
    setImporting(true);
    const chunks = [];
    for (let i = 0; i < preview.length; i += 50) chunks.push(preview.slice(i, i + 50));
    for (const chunk of chunks) {
      await base44.entities.InventoryProduct.bulkCreate(
        chunk.map(item => ({
          product_code: String(item.product_code || ""),
          product_name: String(item.product_name || ""),
          company: String(item.company || ""),
          category: String(item.category || ""),
          stock_quantity: Number(item.stock_quantity) || 0,
          price: Number(item.price) || 0,
          near_expiry_date: item.near_expiry_date || null,
          branch,
          is_active: true,
          priority_score: 0,
          discrepancy_count: 0,
        }))
      );
    }
    qc.invalidateQueries(["inventory-products"]);
    setImporting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-lg font-bold text-gray-700">تم استيراد {preview?.length} صنف بنجاح!</p>
        <Button onClick={onClose}>إغلاق</Button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-base">استيراد الأصناف من ملف</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
      </div>

      <Select value={branch} onValueChange={setBranch}>
        <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
        <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
      </Select>

      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">{fileName || "اضغط لرفع ملف CSV"}</p>
        <p className="text-xs text-gray-400 mt-1">أعمدة مدعومة: كود الصنف، اسم الصنف، الكمية، الشركة، التصنيف، السعر</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded p-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          <p className="text-sm text-green-700 font-medium">✓ تم التعرف على {preview.length} صنف</p>
          <div className="overflow-x-auto max-h-48 border rounded-lg text-xs">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {["كود", "اسم الصنف", "الشركة", "التصنيف", "الكمية", "السعر"].map(h => (
                    <th key={h} className="px-2 py-1 text-right text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{r.product_code}</td>
                    <td className="px-2 py-1 font-medium">{r.product_name}</td>
                    <td className="px-2 py-1">{r.company}</td>
                    <td className="px-2 py-1">{r.category}</td>
                    <td className="px-2 py-1">{r.stock_quantity}</td>
                    <td className="px-2 py-1">{r.price}</td>
                  </tr>
                ))}
                {preview.length > 10 && (
                  <tr><td colSpan={6} className="px-2 py-1 text-gray-400 text-center">... و {preview.length - 10} صنف آخر</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Button
        className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
        disabled={!branch || !preview || importing}
        onClick={handleImport}
      >
        <Upload className="w-4 h-4" />
        {importing ? "جاري الاستيراد..." : `استيراد ${preview?.length || 0} صنف`}
      </Button>
    </div>
  );
}