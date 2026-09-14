import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockKeyhole, UserRound, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const LOGIN_MESSAGES = {
  account_not_ready: "الحساب موجود لكنه لم يُربط بعد بدواء وائل. راجع المدير مرة واحدة لإتمام الربط.",
  invalid_username: "اسم المستخدم غير صالح.",
  resolver_unavailable: "خدمة الدخول غير متاحة مؤقتًا. حاول مرة أخرى.",
};

export default function UnifiedLogin() {
  const { checkUserAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("اكتب اسم المستخدم وكلمة المرور.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const identifier = username.trim();
      let loginEmail = identifier;

      // توافق كامل مع الحسابات القديمة: البريد الإلكتروني الحالي يظل صالحًا للدخول.
      // أما اسم المستخدم المختصر فيتم حله Server-side إلى حساب Base44 المرتبط.
      if (!identifier.includes("@")) {
        const aliasResponse = await base44.functions.invoke("resolveUnifiedLoginAlias", { username: identifier });
        const alias = aliasResponse?.data || {};
        if (!alias.success || !alias.email) {
          setError(LOGIN_MESSAGES[alias.error] || "تعذر التحقق من اسم المستخدم.");
          return;
        }
        loginEmail = alias.email;
      }

      await base44.auth.loginViaEmailPassword(loginEmail, password);
      await checkUserAuth();
      window.location.replace("/");
    } catch (err) {
      const status = err?.response?.status || err?.status;
      if (status === 401 || status === 400) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة، أو كلمة مرور دواء وائل لم يتم توحيدها مع حساب الإدارة بعد.");
      } else {
        setError("تعذر تسجيل الدخول الآن. حاول مرة أخرى بعد لحظات.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-4">صيدليات دواء</h1>
          <p className="text-sm text-gray-500 mt-1">دواء وائل — دخول الحسابات المربوطة</p>
        </div>

        <Card className="p-5 md:p-6 shadow-sm border-gray-200">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="unified-username">اسم المستخدم</Label>
              <div className="relative">
                <UserRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="unified-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم أو البريد الإلكتروني"
                  className="pr-9 h-11"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unified-password">كلمة المرور</Label>
              <div className="relative">
                <LockKeyhole className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="unified-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="pr-9 pl-10 h-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

            <Button type="submit" disabled={loading} className="w-full h-11 bg-teal-600 hover:bg-teal-700">
              {loading ? "جاري التحقق..." : "دخول"}
            </Button>

            <p className="text-[11px] leading-5 text-gray-500 text-center">
              اسم المستخدم المختصر يعمل للحسابات المربوطة. كلمة المرور المستخدمة حاليًا هي كلمة مرور حساب دواء وائل/Base44، ولا يتم حفظها داخل التطبيق. توحيد نفس باسورد تطبيق الإدارة لم يكتمل بعد ولن يتم تنفيذه بطريقة غير آمنة.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
