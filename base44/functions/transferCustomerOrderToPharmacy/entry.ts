import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'يجب تسجيل الدخول أولًا' }, { status: 401 });
    if (!['admin', 'manager'].includes(String(user.role || ''))) {
      return Response.json({ error: 'نقل الطلب متاح للإدارة فقط' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);
    const note = clean(body?.note);
    if (!id) return Response.json({ error: 'معرف طلب العميل مطلوب' }, { status: 400 });

    const customerOrder = await base44.asServiceRole.entities.CustomerOrder.get(id);
    if (!customerOrder) return Response.json({ error: 'طلب العميل غير موجود' }, { status: 404 });

    const actor = clean(user.full_name) || clean(user.email) || 'مستخدم النظام';
    const now = new Date().toISOString();

    // Idempotency: a CustomerOrder may be transferred only once to PharmacyOrder.
    const existing = await base44.asServiceRole.entities.PharmacyOrder.filter({ source_customer_order_id: id });
    let pharmacyOrder = existing[0] || null;

    if (!pharmacyOrder) {
      const {
        id: _id,
        created_date: _createdDate,
        updated_date: _updatedDate,
        created_by_id: _createdBy,
        registered_by_user_id: _registeredBy,
        recorded_by_staff_id: _recordedStaff,
        recorded_by_admin_staff_id: _recordedAdminStaff,
        identity_verified_at: _identityAt,
        identity_verification_source: _identitySource,
        creation_source: _creationSource,
        source_pharmacy_order_id: _sourcePharmacy,
        converted_by: _convertedBy,
        converted_at: _convertedAt,
        is_archived: _isArchived,
        archived_at: _archivedAt,
        archived_by: _archivedBy,
        archive_reason: _archiveReason,
        archive_note: _archiveNote,
        ...portable
      } = customerOrder as any;

      const timeline = [...(Array.isArray(customerOrder.timeline) ? customerOrder.timeline : []), {
        status: clean(customerOrder.status) || 'طلب جديد',
        by: actor,
        at: now,
        note: `تم النقل من طلبات العملاء${note ? ` — ${note}` : ''}`,
      }];

      pharmacyOrder = await base44.asServiceRole.entities.PharmacyOrder.create({
        ...portable,
        source_customer_order_id: id,
        timeline,
      });
    }

    // Archive the source instead of deleting it. This is safe to repeat.
    if (customerOrder.is_archived !== true || clean(customerOrder.archive_reason) !== 'تم النقل إلى طلبات الصيدليات') {
      const sourceTimeline = [...(Array.isArray(customerOrder.timeline) ? customerOrder.timeline : []), {
        status: clean(customerOrder.status) || 'طلب جديد',
        by: actor,
        at: now,
        note: `أرشفة بعد النقل إلى طلبات الصيدليات${note ? ` — ${note}` : ''}`,
      }];
      await base44.asServiceRole.entities.CustomerOrder.update(id, {
        is_archived: true,
        archived_at: now,
        archived_by: actor,
        archive_reason: 'تم النقل إلى طلبات الصيدليات',
        archive_note: note,
        timeline: sourceTimeline,
      });
    }

    return Response.json({
      success: true,
      pharmacy_order_id: pharmacyOrder.id,
      customer_order_id: id,
      already_transferred: existing.length > 0,
      archived_source: true,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'تعذر نقل الطلب إلى طلبات الصيدليات' }, { status: 500 });
  }
}
