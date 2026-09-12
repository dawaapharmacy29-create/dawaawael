import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

const ALLOWED_FIELDS = new Set([
  'customer_name', 'phone', 'customer_code', 'request_source', 'product_name', 'product_image',
  'notes', 'priority', 'assigned_employee', 'request_date', 'status', 'supplier_found',
  'purchase_price', 'selling_price', 'search_notes', 'ordered_supplier', 'arrival_notes',
  'expected_availability_date', 'last_followup_date', 'product_available', 'customer_contacted',
  'contact_method', 'followup_notes', 'cancellation_reason', 'quantity', 'customer_type',
  'request_type', 'promised_at'
]);

const VALID_STATUSES = new Set([
  'طلب جديد', 'جاري البحث', 'تم الطلب', 'النواقص', 'تم توفير الصنف', 'تم توفير بديل',
  'تم التوصيل', 'الصنف غير متوفر حاليا', 'تم الإلغاء'
]);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    if (!id) return Response.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });

    const item = await base44.asServiceRole.entities.CustomerOrder.get(id);
    if (!item) return Response.json({ error: 'طلب العميل غير موجود' }, { status: 404 });

    const requested = body?.updates || {};
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(requested)) {
      if (ALLOWED_FIELDS.has(key)) updates[key] = value;
    }

    if ('status' in updates && !VALID_STATUSES.has(clean(updates.status))) {
      return Response.json({ error: 'حالة الطلب غير صالحة' }, { status: 400 });
    }
    if ('quantity' in updates) {
      const q = Number(updates.quantity);
      updates.quantity = Number.isFinite(q) ? Math.max(1, q) : 1;
    }
    for (const numeric of ['purchase_price', 'selling_price']) {
      if (numeric in updates && updates[numeric] !== '' && updates[numeric] != null) {
        const value = Number(updates[numeric]);
        if (!Number.isFinite(value) || value < 0) return Response.json({ error: 'قيمة رقمية غير صالحة' }, { status: 400 });
        updates[numeric] = value;
      }
    }

    const timelineNote = clean(body?.timeline_note);
    const actor = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
    if (timelineNote || ('status' in updates && clean(updates.status) !== clean(item.status))) {
      const status = clean(updates.status) || clean(item.status);
      updates.timeline = [...(Array.isArray(item.timeline) ? item.timeline : []), {
        status,
        by: actor,
        at: new Date().toISOString(),
        note: timelineNote || `تحديث الحالة إلى: ${status}`,
      }];
    }

    // deliberately impossible to alter identity/provenance/branch here:
    // branch, recorded_by*, identity_*, creation_source, source_pharmacy_order_id, converted_* are not whitelisted.
    const updated = await base44.asServiceRole.entities.CustomerOrder.update(id, updates);
    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'حدث خطأ أثناء تعديل الطلب' }, { status: 500 });
  }
}
