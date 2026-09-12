// Deprecated nested duplicate retained only because the current sandbox API cannot delete it safely.
// It intentionally performs no sync. The authoritative function is the top-level syncEntityToDawaaBills.
export default async function(_req: Request): Promise<Response> {
  return Response.json({
    success: true,
    skipped: true,
    deprecated: true,
    reason: 'nested_duplicate_disabled_use_top_level_syncEntityToDawaaBills'
  });
}
