import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { branch, products } = await req.json();
    if (!branch || !products?.length) return Response.json({ error: 'branch and products required' }, { status: 400 });

    // Delete old records first
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

    // Insert new products in batches of 20
    const BATCH = 20;
    let inserted = 0;
    for (let i = 0; i < products.length; i += BATCH) {
      const chunk = products.slice(i, i + BATCH).map(item => ({
        product_name: item.product_name,
        stock_quantity: item.stock_quantity || 0,
        product_code: item.product_code || "",
        branch,
        is_active: true,
        priority_score: 0,
        discrepancy_count: 0,
      }));
      await base44.asServiceRole.entities.InventoryProduct.bulkCreate(chunk);
      inserted += chunk.length;
    }

    return Response.json({ deleted: allIds.length, inserted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});