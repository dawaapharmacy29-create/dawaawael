import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

/**
 * بوابة كلمة المرور لصفحة المصروفات الإدارية — دواء الشامي.
 * التحقق يتم على السيرفر (checkShamiPassword) حتى لا تظهر كلمة المرور في كود الموقع.
 */
export default function ShamiPasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("checkShamiPassword", { password });
      const data = res?.data ?? res;
      if (data?.success) {
        onUnlock();
      } else {
        setError(data?.error || "كلمة المرور غير صحيحة");
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.data?.error || err?.message || "تعذر التحقق من كلمة المرور، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-16" dir="rtl">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">المصروفات الإدارية — دواء الشامي</h2>
          <p className="text-sm text-gray-500">هذه الصفحة محمية بكلمة مرور خاصة. أدخل كلمة المرور للمتابعة.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            autoFocus
            dir="ltr"
            className="text-center"
          />
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          <Button type="submit" disabled={!password || loading} className="w-full bg-purple-600 hover:bg-purple-700">
            {loading ? "جاري التحقق..." : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}