# Discount Codes — Design

## Context

There is no discount/coupon mechanism anywhere in the codebase today. Admin needs to create time-boxed discount codes; customers need to be able to enter one at checkout to reduce their order total.

## Goals

- Admin can create/edit/deactivate discount codes with a percentage or fixed-amount value, an active date range, and an optional usage cap, via a new admin dashboard tab.
- A customer can enter a code at checkout, see the resulting discount before placing the order, and have it applied to the order total.
- Redemption (consuming a limited-use code's allowance) is atomic and race-safe — two customers can't both successfully redeem the last use of a capped code.
- Admin can see which code (if any) was applied to an order, and by how much, in the Orders tab and in the new-order notification email.

## Non-goals

- No stacking multiple codes on one order — a single code per order, replacing the codebase's simplest reasonable assumption.
- No minimum-order-amount threshold, no per-account/per-customer restrictions, no code auto-generation — admin manually types the code string.
- No change to how `total_amount` is otherwise computed/trusted — this codebase already computes and stores order totals client-side without server-side re-verification (established in the shipping/colour/payment-status feature), and admin manually reviews every order before approving. This feature keeps that same trust model for the arithmetic, while making the *redemption count* (an integrity-sensitive shared resource, like stock) atomic and server-enforced.
- Discount reduces the product subtotal only — shipping is charged in full regardless of an applied code.

## Data Model

New migration, new table:

```sql
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  max_uses INTEGER,                    -- NULL = unlimited
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_percentage_max CHECK (discount_type != 'percentage' OR discount_value <= 100),
  CONSTRAINT discount_codes_valid_range CHECK (valid_until > valid_from)
);

CREATE UNIQUE INDEX discount_codes_code_upper_idx ON public.discount_codes (UPPER(code));
```

Codes are matched case-insensitively (`UPPER(code) = UPPER(input)`) via the unique index above, so `"SAVE10"` and `"save10"` can't both be created and a customer can type either case.

RLS: admin (`get_my_role()`) gets full SELECT/INSERT/UPDATE/DELETE, matching the existing admin-policy pattern (e.g. `ProductManagement`'s tables). No public SELECT policy is added — customers never query this table directly; they go through the two functions below, which run `SECURITY DEFINER` and don't leak other codes' details.

`orders` gains two columns: `discount_code TEXT` (the code as entered, nullable) and `discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0`.

## Two Postgres Functions

**`check_discount_code(p_code TEXT, p_subtotal NUMERIC)`** — read-only preview. Looks up the code case-insensitively, validates `is_active`, `now()` within `[valid_from, valid_until]`, and (if `max_uses` is set) `times_used < max_uses`. Returns the computed discount amount (percentage: `round(subtotal * value / 100, 2)`; fixed: `least(value, subtotal)`, so it never exceeds the subtotal) and echoes back `discount_type`/`discount_value` for display, or raises a descriptive exception (`"Discount code not found"`, `"Discount code has expired"`, `"Discount code is no longer active"`, `"Discount code has reached its usage limit"`). Does **not** touch `times_used`. Called when the customer clicks "Apply" in checkout.

**`redeem_discount_code(p_code TEXT, p_subtotal NUMERIC)`** — the mutating counterpart, called by `useOrders.createOrder` immediately before inserting the order row. `SELECT ... FOR UPDATE` locks the code's row, re-runs the same validity checks (closing the race window between "Apply" and "Place Order" — e.g. the code could expire or exhaust its cap in between), and if still valid, increments `times_used` by 1 and returns the discount amount. If invalid, raises the same descriptive exception, aborting order creation entirely — no order row is created, no partial state.

Both functions share the same validation logic (implemented once, reused by both, to avoid the two diverging over time).

## Checkout (`CheckoutModal.tsx`)

New "Discount Code" row in the pricing section: a text input + "Apply" button. Applying calls `check_discount_code` via `supabase.rpc(...)`; on success, shows a green `Discount (SAVE10): -$5.00` line in the price breakdown (between Subtotal and Shipping) and a way to clear/remove it before submitting. On failure, a toast shows the specific reason.

On submit, the applied code (if any) is passed to `createOrder`, which calls `redeem_discount_code` server-side — the actual, authoritative redemption — and uses its returned amount (not the client's earlier preview) to compute `total_amount = subtotal - discount_amount + shipping_cost` and to populate the order's `discount_code`/`discount_amount` columns. If redemption fails at this point (rare — only if the code's status changed between preview and submit), order creation fails with that specific error, same as an insufficient-stock failure today.

## Admin Visibility

**New "Discounts" tab** (`src/components/admin/DiscountManagement.tsx`, wired into `AdminDashboard.tsx`'s sidebar `navigationItems`/`renderContent`): a CRUD table (code, type, value, valid from/until, uses — `times_used / max_uses` or "Unlimited" — active toggle, actions) and a create/edit dialog form, following the same table + dialog pattern already used by `ProductManagement.tsx`.

**`OrderManagement.tsx`**: when `order.discount_code` is set, show it (with the amount) in the order detail dialog, alongside the existing Total/Payment/Shipping fields.

**`notify-admin-order` email**: when a discount was applied, show the code and amount in the new-order email's meta block, alongside the existing shipping/customer details.

## Testing

No automated test suite exists in this repo (established convention). Verification is `npm run build` plus manual checks:
- Create a code (both percentage and fixed variants) in the admin Discounts tab; confirm it appears correctly and can be edited/deactivated.
- Apply a valid code at checkout → discount line appears with the correct amount; complete the order → `orders.discount_code`/`discount_amount` are set correctly, `times_used` incremented by exactly 1.
- Apply an expired/inactive/usage-exhausted code → checkout shows the specific error, no order created, `times_used` unchanged.
- Apply a code, then let it expire/exhaust before clicking "Place Order" → order creation fails with the specific error at that point (not silently succeeding with a stale preview).
- Confirm the admin Orders tab and the new-order email both show the applied code and amount.
