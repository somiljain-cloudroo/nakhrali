# Stock Reduction on Order Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atomically decrement each ordered product's `stock_quantity` when an admin approves an order, block the approval with a specific error if stock is insufficient, and never touch stock on rejection.

**Architecture:** A `SECURITY DEFINER` Postgres trigger on `orders`, firing only on the transition into `'approved'`, loops over that order's `order_items`, locks each product row, checks sufficiency, and either decrements or raises an exception that rolls back the whole approval. `OrderManagement.tsx`'s existing error toast is updated to surface that exception message to the admin.

**Tech Stack:** Supabase Postgres (migration, PL/pgSQL trigger). Vite + React + TypeScript for the one small client-side change.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-stock-reduction-on-approval-design.md`
- No retroactive backfill for orders already approved before this ships.
- No change to storefront stock-checking logic or `ProductManagement.tsx`'s manual stock editing.
- No stock reservation at order-placement time — only approval touches stock.
- This repo has no automated test suite. `npm run build` (vite build) is the standard gate for the TypeScript change. The SQL trigger has no local test harness either — verification is manual, against a live/staging order, as described in Task 1.
- Applying the migration to the linked Supabase project (`qevoycmuuzjwtscfpfyv`, per `supabase/config.toml`) modifies production schema and behavior — **do not run `supabase db push` without first telling the user exactly what will run and getting explicit confirmation.**

---

### Task 1: Database Trigger — Decrement Stock on Approval

**Files:**
- Create: `supabase/migrations/20260712000000_decrement_stock_on_order_approval.sql`

**Interfaces:**
- Produces: a trigger `trg_decrement_stock_on_order_approval` on `public.orders` (`AFTER UPDATE ... FOR EACH ROW`) calling `public.decrement_stock_on_order_approval()`. No application code calls this directly — it fires automatically whenever any code path updates `orders.status` to `'approved'` from a different prior status. Task 2 depends on this trigger's `RAISE EXCEPTION` message format (`Insufficient stock for "<product name>": need <N>, only <M> in stock`) being surfaced as the Postgres/PostgREST error's `message` field.

- [ ] **Step 1: Write the migration**

```sql
-- Atomically decrement product stock when an order is approved.
-- Fires only on the transition into 'approved'; never on reject or any
-- other status change. SECURITY DEFINER so the trigger's internal
-- reads/writes on order_items/products aren't affected by the calling
-- admin's own RLS grants.

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  current_stock INTEGER;
  prod_name TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    FOR item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = NEW.id
    LOOP
      SELECT stock_quantity, name INTO current_stock, prod_name
      FROM public.products
      WHERE id = item.product_id
      FOR UPDATE;

      IF item.quantity > current_stock THEN
        RAISE EXCEPTION 'Insufficient stock for "%": need %, only % in stock', prod_name, item.quantity, current_stock;
      END IF;

      UPDATE public.products
      SET stock_quantity = stock_quantity - item.quantity
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock_on_order_approval ON public.orders;

CREATE TRIGGER trg_decrement_stock_on_order_approval
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_order_approval();
```

- [ ] **Step 2: Review the SQL for correctness**

Confirm: the `IF` guard only matches the transition into `'approved'` (not every update to an already-approved order); the `FOR UPDATE` lock is acquired before the sufficiency check (not after); the exception is raised before any `UPDATE products` runs for that item (so a shortfall on a later item in a multi-item order still rolls back nothing — Postgres transaction semantics undo the whole statement, including any earlier iterations' decrements within the same trigger invocation); `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` make this migration safe to re-run.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260712000000_decrement_stock_on_order_approval.sql
git commit -m "Add trigger to decrement product stock on order approval"
```

- [ ] **Step 4: Apply the migration — requires explicit user confirmation first**

This is a production schema/behavior change. Before running anything, tell the user the exact command (`npx supabase db push`) and wait for their go-ahead. Do not proceed to Task 3's manual verification (which requires this trigger to exist) until it's confirmed applied.

---

### Task 2: `OrderManagement.tsx` — Surface the Specific Error Message

**Files:**
- Modify: `src/components/admin/OrderManagement.tsx` (the `catch` block inside `updateOrderStatus`)

**Interfaces:**
- Consumes: the Postgres error thrown by Task 1's trigger (surfaced via supabase-js as an object with a `message` field) when `supabase.from("orders").update(...)` fails.
- Produces: nothing further downstream — this is the last step in the approval-error path.

- [ ] **Step 1: Update the catch block**

Replace:

```ts
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
```

with:

```ts
    } catch (error) {
      console.error("Error updating order:", error);
      const message = (error as { message?: string })?.message || "Failed to update order status";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/OrderManagement.tsx
git commit -m "Surface specific error message (e.g. insufficient stock) on order status update failure"
```

---

### Task 3: Manual Verification (requires Task 1 applied to the database)

**Files:** none (verification-only task).

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 2: Manual walkthrough against a live/staging order**

Using the Supabase SQL editor or dashboard to set up test data, and the admin dashboard (`/admin` → Orders tab) to drive the approval:

1. Pick (or create) a pending order for a product with ample stock (e.g. `stock_quantity` ≥ 10, order quantity 1). Approve it. Confirm: the order becomes `approved`, `products.stock_quantity` for that product decreased by exactly the ordered quantity, and the approval email still sends (unchanged behavior).
2. Set a product's `stock_quantity` below the amount a pending order for it requests (e.g. stock = 1, order quantity = 5). Attempt to approve that order. Confirm: the toast shows the specific message (`Insufficient stock for "<product>": need 5, only 1 in stock`), the order stays `pending`, and `stock_quantity` is unchanged.
3. Reject a pending order for a product with known stock. Confirm `stock_quantity` is completely unchanged.
4. (If feasible) Create an order with two line items, one with sufficient stock and one without. Approve it. Confirm the whole approval fails and *neither* item's stock changed (no partial decrement).

- [ ] **Step 3: Report back to the user**

Summarize what was verified. If step 2's live walkthrough couldn't be performed (no test order available, or the migration hasn't been applied yet), say so explicitly rather than claiming success.
