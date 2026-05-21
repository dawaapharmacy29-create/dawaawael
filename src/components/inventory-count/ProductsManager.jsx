import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trash2, Package, AlertTriangle, CheckCircle2, Upload, FileSpreadsheet, ChevronDown, ChevronUp, Search } from "lucide-react";
import * as XLSX from "xlsx";

const BRANCHES = ["فرع زكريا", "فرع بسيسة", "فرع المنشية"];
const CONCURRENCY = 10; // parallel deletes

const NAME_KEYS = ["اسم الصنف", "اسم", "product_name", "name", "الاسم", "الصنف"];
const QTY_KEYS  = ["الرصيد", "رصيد", "الكمية", "كمية", "stock_quantity", "quantity", "qty", "الكميه"];
const CODE_KEYS = ["كود", "كود الصنف", "product_code", "code", "الكود", "رقم الصنف"];
const findCol = (headers, keys) => headers.find(h => keys.includes(h?.trim()));

// Delete in parallel chunks
async function deleteInParallel(ids, onProgress) {
  let done = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(id =>
      base44.entities.InventoryProduct.delete(id).catch(() => {})
    ));
    done += chunk.length;
    onProgress(Math.round((done / ids.length) * 100));
  }
}

export default function ProductsManager() {
  const qc = useQueryClient();
  const fileRef = useRef();

  const [deleting, setDeleting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [done, setDone] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  // Upload state (per-branch inline)
  const [uploadBranch, setUploadBranch] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(null);

  // Products viewer
  const [viewBranch, setViewBranch] = useState(null);
  const [search, setSearch] = useState("");

  const { data: allProducts = [], isLoading, refetch } = useQuery({
    queryKey: ["inventory-products-all"],
    queryFn: () => base44.entities.InventoryProduct.list(),
    staleTime: 30000,
  });

  const countByBranch = (branch) => allProducts.filter(p => p.branch === branch).length;

  // ── DELETE ──
  const handleDelete = async (branch) => {
    setDeleting(branch);
    setConfirm(null);
    setProgress(0);
    setProgressLabel("جاري جلب الأصناف...");

    const fresh = await base44.entities.InventoryProduct.filter({ branch }, null, 5000);
    setProgressLabel("جاري الحذف...");
    await deleteInParallel(fresh.map(p => p.id), setProgress);

    qc.removeQueries(["inventory-products-all"]);
    qc.removeQueries(["inventory-products"]);
    await refetch();
    setDeleting(null);
    setDone(branch);
    setTimeout(() => setDone(null), 3000);
  };

  // ── UPLOAD ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError("");
    setUploadPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) { setUploadError("الملف فارغ"); return; }
        const headers = Object.keys(rows[0]);
        const nameCol = findCol(headers, NAME_KEYS);
        const qtyCol  = findCol(headers, QTY_KEYS);
        const codeCol = findCol(headers, CODE_KEYS);
        if (!nameCol) { setUploadError("لم يُعثر على عمود اسم الصنف"); return; }
        const mapped = rows
          .map(r => ({
            product_name: String(r[nameCol] || "").trim(),
            stock_quantity: qtyCol ? (Number(r[qtyCol]) || 0) : 0,
            product_code: codeCol ? String(r[codeCol] || "").trim() : "",
          }))
          .filter(i => i.product_name);
        if (!mapped.length) { setUploadError("لا أصناف صالحة في الملف"); return; }
        setUploadPreview(mapped);
      } catch (err) {
        setUploadError("تعذّر قراءة الملف: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!uploadBranch || !uploadPreview) return;
    setUploading(true);
    setUploadProgress(0);

    // Delete old
    const old = await base44.entities.InventoryProduct.filter({ branch: uploadBranch }, null, 5000);
    await deleteInParallel(old.map(p => p.id), () => {});

    // Insert new in batches
    const BATCH = 20;
    const chunks = [];
    for (let i = 0; i < uploadPreview.length; i += BATCH) chunks.push(uploadPreview.slice(i, i + BATCH));
    for (let ci = 0; ci < chunks.length; ci++) {
      await base44.entities.InventoryProduct.bulkCreate(
        chunks[ci].map(item => ({
          product_name: item.product_name,
          stock_quantity: item.stock_quantity,
          product_code: item.product_code || "",
          branch: uploadBranch,
          is_active: true,
          priority_score: 0,
          discrepancy_count: 0,
        }))
      );
      setUploadProgress(Math.round(((ci + 1) / chunks.length) * 100));
      if (ci < chunks.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    qc.removeQueries(["inventory-products-all"]);
    qc.removeQueries(["inventory-products"]);
    await refetch();
    setUploading(false);
    setUploadDone(uploadBranch);
    setUploadBranch(null);
    setUploadPreview(null);
    setTimeout(() => setUploadDone(null), 3000);
  };

  // ── PRODUCTS VIEWER ──
  const viewedProducts = viewBranch
    ? allProducts.filter(p => p.branch === viewBranch &&
        (!search || p.product_name?.includes(search) || p.product_code?.includes(search)))
    : [];

  if (isLoading) return <div className="text-center text-gray-400 py-8">جاري التحميل...</div>;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2 text-yellow-800 text-sm">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>يمكنك حذف أصناف الفرع أو رفع ملف جديد مباشرة. الحذف نهائي.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BRANCHES.map(branch => {
          const count = countByBranch(branch);
          const isDeleting = deleting === branch;
          const isDone = done === branch || uploadDone === branch;
          const isConfirming = confirm === branch;
          const isUploading = uploading && uploadBranch === branch;
          const isUploadOpen = uploadBranch === branch && !isUploading;
          const isViewing = viewBranch === branch;

          return (
            <div key={branch} className="bg-white border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-teal-600" />
                    <span className="font-bold text-gray-800">{branch}</span>
                  </div>
                  {count > 0 && (
                    <button
                      className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                      onClick={() => { setViewBranch(isViewing ? null : branch); setSearch(""); }}
                    >
                      {isViewing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isViewing ? "إخفاء" : "عرض الأصناف"}
                    </button>
                  )}
                </div>

                <div className="text-center py-2">
                  <p className="text-3xl font-bold text-gray-700">{count}</p>
                  <p className="text-xs text-gray-400 mt-1">صنف مسجّل</p>
                </div>

                {isDone && (
                  <div className="flex items-center gap-1.5 justify-center text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> تمت العملية بنجاح
                  </div>
                )}

                {(isDeleting || isUploading) && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{isDeleting ? (progressLabel || "جاري الحذف...") : "جاري الرفع..."}</span>
                      <span>{isDeleting ? progress : uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${isDeleting ? progress : uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {!isDeleting && !isUploading && !isDone && (
                  <div className="flex gap-2">
                    {/* Upload button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8 gap-1 text-teal-700 border-teal-200 hover:bg-teal-50"
                      onClick={() => {
                        setUploadBranch(isUploadOpen ? null : branch);
                        setUploadPreview(null);
                        setUploadError("");
                        setConfirm(null);
                      }}
                    >
                      <Upload className="w-3.5 h-3.5" /> رفع ملف
                    </Button>

                    {/* Delete button */}
                    {count > 0 && (
                      isConfirming ? (
                        <>
                          <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-xs h-8" onClick={() => handleDelete(branch)}>
                            <Trash2 className="w-3.5 h-3.5 ml-1" /> تأكيد
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => setConfirm(null)}>
                            إلغاء
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => { setConfirm(branch); setUploadBranch(null); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> حذف
                        </Button>
                      )
                    )}
                  </div>
                )}

                {/* Inline Upload Form */}
                {isUploadOpen && (
                  <div className="border-t pt-3 space-y-2">
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors"
                      onClick={() => fileRef.current?.click()}
                    >
                      <FileSpreadsheet className="w-7 h-7 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">{uploadPreview ? `✓ ${uploadPreview.length} صنف` : "اضغط لاختيار ملف Excel"}</p>
                      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                    </div>
                    {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                    {uploadPreview && (
                      <Button
                        size="sm"
                        className="w-full bg-teal-600 hover:bg-teal-700 text-xs h-8 gap-1"
                        onClick={handleUpload}
                      >
                        <Upload className="w-3.5 h-3.5" /> استيراد {uploadPreview.length} صنف
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Products List */}
              {isViewing && (
                <div className="border-t">
                  <div className="px-3 py-2 bg-gray-50">
                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        className="w-full pr-7 pl-2 py-1.5 text-xs border rounded-md outline-none focus:border-teal-400"
                        placeholder="بحث باسم أو كود..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-56 divide-y text-xs">
                    {viewedProducts.slice(0, 200).map((p, i) => (
                      <div key={p.id || i} className="px-3 py-2 flex justify-between items-center hover:bg-gray-50">
                        <span className="text-gray-700 truncate flex-1">{p.product_name}</span>
                        <div className="flex items-center gap-2 shrink-0 mr-2">
                          {p.product_code && <span className="text-gray-400">{p.product_code}</span>}
                          <span className="font-medium text-teal-700">{p.stock_quantity ?? 0}</span>
                        </div>
                      </div>
                    ))}
                    {viewedProducts.length === 0 && (
                      <p className="text-center text-gray-400 py-4">لا نتائج</p>
                    )}
                    {viewedProducts.length > 200 && (
                      <p className="text-center text-gray-400 py-2">يُعرض أول 200 صنف</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}