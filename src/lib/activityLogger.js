import { base44 } from "@/api/base44Client";

export async function logActivity({ action_type, entity_type, entity_id, entity_label, details }) {
  try {
    const user = await base44.auth.me();
    await base44.entities.ActivityLog.create({
      action_type,
      entity_type,
      entity_id: entity_id || "",
      entity_label: entity_label || "",
      user_email: user?.email || "",
      user_name: user?.full_name || "",
      details: details || "",
    });
  } catch (e) {
    // silent fail - logging should never break the main flow
  }
}