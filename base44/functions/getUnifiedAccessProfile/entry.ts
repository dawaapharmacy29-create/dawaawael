import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function clean(v: unknown) { return String(v ?? '').trim(); }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user: any = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'unauthenticated' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.ManagementLoginDirectory.filter({ is_active: true });
    const email = clean(user.email).toLowerCase();
    const userId = clean(user.id);
    const match = rows.find((r: any) =>
      clean(r.base44_user_id) === userId ||
      (clean(r.base44_email) && clean(r.base44_email).toLowerCase() === email)
    );

    if (!match) {
      return Response.json({
        success: true,
        linked: false,
        profile: null,
      });
    }

    const branch = clean(match.branch);
    const branches = branch && branch !== 'كل الفروع' ? [branch] : ['دواء شكري', 'دواء الشامي'];

    return Response.json({
      success: true,
      linked: true,
      profile: {
        management_staff_id: clean(match.admin_staff_id),
        management_username: clean(match.login_username),
        management_display_name: clean(match.display_name),
        management_branch: branch,
        management_role: clean(match.management_role),
        management_identity_source: 'DawaaManagementDirectory',
        financial_access_level: clean(match.financial_access_level) || 'none',
        branch_access: branches,
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'profile_lookup_failed' }, { status: 500 });
  }
}
