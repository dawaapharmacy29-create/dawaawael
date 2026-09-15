import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VALID_BRANCHES = new Set(['دواء شكري', 'دواء الشامي']);
const VALID_SOURCES = new Set(['واتساب', 'مكالمة هاتفية', 'داخل الصيدلية', '']);
const VALID_PRIORITIES = new Set(['عاجل', 'متوسط', 'عادي']);
const VALID_STATUSES = new Set([
  'طلب جديد', 'جاري البحث', 'تم الطلب', 'النواقص', 'تم توفير الصنف', 'تم توفير بديل',
  'تم التوصيل', 'الصنف غير متوفر حاليا', 'تم الإلغاء'
]);
const VALID_CANCEL_REASONS = new Set(['السعر غير مناسب', 'تأخر الرد', 'الصيدلية كانت تسأل فقط', 'وجدته في مكان آخر', 'أخرى', '']);
const ALLOWED_UPDATE_FIELDS = new Set([
  'customer_name','phone','customer_code','branch','request_source','product_name','product_image','notes','priority',
  'assigned_employee','request_date','status','supplier_found','purchase_price','selling_price','search_notes',
  'ordered_supplier','arrival_notes','expected_availability_date','last_followup_date','product_available',
  'customer_contacted','contact_method','followup_notes','cancellation_reason'
]);

const clean = (v: unknown) => String(v ?? '').trim();
const cairoDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

function sanitizeCommon(input: any) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input || {})) if (ALLOWED_UPDATE_FIELDS.has(k)) out[k] = v;
  for (const k of ['customer_name','phone','customer_code','branch','request_source','product_name','product_image','notes','priority','assigned_employee','request_date','status','supplier_found','search_notes','ordered_supplier','arrival_notes','expected_availability_date','last_followup_date','contact_method','followup_notes','cancellation_reason']) {
    if (k in out) out[k] = clean(out[k]);
  }
  for (const k of ['purchase_price','selling_price']) {
    if (k in out && out[k] !== '' && out[k] != null) {
      const n = Number(out[k]);
      if (!Number.isFinite(n) || n < 0) throw new Error('قيمة السعر غير صالحة');
      out[k] = n;
    }
  }
  if ('product_available' in out) out.product_available = !!out.product_available;
  if ('customer_contacted' in out) out.customer_contacted = !!out.customer_contacted;
  return out;
}

function validate(next: any) {
  if (!clean(next.customer_name) || !clean(next.phone) || !clean(next.product_name)) throw new Error('اسم الصيدلية ورقم الهاتف واسم الصنف مطلوبة');
  if (!VALID_BRANCHES.has(clean(next.branch))) throw new Error('يجب اختيار فرع صحيح');
  if (!VALID_SOURCES.has(clean(next.request_source))) throw new Error('مصدر الطلب غير صالح');
  if (!VALID_PRIORITIES.has(clean(next.priority) || 'عادي')) throw new Error('أولوية الطلب غير صالحة');
  if (!VALID_STATUSES.has(clean(next.status) || 'طلب جديد')) throw new Error('حالة الطلب غير صالحة');
  if (!VALID_CANCEL_REASONS.has(clean(next.cancellation_reason))) throw new Error('سبب الإلغاء غير صالح');
}

async function validateAssignedEmployee(base44: any, name: string) {
  if (!name) return;
  const rows = await base44.asServiceRole.entities.TeamMember.filter({ name, is_active: true });
  if (!rows?.length) throw new Error('الموظف المسؤول غير موجود ضمن فريق العمل النشط');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ success:false, error:'يجب تسجيل الدخول أولًا' }, { status:401 });

    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action) || 'create';
    const actor = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
    const now = new Date().toISOString();

    if (action === 'create') {
      const data = sanitizeCommon(body?.order || {});
      data.status = 'طلب جديد';
      data.priority = clean(data.priority) || 'عادي';
      data.request_date = clean(data.request_date) || cairoDate();
      validate(data);
      await validateAssignedEmployee(base44, clean(data.assigned_employee));
      const year = new Intl.DateTimeFormat('en', { timeZone:'Africa/Cairo', year:'numeric' }).format(new Date());
      const orderNumber = `PHR-${year}-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
      const created = await base44.asServiceRole.entities.PharmacyOrder.create({
        ...data,
        order_number: orderNumber,
        added_at: new Date().toLocaleString('ar-EG', { timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
        timeline: [{ status:'طلب جديد', by:actor, at:now, note:'تم إنشاء الطلب' }],
      });
      try {
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'create',
          entity_type: 'pharmacy_order',
          entity_id: created?.id || '',
          record_id: created?.id || '',
          entity_label: orderNumber,
          user_email: clean(user.email),
          user_name: actor,
          user_role: clean(user.role),
          status: 'success',
          details: `إنشاء طلب صيدلية ${orderNumber} | الفرع: ${clean(data.branch)} | الصيدلية: ${clean(data.customer_name)}`,
        });
      } catch (_) {}
      return Response.json({ success:true, record:created });
    }

    if (action !== 'update') return Response.json({ success:false, error:'نوع العملية غير مدعوم' }, { status:400 });
    if (!['admin','manager'].includes(clean(user.role))) return Response.json({ success:false, error:'تعديل طلبات الصيدليات متاح للإدارة فقط' }, { status:403 });

    const id = clean(body?.id);
    if (!id) return Response.json({ success:false, error:'معرف الطلب مطلوب' }, { status:400 });
    const current: any = await base44.asServiceRole.entities.PharmacyOrder.get(id).catch(() => null);
    if (!current) return Response.json({ success:false, error:'طلب الصيدلية غير موجود' }, { status:404 });
    if (current.is_archived === true) return Response.json({ success:false, error:'الطلب مؤرشف. استعده أولًا قبل التعديل' }, { status:409 });

    const updates = sanitizeCommon(body?.updates || {});
    const next = { ...current, ...updates };
    validate(next);
    if ('assigned_employee' in updates) await validateAssignedEmployee(base44, clean(updates.assigned_employee));

    const timelineNote = clean(body?.timeline_note);
    const statusChanged = 'status' in updates && clean(updates.status) !== clean(current.status);
    if (timelineNote || statusChanged) {
      updates.timeline = [...(Array.isArray(current.timeline) ? current.timeline : []), {
        status: clean(updates.status) || clean(current.status) || 'طلب جديد',
        by: actor,
        at: now,
        note: timelineNote || `تحديث الحالة إلى: ${clean(updates.status)}`,
      }];
    }

    const updated = await base44.asServiceRole.entities.PharmacyOrder.update(id, updates);
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'update',
        entity_type: 'pharmacy_order',
        entity_id: id,
        record_id: id,
        entity_label: clean(current.order_number) || id,
        user_email: clean(user.email),
        user_name: actor,
        user_role: clean(user.role),
        status: 'success',
        details: `تعديل طلب صيدلية ${clean(current.order_number) || id}: ${Object.keys(updates).join(', ')}`,
      });
    } catch (_) {}
    return Response.json({ success:true, record:updated });
  } catch (error) {
    return Response.json({ success:false, error:error instanceof Error ? error.message : 'تعذر حفظ طلب الصيدلية' }, { status:500 });
  }
}
