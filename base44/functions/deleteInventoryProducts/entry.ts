import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { branch } = await req.json();
    if (!branch) return Response.json({ error: 'branch required' }, { status: 400 });

    // Fetch ALL records for this branch using pagination
    let allIds = [];
    let skip = 0;
    const limit = 100;
    while (true) {
      const batch = await base44.asServiceRole.entities.InventoryProduct.filter(
        { branch },
        "-created_date",
        limit,
        skip
      );
      allIds = allIds.concat(batch.map(p => p.id));
      if (batch.length < limit) break;
      skip += limit;
    }

    // Delete sequentially to avoid rate limit
    for (const id of allIds) {
      await base44.asServiceRole.entities.InventoryProduct.delete(id).catch(() => {});
      await new Promise(r => setTimeout(r, 50));
    }

    return Response.json({ deleted: allIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});