import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Deprecated on 2026-09-12.
// CustomerOrder automatic sync now has one authoritative path only:
// Sync CustomerOrder -> syncEntityToDawaaBills -> SyncOutbox -> DawaaBills + Management.
// This no-op remains only because the current sandbox API cannot delete the old workflow file safely.
export default async function(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  return Response.json({
    success: true,
    skipped: true,
    deprecated: true,
    reason: 'customer_order_sync_unified_via_outbox',
    actor: user?.id || null,
  });
}
