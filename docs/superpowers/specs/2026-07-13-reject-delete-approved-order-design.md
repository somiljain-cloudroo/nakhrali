# Reject & Delete an Approved Order — Design

## Context

`OrderManagement.tsx` only offers Approve/Reject when an order's status is `'pending'`. Once approved, there's no way to remove it — test orders placed during development accumulate with no cleanup path. There's also currently no `DELETE` RLS policy on `orders` at all (admins only have `SELECT`/`UPDATE`).

## Goal

Admin can permanently delete an already-approved order. Since approval already decremented stock (via `decrement_stock_on_order_approval()`, and per-colour via the `product_color_stock` table once that feature ships), deleting an approved order restores whatever quantities it consumed.

## Depends on

The per-colour-stock feature (`product_color_stock` table) — this feature's restore logic checks that table first, falling back to `products.stock_quantity`, mirroring the approval trigger's own fallback exactly. Build per-colour-stock first.

## Design

**RLS**: new `DELETE` policy on `orders` for `admin`/`sales_admin` (via `get_my_role()`), matching the existing `UPDATE` policy's role check.

**Trigger** `restore_stock_on_order_delete()` (`BEFORE DELETE ON orders`, `SECURITY DEFINER`): when the row being deleted has `status = 'approved'`, loop its `order_items` and add each quantity back — to the matching `product_color_stock` row (`product_id`, `color`) if one exists, otherwise to `products.stock_quantity`. Deleting a `'pending'` or `'rejected'` order (stock never decremented) is a no-op for stock. `order_items` and `order_status_history` cascade-delete automatically via their existing foreign keys — no explicit cleanup needed for those.

**Admin UI** (`OrderManagement.tsx`): a new "Reject & Delete" button in the order detail dialog, shown when `selectedOrder.status === 'approved'` (in addition to, not replacing, the existing pending-only Approve/Reject pair). Confirms via `confirm()` ("Permanently delete this approved order? This cannot be undone. Any stock it consumed will be restored."), then calls `.from("orders").delete().eq("id", orderId).select("id")`, using the same RLS-silent-failure guard (`rows.length === 0` → throw) already used elsewhere in this file.

## Non-goals

- No delete option for `'pending'` orders — Reject already handles those (sets status to `'rejected'`, no stock was ever touched).
- No soft-delete / audit trail of deleted orders — this is a genuine removal, matching "too many test orders piling up."

## Testing

No automated test suite exists. Manual verification:
- Delete a `'pending'` order — succeeds, no stock change (none was ever decremented).
- Approve an order, note the resulting stock (product-level and/or per-colour), then delete it — stock is restored to its pre-approval value.
- Delete an order with multiple line items across different colours/products — every item's stock is restored correctly.
- A non-admin (if reachable) cannot delete any order — blocked by RLS.
