# Discount Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can create/edit/deactivate date-boxed, optionally usage-capped discount codes (percentage or fixed amount); customers can apply one at checkout; redemption is atomic and race-safe; admin can see which code was applied on an order and in the new-order email.

**Architecture:** A new `discount_codes` table plus a shared PL/pgSQL validation function (`_validate_discount_code`, always taking a row lock) wrapped by two public RPCs: `check_discount_code` (read-only preview, called from the checkout "Apply" button) and `redeem_discount_code` (the same validation plus an atomic `times_used` increment, called by `useOrders.createOrder` right before the order is inserted). `orders` gains `discount_code`/`discount_amount` columns. A new admin CRUD tab manages codes, following `ProductManagement.tsx`'s existing table+dialog pattern.

**Tech Stack:** Supabase Postgres (migration, PL/pgSQL functions, RLS). Vite + React + TypeScript + shadcn/ui for the UI pieces.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-discount-codes-design.md`
- Single discount code per order — no stacking.
- Discount reduces the product subtotal only; shipping is always charged in full.
- No minimum-order-amount threshold, no per-customer restriction — out of scope.
- No retroactive/backfill concerns — this is new functionality with no prior data.
- This repo has no automated test suite. `npm run build` (vite build) is the standard gate for every TypeScript change. The SQL has no local test harness — verification is manual, as described in the final task.
- Codes are matched case-insensitively via a unique index on `UPPER(code)` — never add a plain `UNIQUE` constraint on `code` itself (would allow `"SAVE10"` and `"save10"` to coexist).
- Applying the migration to the linked Supabase project (`qevoycmuuzjwtscfpfyv`) modifies production schema — **do not run `supabase db push` without first telling the user exactly what will run and getting explicit confirmation.**

---

### Task 1: Database — `discount_codes` Table, RLS, and Validation Functions

**Files:**
- Create: `supabase/migrations/20260712010000_add_discount_codes.sql`

**Interfaces:**
- Produces: table `public.discount_codes` (columns: `id`, `code`, `description`, `discount_type`, `discount_value`, `valid_from`, `valid_until`, `max_uses`, `times_used`, `is_active`, `created_by`, `created_at`, `updated_at`). New columns on `public.orders`: `discount_code TEXT`, `discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0`. Two callable RPCs consumed by later tasks: `check_discount_code(p_code TEXT, p_subtotal NUMERIC)` (Task 3) and `redeem_discount_code(p_code TEXT, p_subtotal NUMERIC)` (Task 2) — both return a single row with columns `discount_type TEXT, discount_value NUMERIC, discount_amount NUMERIC`, or raise an exception with a descriptive message on invalidity.

- [ ] **Step 1: Write the migration**

```sql
-- Discount codes: date-boxed, optionally usage-capped codes applied at checkout.

CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  max_uses INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_percentage_max CHECK (discount_type != 'percentage' OR discount_value <= 100),
  CONSTRAINT discount_codes_valid_range CHECK (valid_until > valid_from)
);

CREATE UNIQUE INDEX discount_codes_code_upper_idx ON public.discount_codes (UPPER(code));

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes"
ON public.discount_codes
FOR ALL
USING (public.get_my_role() IN ('admin', 'sales_admin'))
WITH CHECK (public.get_my_role() IN ('admin', 'sales_admin'));

CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- orders gains columns to record which code (if any) was applied
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Shared validation: looks up a code case-insensitively, locks its row
-- (both callers below rely on this lock — see redeem_discount_code), and
-- checks it's currently usable. Returns the matched row's id plus the
-- computed discount amount for the given subtotal, or raises a
-- descriptive exception.
CREATE OR REPLACE FUNCTION public._validate_discount_code(p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  id UUID,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc RECORD;
  computed_amount NUMERIC;
BEGIN
  SELECT * INTO dc
  FROM public.discount_codes
  WHERE UPPER(code) = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discount code not found';
  END IF;

  IF NOT dc.is_active THEN
    RAISE EXCEPTION 'Discount code is no longer active';
  END IF;

  IF now() < dc.valid_from OR now() > dc.valid_until THEN
    RAISE EXCEPTION 'Discount code has expired';
  END IF;

  IF dc.max_uses IS NOT NULL AND dc.times_used >= dc.max_uses THEN
    RAISE EXCEPTION 'Discount code has reached its usage limit';
  END IF;

  IF dc.discount_type = 'percentage' THEN
    computed_amount := round(p_subtotal * dc.discount_value / 100, 2);
  ELSE
    computed_amount := least(dc.discount_value, p_subtotal);
  END IF;

  RETURN QUERY SELECT dc.id, dc.discount_type, dc.discount_value, computed_amount;
END;
$$;

-- Read-only preview — used by the "Apply" button at checkout. The FOR
-- UPDATE lock taken inside _validate_discount_code is released as soon as
-- this function's own (single-statement) transaction ends, so this is
-- safe to call repeatedly without blocking other customers.
CREATE OR REPLACE FUNCTION public.check_discount_code(p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT v.discount_type, v.discount_value, v.discount_amount
  FROM public._validate_discount_code(p_code, p_subtotal) v;
END;
$$;

-- Atomic redemption — called by order creation immediately before the
-- order row is inserted. The lock taken inside _validate_discount_code
-- is held for the remainder of this function's transaction, so the
-- increment below is race-safe against a concurrent redemption of the
-- same code. Raises (aborting order creation) if the code is no longer
-- valid at this point, even if an earlier preview said it was.
CREATE OR REPLACE FUNCTION public.redeem_discount_code(p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM public._validate_discount_code(p_code, p_subtotal);

  UPDATE public.discount_codes
  SET times_used = times_used + 1
  WHERE id = v.id;

  RETURN QUERY SELECT v.discount_type, v.discount_value, v.discount_amount;
END;
$$;
```

- [ ] **Step 2: Review the SQL for correctness**

Confirm: the unique index is on `UPPER(code)`, not a plain unique constraint on `code`; the percentage-max and valid-range CHECK constraints are present; `_validate_discount_code` takes `FOR UPDATE` before any validity check; `redeem_discount_code` increments `times_used` using the same `v.id` returned by the locked validation call (not a fresh unlocked lookup); no explicit `GRANT` statements are needed (this project's existing RPC functions, e.g. `generate_order_number()`, have none and already work from client calls — Supabase's default grants cover this).

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260712010000_add_discount_codes.sql
git commit -m "Add discount_codes table and check/redeem validation functions"
```

- [ ] **Step 4: Apply the migration — requires explicit user confirmation first**

This is a production schema change. Before running anything, tell the user the exact command (`npx supabase db push`) and wait for their go-ahead. Do not proceed to the final manual-verification task (which requires this migration applied) until confirmed.

---

### Task 2: `useOrders.ts` — Redeem Discount Code on Order Creation

**Files:**
- Modify: `src/hooks/useOrders.ts:49` (`createOrder` signature)
- Modify: `src/hooks/useOrders.ts:57-92` (totals calculation, order insert payload)
- Modify: `src/hooks/useOrders.ts:118-135` (`notify-admin-order` invoke body)

**Interfaces:**
- Consumes: `redeem_discount_code` RPC from Task 1.
- Produces: `createOrder(cartItems, notes, accountId, shipping, discountCode)` — new 5th optional parameter `discountCode?: string`. Task 3 (`CheckoutModal.tsx`) passes the customer's applied code string here (or omits it). The function's return shape is unchanged: `{ success, orderId?, order?, error? }`.

- [ ] **Step 1: Add `discountCode` parameter to `createOrder`**

Replace:

```ts
  const createOrder = async (cartItems: CartItem[], notes?: string, accountId?: string, shipping?: ShippingInfo): Promise<{ success: boolean; orderId?: string; order?: any; error?: string }> => {
```

with:

```ts
  const createOrder = async (cartItems: CartItem[], notes?: string, accountId?: string, shipping?: ShippingInfo, discountCode?: string): Promise<{ success: boolean; orderId?: string; order?: any; error?: string }> => {
```

- [ ] **Step 2: Redeem the discount code (if provided) and include it in the totals/insert**

Replace:

```ts
    try {
      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const taxAmount = 0; // GST included in prices
      const shippingCost = shipping?.shippingCost ?? 0;
      const totalAmount = subtotal + shippingCost;

      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number');

      if (orderNumberError) throw orderNumberError;

      // Create order
      const orderData: any = {
        order_number: orderNumberData,
        ...(accountId
          ? { account_id: accountId, ordered_by_contact_id: user.id, customer_id: null }
          : { customer_id: user.id, account_id: null, ordered_by_contact_id: null }
        ),
        subtotal: Number(subtotal.toFixed(2)),
        tax_amount: Number(taxAmount.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
        notes: notes || null,
        shipping_postcode: shipping?.shippingPostcode || null,
        shipping_method: shipping?.shippingMethod || null,
        shipping_cost: Number((shippingCost).toFixed(2)),
        shipping_full_name: shipping?.shippingFullName || null,
        shipping_address: shipping?.shippingAddress || null,
        shipping_suburb: shipping?.shippingSuburb || null,
        shipping_state: shipping?.shippingState || null,
        shipping_email: shipping?.shippingEmail || null,
        shipping_phone: shipping?.shippingPhone || null,
        payment_status: 'unpaid',
        payment_method: 'payid',
      };
```

with:

```ts
    try {
      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const taxAmount = 0; // GST included in prices
      const shippingCost = shipping?.shippingCost ?? 0;

      // Redeem the discount code (if any) — atomic, server-validated, and
      // the authoritative source of the discount amount (never trust the
      // client's earlier preview amount for the actual order total).
      let discountAmount = 0;
      if (discountCode) {
        const { data: discountData, error: discountError } = await supabase
          .rpc('redeem_discount_code', { p_code: discountCode, p_subtotal: subtotal });
        if (discountError) throw discountError;
        const discountRow = Array.isArray(discountData) ? discountData[0] : discountData;
        discountAmount = Number(discountRow?.discount_amount ?? 0);
      }

      const totalAmount = subtotal - discountAmount + shippingCost;

      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number');

      if (orderNumberError) throw orderNumberError;

      // Create order
      const orderData: any = {
        order_number: orderNumberData,
        ...(accountId
          ? { account_id: accountId, ordered_by_contact_id: user.id, customer_id: null }
          : { customer_id: user.id, account_id: null, ordered_by_contact_id: null }
        ),
        subtotal: Number(subtotal.toFixed(2)),
        tax_amount: Number(taxAmount.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
        discount_code: discountCode || null,
        discount_amount: Number(discountAmount.toFixed(2)),
        notes: notes || null,
        shipping_postcode: shipping?.shippingPostcode || null,
        shipping_method: shipping?.shippingMethod || null,
        shipping_cost: Number((shippingCost).toFixed(2)),
        shipping_full_name: shipping?.shippingFullName || null,
        shipping_address: shipping?.shippingAddress || null,
        shipping_suburb: shipping?.shippingSuburb || null,
        shipping_state: shipping?.shippingState || null,
        shipping_email: shipping?.shippingEmail || null,
        shipping_phone: shipping?.shippingPhone || null,
        payment_status: 'unpaid',
        payment_method: 'payid',
      };
```

Note: since `redeem_discount_code` raises an exception for an invalid/expired/exhausted code, `if (discountError) throw discountError;` will propagate to the function's own `catch` block below (unchanged), returning `{ success: false, error: <specific message> }` — no order is created, matching the stock-insufficient failure pattern already established for order approval.

- [ ] **Step 3: Include the discount in the `notify-admin-order` payload**

Replace:

```ts
      // Notify admin of new order (non-blocking)
      supabase.functions.invoke("notify-admin-order", {
        body: {
          orderNumber: orderNumberData,
          customerName: shipping?.shippingFullName || null,
          customerEmail: shipping?.shippingEmail || user.email,
          total: totalAmount,
          items: cartItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, color: i.color })),
          shippingMethod: shipping?.shippingMethod,
          shippingAddress: shipping?.shippingAddress,
          shippingSuburb: shipping?.shippingSuburb,
          shippingState: shipping?.shippingState,
          shippingPostcode: shipping?.shippingPostcode,
          shippingPhone: shipping?.shippingPhone,
        },
      }).then(({ error: fnErr }) => {
```

with:

```ts
      // Notify admin of new order (non-blocking)
      supabase.functions.invoke("notify-admin-order", {
        body: {
          orderNumber: orderNumberData,
          customerName: shipping?.shippingFullName || null,
          customerEmail: shipping?.shippingEmail || user.email,
          total: totalAmount,
          items: cartItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, color: i.color })),
          shippingMethod: shipping?.shippingMethod,
          shippingAddress: shipping?.shippingAddress,
          shippingSuburb: shipping?.shippingSuburb,
          shippingState: shipping?.shippingState,
          shippingPostcode: shipping?.shippingPostcode,
          shippingPhone: shipping?.shippingPhone,
          discountCode: discountCode || null,
          discountAmount: discountAmount || null,
        },
      }).then(({ error: fnErr }) => {
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOrders.ts
git commit -m "Redeem discount code atomically when creating an order"
```

---

### Task 3: `CheckoutModal.tsx` — Discount Code Input and Preview

**Files:**
- Modify: `src/components/CheckoutModal.tsx:51-91` (component state, `total` calculation)
- Modify: `src/components/CheckoutModal.tsx:110-127` (`handleClose`)
- Modify: `src/components/CheckoutModal.tsx:162-211` (`handleSubmit`)
- Modify: `src/components/CheckoutModal.tsx:458-480` (Pricing Breakdown — add Discount Code section before it, and a discount line inside it)

**Interfaces:**
- Consumes: `check_discount_code` RPC from Task 1; `createOrder`'s new `discountCode` parameter from Task 2.
- Produces: nothing further downstream.

- [ ] **Step 1: Add discount-code state and fold it into the `total` calculation**

Replace:

```ts
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = selectedShipping?.price ?? 0;
  const total = subtotal + shippingCost;
```

with:

```ts
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = selectedShipping?.price ?? 0;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const total = subtotal - discountAmount + shippingCost;
```

Add the new state, just after the existing `shippingPhone` state declaration:

```ts
  const [shippingPhone, setShippingPhone] = useState("");

  // ── Discount code state ─────────────────────────────────────────────────
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number; type: string; value: number } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");
```

(This replaces just the `const [shippingPhone, setShippingPhone] = useState("");` line — insert the four new state lines immediately after it, keeping everything else in that block unchanged.)

- [ ] **Step 2: Add the apply/remove handlers**

Add these two new functions, placed right after `handleCalculateShipping` and before `handleSubmit`:

```ts
  const handleApplyDiscount = async () => {
    const trimmed = discountCodeInput.trim();
    if (!trimmed) return;
    setDiscountError("");
    setDiscountLoading(true);
    try {
      const { data, error } = await supabase.rpc("check_discount_code", {
        p_code: trimmed,
        p_subtotal: subtotal,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Discount code not found");
      setAppliedDiscount({
        code: trimmed,
        amount: Number(row.discount_amount),
        type: row.discount_type,
        value: Number(row.discount_value),
      });
    } catch (err) {
      setAppliedDiscount(null);
      setDiscountError(err instanceof Error ? err.message : "Could not apply discount code");
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput("");
    setDiscountError("");
  };
```

- [ ] **Step 3: Reset discount state when the dialog closes**

Replace:

```ts
    setShippingEmail("");
    setShippingPhone("");
    hasPrefilledRef.current = false;
    onClose();
```

with:

```ts
    setShippingEmail("");
    setShippingPhone("");
    setDiscountCodeInput("");
    setAppliedDiscount(null);
    setDiscountError("");
    hasPrefilledRef.current = false;
    onClose();
```

- [ ] **Step 4: Pass the applied code to `createOrder`**

Replace:

```ts
    const accountId = selectedContext === "individual" ? undefined : selectedContext;
    const result = await createOrder(cartItems, notes, accountId, {
      shippingPostcode: postcode || undefined,
      shippingMethod: selectedShipping?.name,
      shippingCost: shippingCost,
      shippingFullName,
      shippingAddress,
      shippingSuburb,
      shippingState,
      shippingEmail,
      shippingPhone,
    });
```

with:

```ts
    const accountId = selectedContext === "individual" ? undefined : selectedContext;
    const result = await createOrder(cartItems, notes, accountId, {
      shippingPostcode: postcode || undefined,
      shippingMethod: selectedShipping?.name,
      shippingCost: shippingCost,
      shippingFullName,
      shippingAddress,
      shippingSuburb,
      shippingState,
      shippingEmail,
      shippingPhone,
    }, appliedDiscount?.code);
```

- [ ] **Step 5: Add the Discount Code section and the discount line in the Pricing Breakdown**

Replace:

```tsx
              <Separator />

              {/* Pricing Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {selectedShipping && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Shipping ({selectedShipping.name})</span>
                    <span>${shippingCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST included in price</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
```

with:

```tsx
              <Separator />

              {/* Discount Code */}
              <div className="space-y-2">
                <Label htmlFor="discountCode">Discount Code</Label>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                    <div>
                      <p className="text-sm font-medium">{appliedDiscount.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {appliedDiscount.type === "percentage"
                          ? `${appliedDiscount.value}% off`
                          : `$${appliedDiscount.value.toFixed(2)} off`}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveDiscount}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="discountCode"
                      placeholder="Enter code"
                      value={discountCodeInput}
                      onChange={(e) => setDiscountCodeInput(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyDiscount}
                      disabled={discountLoading || !discountCodeInput.trim()}
                      className="shrink-0"
                    >
                      {discountLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
                {discountError && <p className="text-sm text-destructive">{discountError}</p>}
              </div>

              <Separator />

              {/* Pricing Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({appliedDiscount.code})</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {selectedShipping && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Shipping ({selectedShipping.name})</span>
                    <span>${shippingCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST included in price</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
```

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/CheckoutModal.tsx
git commit -m "Add discount code entry and preview to checkout"
```

---

### Task 4: Admin — `DiscountManagement.tsx`

**Files:**
- Create: `src/components/admin/DiscountManagement.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (reads/writes `discount_codes` directly via RLS-gated admin access, per Task 1).
- Produces: the `DiscountManagement` component, imported and wired into the admin sidebar by Task 5.

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, RefreshCw, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
}

interface FormData {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  valid_from: string;
  valid_until: string;
  max_uses: string;
  is_active: boolean;
}

export const DiscountManagement = () => {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const { toast } = useToast();

  const emptyForm = (): FormData => ({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    is_active: true,
  });

  const [formData, setFormData] = useState<FormData>(emptyForm());

  useEffect(() => { fetchCodes(); }, []);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCodes((data as unknown as DiscountCode[]) || []);
    } catch (error) {
      console.error("Error fetching discount codes:", error);
      toast({ title: "Error", description: "Failed to load discount codes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingCode(null);
  };

  const handleEdit = (dc: DiscountCode) => {
    setEditingCode(dc);
    setFormData({
      code: dc.code,
      description: dc.description || "",
      discount_type: dc.discount_type,
      discount_value: dc.discount_value.toString(),
      valid_from: dc.valid_from.slice(0, 10),
      valid_until: dc.valid_until.slice(0, 10),
      max_uses: dc.max_uses?.toString() || "",
      is_active: dc.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const discountValue = parseFloat(formData.discount_value);
      if (formData.discount_type === "percentage" && discountValue > 100) {
        toast({ title: "Invalid value", description: "A percentage discount can't exceed 100.", variant: "destructive" });
        return;
      }

      const codeData = {
        code: formData.code.trim(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: discountValue,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        is_active: formData.is_active,
      };

      let error: { message?: string } | null = null;
      if (editingCode) {
        const { data: rows, error: updateError } = await supabase
          .from("discount_codes")
          .update(codeData)
          .eq("id", editingCode.id)
          .select("id");
        error = updateError;
        if (!updateError && (!rows || rows.length === 0)) {
          error = new Error("Update blocked — check your admin permissions");
        }
      } else {
        const { error: insertError } = await supabase.from("discount_codes").insert(codeData);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Success", description: `Discount code ${editingCode ? "updated" : "created"} successfully` });
      setIsDialogOpen(false);
      resetForm();
      fetchCodes();
    } catch (error) {
      console.error("Error saving discount code:", error);
      const message = (error as { message?: string })?.message || `Failed to ${editingCode ? "update" : "create"} discount code`;
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (dc: DiscountCode) => {
    try {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active: !dc.is_active })
        .eq("id", dc.id);
      if (error) throw error;
      toast({ title: "Success", description: `Discount code ${dc.is_active ? "deactivated" : "activated"}` });
      fetchCodes();
    } catch (error) {
      console.error("Error toggling discount code:", error);
      toast({ title: "Error", description: "Failed to update discount code", variant: "destructive" });
    }
  };

  const formatValue = (dc: DiscountCode) =>
    dc.discount_type === "percentage" ? `${dc.discount_value}%` : `$${dc.discount_value.toFixed(2)}`;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Discount Codes</h2>
          <p className="text-muted-foreground">Create and manage checkout discount codes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchCodes} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Discount Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCode ? "Edit Discount Code" : "Add Discount Code"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. SAVE10"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Internal note about this code"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="discount_type">Type</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(v) => setFormData({ ...formData, discount_type: v as "percentage" | "fixed" })}
                    >
                      <SelectTrigger id="discount_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="discount_value">
                      Value {formData.discount_type === "percentage" ? "(%)" : "($ AUD)"}
                    </Label>
                    <Input
                      id="discount_value"
                      type="number"
                      step="0.01"
                      min="0"
                      max={formData.discount_type === "percentage" ? "100" : undefined}
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="valid_from">Valid From</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="valid_until">Valid Until</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max_uses">Max Uses (Optional — blank for unlimited)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit">{editingCode ? "Save Changes" : "Create Code"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((dc) => (
                <TableRow key={dc.id}>
                  <TableCell className="font-mono font-medium">{dc.code}</TableCell>
                  <TableCell className="capitalize">{dc.discount_type}</TableCell>
                  <TableCell>{formatValue(dc)}</TableCell>
                  <TableCell>{format(new Date(dc.valid_from), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{format(new Date(dc.valid_until), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{dc.times_used}{dc.max_uses ? ` / ${dc.max_uses}` : " / Unlimited"}</TableCell>
                  <TableCell>
                    <Badge variant={dc.is_active ? "default" : "secondary"}>
                      {dc.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(dc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(dc)}>
                        {dc.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {codes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No discount codes yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/DiscountManagement.tsx
git commit -m "Add admin Discount Codes CRUD component"
```

---

### Task 5: `AdminDashboard.tsx` — Wire In the Discounts Tab

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `DiscountManagement` from Task 4.
- Produces: nothing further downstream.

**Note:** this file may already have an unrelated, uncommitted local change (an improved "Access denied" screen) when you start this task — that's expected pre-existing work in the repo, not something from an earlier task in this plan. Make your edits on top of whatever the file's current content is; do not revert anything you didn't add.

- [ ] **Step 1: Import `DiscountManagement` and add the `Percent` icon**

In the icon import block (`from "lucide-react"`), add `Percent` to the destructured imports. In the component-imports block, add:

```ts
import { DiscountManagement } from "@/components/admin/DiscountManagement";
```

(Place it alongside the other `@/components/admin/*` imports, e.g. right after the `AccountContactRelationship` import.)

- [ ] **Step 2: Add the nav item**

In `navigationItems`, add a new entry. Find:

```ts
    { id: "account-contacts", label: "Account Contacts", icon: Settings },
  ];
```

Replace with:

```ts
    { id: "account-contacts", label: "Account Contacts", icon: Settings },
    { id: "discounts", label: "Discounts", icon: Percent },
  ];
```

- [ ] **Step 3: Add the render case**

Find:

```ts
      case "account-contacts":
        return <AccountContactRelationship />;
      default:
```

Replace with:

```ts
      case "account-contacts":
        return <AccountContactRelationship />;
      case "discounts":
        return <DiscountManagement />;
      default:
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "Add Discounts tab to admin dashboard"
```

If `git status` shows this file's diff includes more than your 3 changes above (i.e. it includes the pre-existing unrelated local change described in the note), that's expected — commit the file as-is; do not try to split or revert the unrelated portion.

---

### Task 6: `OrderManagement.tsx` — Show Applied Discount

**Files:**
- Modify: `src/components/admin/OrderManagement.tsx:39-60` (`Order` interface)
- Modify: `src/components/admin/OrderManagement.tsx:337-358` (detail dialog's summary grid)

**Interfaces:**
- Consumes: `orders.discount_code`/`discount_amount` columns from Task 1 (already returned by the existing `.select("*")` in `fetchOrders` — no query change needed).
- Produces: nothing further downstream.

- [ ] **Step 1: Extend the `Order` interface**

Replace:

```ts
interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  notes: string | null;
  customer_id: string | null;
  account_id: string | null;
  shipping_method: string | null;
  shipping_cost: number | null;
  shipping_full_name: string | null;
  shipping_address: string | null;
  shipping_suburb: string | null;
  shipping_state: string | null;
  shipping_postcode: string | null;
  shipping_email: string | null;
  shipping_phone: string | null;
  profiles?: { full_name: string; email: string } | null;
  accounts?: { name: string } | null;
}
```

with:

```ts
interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  notes: string | null;
  customer_id: string | null;
  account_id: string | null;
  shipping_method: string | null;
  shipping_cost: number | null;
  shipping_full_name: string | null;
  shipping_address: string | null;
  shipping_suburb: string | null;
  shipping_state: string | null;
  shipping_postcode: string | null;
  shipping_email: string | null;
  shipping_phone: string | null;
  discount_code: string | null;
  discount_amount: number | null;
  profiles?: { full_name: string; email: string } | null;
  accounts?: { name: string } | null;
}
```

- [ ] **Step 2: Show the discount in the detail dialog**

Replace:

```tsx
                                <div>
                                  <label className="text-sm font-medium">Payment</label>
                                  <p className="text-sm text-muted-foreground">{getPaymentBadge(selectedOrder.payment_status)}</p>
                                </div>
                                {selectedOrder.shipping_method && (
                                  <div>
                                    <label className="text-sm font-medium">Shipping</label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedOrder.shipping_method} — ${(selectedOrder.shipping_cost ?? 0).toFixed(2)}
                                    </p>
                                  </div>
                                )}
                              </div>
```

with:

```tsx
                                <div>
                                  <label className="text-sm font-medium">Payment</label>
                                  <p className="text-sm text-muted-foreground">{getPaymentBadge(selectedOrder.payment_status)}</p>
                                </div>
                                {selectedOrder.shipping_method && (
                                  <div>
                                    <label className="text-sm font-medium">Shipping</label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedOrder.shipping_method} — ${(selectedOrder.shipping_cost ?? 0).toFixed(2)}
                                    </p>
                                  </div>
                                )}
                                {selectedOrder.discount_code && (
                                  <div>
                                    <label className="text-sm font-medium">Discount</label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedOrder.discount_code} — -${(selectedOrder.discount_amount ?? 0).toFixed(2)}
                                    </p>
                                  </div>
                                )}
                              </div>
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/OrderManagement.tsx
git commit -m "Show applied discount code in admin order detail view"
```

---

### Task 7: `notify-admin-order` — Show Applied Discount in the Email

**Files:**
- Modify: `supabase/functions/notify-admin-order/index.ts:22-25` (payload destructuring)
- Modify: `supabase/functions/notify-admin-order/index.ts:100-105` (new-order email meta block)

**Interfaces:**
- Consumes: `discountCode`/`discountAmount` fields added to the `notify-admin-order` payload by Task 2.
- Produces: nothing further downstream.

- [ ] **Step 1: Destructure the new fields**

Replace:

```ts
    const {
      orderNumber, customerName, customerEmail, total, items, shippingMethod, paymentClaimed,
      shippingAddress, shippingSuburb, shippingState, shippingPostcode, shippingPhone,
    } = await req.json();
```

with:

```ts
    const {
      orderNumber, customerName, customerEmail, total, items, shippingMethod, paymentClaimed,
      shippingAddress, shippingSuburb, shippingState, shippingPostcode, shippingPhone,
      discountCode, discountAmount,
    } = await req.json();
```

- [ ] **Step 2: Show the discount in the new-order email's meta block**

Replace:

```ts
      <div class="meta">
        <p><strong>Customer:</strong> ${escapeHtml(customerName) || "—"}</p>
        <p><strong>Email:</strong> ${escapeHtml(customerEmail) || "—"}</p>
        ${shippingPhone ? `<p><strong>Phone:</strong> ${escapeHtml(shippingPhone)}</p>` : ""}
        ${shippingAddress ? `<p><strong>Ship to:</strong> ${escapeHtml(shippingAddress)}${shippingSuburb ? `, ${escapeHtml(shippingSuburb)}` : ""}${shippingState ? ` ${escapeHtml(shippingState)}` : ""}${shippingPostcode ? ` ${escapeHtml(shippingPostcode)}` : ""}</p>` : ""}
        ${shippingMethod ? `<p><strong>Shipping:</strong> ${escapeHtml(shippingMethod)}</p>` : ""}
      </div>
```

with:

```ts
      <div class="meta">
        <p><strong>Customer:</strong> ${escapeHtml(customerName) || "—"}</p>
        <p><strong>Email:</strong> ${escapeHtml(customerEmail) || "—"}</p>
        ${shippingPhone ? `<p><strong>Phone:</strong> ${escapeHtml(shippingPhone)}</p>` : ""}
        ${shippingAddress ? `<p><strong>Ship to:</strong> ${escapeHtml(shippingAddress)}${shippingSuburb ? `, ${escapeHtml(shippingSuburb)}` : ""}${shippingState ? ` ${escapeHtml(shippingState)}` : ""}${shippingPostcode ? ` ${escapeHtml(shippingPostcode)}` : ""}</p>` : ""}
        ${shippingMethod ? `<p><strong>Shipping:</strong> ${escapeHtml(shippingMethod)}</p>` : ""}
        ${discountCode ? `<p><strong>Discount:</strong> ${escapeHtml(discountCode)} (-$${Number(discountAmount ?? 0).toFixed(2)})</p>` : ""}
      </div>
```

- [ ] **Step 3: Manual syntax read-through**

No local Deno CLI or build covers this file (established convention from the earlier shipping/colour feature). After editing, read the full modified template literal once to confirm balanced backticks/`${}`/HTML tags, the same way the earlier feature's equivalent task verified this file.

- [ ] **Step 4: Deploy the edge function — requires explicit user confirmation first**

Tell the user the exact command (`npx supabase functions deploy notify-admin-order`) and wait for their go-ahead before running it.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-admin-order/index.ts
git commit -m "Show applied discount code in the new-order notification email"
```

---

### Task 8: Final Build + Manual Verification

**Files:** none (verification-only task).

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 2: Manual walkthrough (requires Task 1's migration applied and Task 7's function deployed)**

1. In the admin Discounts tab, create a percentage code (e.g. `SAVE10`, 10%, valid from today, valid until a week out, no usage cap) and a fixed-amount code (e.g. `FLAT15`, $15, same date range, `max_uses` = 1).
2. At checkout, apply `SAVE10` — confirm the preview shows the correct discount line and updated total, without incrementing anything yet (re-fetch the code in the admin tab and confirm `times_used` is still 0).
3. Complete the order — confirm `orders.discount_code`/`discount_amount` are set correctly, `times_used` is now 1, and the total matches subtotal − discount + shipping.
4. Apply `FLAT15` (max_uses = 1) on a second order and complete it — confirm it succeeds and `times_used` reaches its cap (1/1).
5. Attempt to apply `FLAT15` again on a third order — confirm checkout shows "Discount code has reached its usage limit" and does not let the order proceed with that code.
6. Try an unknown code, and a code outside its date range (edit one's `valid_until` to yesterday in the admin tab) — confirm the specific error shows each time.
7. Confirm the admin Orders tab and the new-order notification email both show the applied code and amount for orders 3 and 4's orders (the ones that succeeded).

- [ ] **Step 3: Report back to the user**

Summarize what was verified. If the migration/function deploy weren't done yet, or live email delivery couldn't be observed, say so explicitly rather than claiming success.
