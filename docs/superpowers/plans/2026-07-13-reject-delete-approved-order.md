# Reject & Delete Approved Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin permanently delete an already-approved order, restoring whatever stock it consumed (per-colour or product-level).

**Architecture:** A new admin-only `DELETE` RLS policy on `orders`, plus a `BEFORE DELETE` trigger that restores stock for approved orders being deleted — mirroring the existing approval trigger's per-colour-then-product-level fallback logic in reverse. A new "Reject & Delete" button in the admin order detail dialog, shown only for approved orders.

**Tech Stack:** Supabase Postgres (migration, PL/pgSQL trigger, RLS). React + TypeScript.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-reject-delete-approved-order-design.md`
- **Depends on the per-colour-stock plan** (`docs/superpowers/plans/2026-07-13-per-colour-stock.md`) — the `product_color_stock` table must already exist before this plan's Task 1 migration runs, since its trigger references that table. Confirm that plan's migration is applied before starting this one.
- No delete option for `'pending'` orders — Reject already handles those with no stock implications (approval never happened).
- No soft-delete or audit trail — this is a genuine removal.
- No automated test suite. `npm run build` is the standard gate. The trigger has no local test harness — verification is manual (Task 3).
- Applying the migration to the linked Supabase project modifies production schema — **do not run `supabase db push` without first telling the user exactly what will run and getting explicit confirmation.**

---

### Task 1: Database — Admin Delete Policy and Stock-Restoring Trigger

**Files:**
- Create: `supabase/migrations/20260713010000_reject_delete_approved_order.sql`

**Interfaces:**
- Produces: a `DELETE` RLS policy on `public.orders` for `admin`/`sales_admin`. A `BEFORE DELETE` trigger `trg_restore_stock_on_order_delete` calling `restore_stock_on_order_delete()`. No application code calls this trigger directly — it fires automatically whenever an authorized `DELETE` on `orders` succeeds. Task 2 depends on the RLS policy existing (otherwise its delete call is silently blocked, same RLS-silent-failure pattern as everywhere else in this codebase).

- [ ] **Step 1: Write the migration**

```sql
-- Admins can permanently delete an order (mainly for clearing out test
-- orders). If the order was 'approved' (and therefore already decremented
-- stock), restore what it consumed before the row disappears.

CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (public.get_my_role() IN ('admin', 'sales_admin'));

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  updated_rows INTEGER;
BEGIN
  IF OLD.status = 'approved' THEN
    FOR item IN
      SELECT product_id, quantity, color
      FROM public.order_items
      WHERE order_id = OLD.id
    LOOP
      UPDATE public.product_color_stock
      SET stock_quantity = stock_quantity + item.quantity
      WHERE product_id = item.product_id AND color = item.color;

      GET DIAGNOSTICS updated_rows = ROW_COUNT;

      IF updated_rows = 0 THEN
        UPDATE public.products
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_order_delete ON public.orders;

CREATE TRIGGER trg_restore_stock_on_order_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_order_delete();
```

- [ ] **Step 2: Review the SQL for correctness**

Confirm: the trigger is `BEFORE DELETE` (so `order_items` still exist when it queries them — cascade deletion of `order_items`/`order_status_history` happens as part of enforcing their foreign keys after this trigger runs, not before); the fallback check (`GET DIAGNOSTICS ... ROW_COUNT`) correctly detects "no matching `product_color_stock` row" and falls back to `products.stock_quantity`, mirroring the approval trigger's own `FOUND`-based fallback logic in spirit (this uses `ROW_COUNT` on an `UPDATE` rather than `SELECT ... FOR UPDATE` + `FOUND`, since there's nothing to lock-then-check here — restoring stock has no insufficient-stock failure mode, so a plain `UPDATE ... WHERE` is sufficient and simpler); a `'pending'` or `'rejected'` order's deletion is a no-op for stock (the `IF OLD.status = 'approved'` guard); `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` make this safe to re-run.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260713010000_reject_delete_approved_order.sql
git commit -m "Add admin order-delete policy and stock-restoring trigger"
```

- [ ] **Step 4: Apply the migration — requires explicit user confirmation first**

Confirm the per-colour-stock plan's migration (`20260713000000_add_product_color_stock.sql`) is already applied. Then tell the user the exact command (`npx supabase db push`) and wait for their go-ahead before running it.

---

### Task 2: `OrderManagement.tsx` — Reject & Delete Button

**Files:**
- Modify: `src/components/admin/OrderManagement.tsx:27` (icon import)
- Modify: `src/components/admin/OrderManagement.tsx` (new `deleteOrder` function, placed after `updateOrderStatus`)
- Modify: `src/components/admin/OrderManagement.tsx:442-458` (detail dialog footer)

**Interfaces:**
- Consumes: the `DELETE` RLS policy and trigger from Task 1.
- Produces: nothing further downstream.

- [ ] **Step 1: Import the `Trash2` icon**

Replace:

```ts
import { Eye, Check, X, RefreshCw } from "lucide-react";
```

with:

```ts
import { Eye, Check, X, RefreshCw, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Add the `deleteOrder` function**

Add immediately after the closing brace of `updateOrderStatus` (i.e. right after its final `};`, before `const getStatusBadge = ...`):

```ts
  const deleteOrder = async (orderId: string) => {
    if (!confirm("Permanently delete this approved order? This cannot be undone. Any stock it consumed will be restored.")) return;
    try {
      const { data: rows, error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .select("id");

      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error("Delete blocked — check your admin permissions");

      toast({
        title: "Success",
        description: "Order deleted",
      });

      fetchOrders();
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error deleting order:", error);
      const message = (error as { message?: string })?.message || "Failed to delete order";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };
```

- [ ] **Step 3: Add the "Reject & Delete" footer for approved orders**

Replace:

```tsx
                          {selectedOrder?.status === 'pending' && (
                            <DialogFooter className="gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => updateOrderStatus(selectedOrder.id, 'rejected', approvalNotes)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                              <Button
                                onClick={() => updateOrderStatus(selectedOrder.id, 'approved', approvalNotes)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                            </DialogFooter>
                          )}
                        </DialogContent>
                      </Dialog>
```

with:

```tsx
                          {selectedOrder?.status === 'pending' && (
                            <DialogFooter className="gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => updateOrderStatus(selectedOrder.id, 'rejected', approvalNotes)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                              <Button
                                onClick={() => updateOrderStatus(selectedOrder.id, 'approved', approvalNotes)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                            </DialogFooter>
                          )}
                          {selectedOrder?.status === 'approved' && (
                            <DialogFooter className="gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => deleteOrder(selectedOrder.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Reject &amp; Delete
                              </Button>
                            </DialogFooter>
                          )}
                        </DialogContent>
                      </Dialog>
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/OrderManagement.tsx
git commit -m "Add Reject & Delete action for approved orders"
```

---

### Task 3: Final Build + Manual Verification

**Files:** none (verification-only task).

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 2: Manual walkthrough (requires Task 1's migration applied)**

1. Open a `'pending'` order — confirm only the existing Approve/Reject buttons show (no Delete option).
2. Approve a test order, note the resulting stock (per-colour or product-level). Reopen it, confirm the new "Reject & Delete" button now shows in place of Approve/Reject.
3. Click "Reject & Delete", confirm the browser confirmation prompt appears, confirm it. Verify: the order disappears from the Orders list; the stock it had consumed is restored to its pre-approval value.
4. Confirm a `'rejected'` order (never approved) has no delete option, and deleting isn't offered for it either.

- [ ] **Step 3: Report back to the user**

Summarize what was verified. If the migration wasn't applied yet, say so explicitly rather than claiming success.
