import { secrets } from "base44:runtime";

/**
 * التحقق من كلمة مرور صفحة المصروفات الإدارية لفرع دواء الشامي.
 * كلمة المرور محفوظة كـ Secret (DAWAA_SHAMI_EXPENSES_PASSWORD) ولا تظهر أبداً في كود الواجهة.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const password = String(body?.password ?? "");
    const expected = secrets.get("DAWAA_SHAMI_EXPENSES_PASSWORD") || "";

    if (!expected) {
      return Response.json(
        { success: false, error: "كلمة مرور فرع الشامي غير محددة بعد — أضِفها من إعدادات الأسرار (Secrets)" },
        { status: 503 }
      );
    }
    if (!password) {
      return Response.json({ success: false, error: "أدخل كلمة المرور" }, { status: 400 });
    }
    if (password !== expected) {
      return Response.json({ success: false, error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}