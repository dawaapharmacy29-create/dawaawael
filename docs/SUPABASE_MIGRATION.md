# Base44 to Supabase migration

## Current state

The application is a Vite/React project exported from Base44. It still depends on:

- `@base44/sdk`
- `@base44/vite-plugin`
- Base44 authentication in `src/lib/AuthContext.jsx`
- Base44 application parameters in `src/lib/app-params.js`
- Base44 entities and backend functions throughout feature pages

The live one-way receiver is available at:

`https://zqfsakrxazznkqnjlgzv.supabase.co/functions/v1/base44-sync-receiver`

The connection test from Base44 currently succeeds with HTTP 202.

## Safety rule

Do not switch the application directly from Base44 to Supabase before historical reconciliation. Base44 currently contains newer records in some modules.

## Migration modes

### `base44`

Existing production behavior. Base44 remains the only active provider.

### `shadow`

Base44 remains the source used by the UI. Changes are mirrored to the Supabase sync inbox and checked for mapping, duplicates, and conflicts.

### `supabase`

Enabled only after reconciliation and end-to-end validation. Supabase becomes the primary source.

## Reconciliation sequence

1. Export a complete snapshot from each Base44 entity.
2. Store snapshot rows in Supabase staging tables.
3. Compare by stable Base44 record ID and business keys.
4. Produce a dry-run report:
   - Base44 only
   - Supabase only
   - identical
   - Base44 newer
   - Supabase newer
   - financial conflict
   - workflow/status conflict
5. Apply approved changes in batches.
6. Verify totals and record counts.
7. Enable shadow mode.
8. Enable Supabase mode module by module.

## Initial entity mapping

| Base44 entity | Supabase target |
|---|---|
| PurchaseInvoice | purchase_invoices |
| ShiftDelivery | shift_deliveries |
| PharmacyOrder | pharmacy_orders |
| SupplierPayment | supplier_payments |
| Return | purchase_returns |
| Supplier | suppliers |
| CustomerOrder | mapping requires schema review |
| Expense | mapping requires schema review |

Related child entities, attachments, audit logs, and transfer records must be discovered before the snapshot is applied.

## Conflict rules

- Never overwrite an approved invoice with a draft or older revision.
- Never downgrade a completed/cancelled order because of an older event.
- Never overwrite a reconciled treasury or shift-delivery record automatically.
- Deletes are soft deletes and require review.
- Every inbound and outbound event must include an event ID and origin marker to prevent sync loops.

## Next implementation steps

1. Add a provider abstraction without changing current Base44 behavior.
2. Add a Supabase HTTP client using publishable credentials only.
3. Build snapshot ingestion and dry-run reconciliation in Supabase.
4. Map one low-risk module first (`Supplier`).
5. Test create/update/delete and duplicate handling.
6. Expand to invoices, payments, orders, returns, and shift deliveries.
