# Stock Reduction on Order Approval — Design

## Context

`products.stock_quantity` exists and drives the storefront's "Sold Out" display (`isInStock = stock_quantity > 0`), but nothing currently decrements it when an order is placed or approved. Today, an admin approving an order via `OrderManagement.tsx`'s `updateOrderStatus` only updates `orders.status`/`approved_at`/`approved_by` — inventory is never touched, so `stock_quantity` drifts from reality as orders are fulfilled.

## Goal

When an admin approves a pending order (the `pending` → `approved` transition, the only path `OrderManagement.tsx` currently exposes), decrement each ordered product's `stock_quantity` by the ordered quantity — atomically, exactly once, and only on that specific transition. Rejecting an order must never touch stock.

## Non-goals

- No retroactive backfill for orders already approved before this ships — only future approvals are affected.
- No change to the storefront's stock-checking logic (`isInStock`) or to `ProductManagement.tsx`'s manual stock editing.
- No stock *reservation* at order-placement time (`pending` status) — stock is only ever touched at approval. This means two simultaneously-pending orders can still both claim more of a product than is in stock; the conflict is caught at approval time (see below), not at placement time.
- No UI path exists today for reverting an approved order back to pending/cancelled, so "restore stock on later reversal" is out of scope — there's nothing to revert from.

## Design

### Database trigger (new migration)

A `SECURITY DEFINER` trigger function on `public.orders`, `AFTER UPDATE ... FOR EACH ROW`, guarded to fire only on the exact transition into `'approved'` (`NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved'`) — this makes it fire exactly once per order, regardless of what other status changes happen later, and never fires for `'rejected'` or any other status.

For each `order_items` row belonging to that order:
1. `SELECT stock_quantity, name FROM products WHERE id = product_id FOR UPDATE` — locks the product row so a concurrent approval of a different order against the same product can't race past the sufficiency check.
2. If `ordered quantity > current stock`, `RAISE EXCEPTION` with a message naming the product and the shortfall (e.g. `Insufficient stock for "Titli Bracelet": need 5, only 2 in stock`). This aborts the *entire* transaction — the `orders.status` update itself rolls back, so the order stays `pending`, no partial decrements happen across the order's other items, and (because the client's own `UPDATE ... RETURNING` never completes) the subsequent approval-email invoke is never reached.
3. Otherwise, `UPDATE products SET stock_quantity = stock_quantity - quantity WHERE id = product_id`.

`SECURITY DEFINER` (matching this project's existing `get_my_role()` pattern) ensures the trigger's internal reads/writes aren't affected by the calling admin's own RLS grants on `products`/`order_items`.

### `OrderManagement.tsx`

`updateOrderStatus`'s `catch` block currently always shows a generic `"Failed to update order status"` toast. Change it to surface the trigger's specific message when available (e.g. `error?.message ?? "Failed to update order status"`), so an admin blocked by insufficient stock sees exactly which product and by how much, rather than a generic failure.

## Testing

No automated test suite exists in this repo (established convention). Verification is `npm run build` plus manual checks against a live/staging order:
- Approve an order for a product with ample stock → `stock_quantity` decreases by the ordered amount, order approves normally, approval email still sends.
- Approve an order whose quantity exceeds current stock → approval fails with a toast naming the specific product and shortfall; order status stays `pending`; `stock_quantity` unchanged; no approval email sent.
- Reject a pending order → `stock_quantity` unchanged for all its items.
- Approve an order with multiple line items where one item has sufficient stock and another doesn't → the whole approval fails (no partial decrement of the sufficient item).
