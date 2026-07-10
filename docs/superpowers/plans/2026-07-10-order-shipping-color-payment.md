# Order Colour, Shipping Details & Payment Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the customer's chosen product colour and full shipping/contact details at checkout, mark orders "Paid" when the customer confirms payment, and surface all three in the admin Orders tab and the admin notification email.

**Architecture:** Colour flows from the existing (currently cosmetic) product colour-swatch selectors, through the cart, into a new `order_items.color` column. Shipping/contact fields are collected in a new checkout form section and stored as new columns on `orders`. Payment confirmation is a client-side update to the existing `orders.payment_status` column, triggered when the customer clicks "Done — I've made the transfer". All three surface in `OrderManagement.tsx` (admin dashboard) and the `notify-admin-order` edge function email.

**Tech Stack:** Vite + React + TypeScript + Tailwind + shadcn/ui (Radix) + Supabase (Postgres + Edge Functions, Deno).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-10-order-shipping-color-payment-design.md`
- No real payment gateway — payment stays customer self-reported (per spec Non-goals). Do not add webhook/gateway integration.
- Do not touch `accounts.shipping_address` (B2B account-level field) — separate from the new per-order shipping fields.
- Do not add DB `NOT NULL` constraints on the new columns — "mandatory" is enforced only in the checkout form (spec: existing rows have no data for these columns).
- `src/integrations/supabase/types.ts` is already out of date relative to migrations in production (missing `shipping_postcode`, `payment_status`, etc. from earlier migrations) and the codebase already works around this with locally-declared interfaces per file and `any`-typed insert payloads (see `OrderManagement.tsx`, `useOrders.ts`). Follow the same convention for the new columns — do **not** attempt to regenerate `types.ts`.
- This project has no automated test suite (`package.json` has no test script, no `vitest`/`jest` config, no `tests/` directory). `npm run build` (`vite build`) is confirmed to run cleanly with zero errors on the current `main` branch — use it as the verification gate after every task instead of a test runner. Note: `npx tsc -b --noEmit` is **not** clean on this branch already (pre-existing, unrelated `framer-motion`/`Product`-type errors) — do not use it as a pass/fail gate.
- Colour label `"default"` means "no colour variants for this product" — never display it to the customer or admin as a real colour value.
- Applying the new migration to the linked Supabase project modifies production schema — **do not run `supabase db push` (or any command that applies it to the live database) without first telling the user exactly what will run and getting explicit confirmation.** This is called out again in Task 1.

---

### Task 1: Database Migration — Order Colour & Shipping/Contact Columns

**Files:**
- Create: `supabase/migrations/20260710000000_add_color_and_shipping_contact.sql`

**Interfaces:**
- Produces: `public.order_items.color TEXT` (nullable). `public.orders.shipping_full_name`, `shipping_address`, `shipping_suburb`, `shipping_state`, `shipping_email`, `shipping_phone` (all `TEXT`, nullable). `public.orders.shipping_postcode` already exists (migration `20260423000000_add_shipping_to_orders.sql`) and is reused — not recreated here.

- [ ] **Step 1: Write the migration file**

```sql
-- Add per-item colour and per-order shipping/contact details.
-- Nullable at the DB level; "mandatory" is enforced in the checkout form.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_full_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_suburb    TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_email     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_phone     TEXT;
```

- [ ] **Step 2: Review the SQL for correctness**

Confirm every `ADD COLUMN` uses `IF NOT EXISTS` (safe to re-run) and that no constraint or default is added, matching the Global Constraints note above.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260710000000_add_color_and_shipping_contact.sql
git commit -m "Add order_items.color and orders shipping/contact columns"
```

- [ ] **Step 4: Apply the migration — requires explicit user confirmation first**

This is a production schema change. Before running anything, tell the user the exact command you're about to run (`npx supabase db push`, or equivalent) against the linked project (`supabase/config.toml` → `project_id = "qevoycmuuzjwtscfpfyv"`) and wait for their go-ahead. Do not proceed to Task 8's manual end-to-end verification (which requires these columns to exist) until the migration has been applied and you've confirmed with the user it succeeded.

---

### Task 2: `useOrders` Hook — Accept Colour, Shipping/Contact Fields on Order Creation

**Files:**
- Modify: `src/hooks/useOrders.ts:21-29` (`CartItem` interface)
- Modify: `src/hooks/useOrders.ts:36-40` (`ShippingInfo` interface)
- Modify: `src/hooks/useOrders.ts:64-79` (`orderData` insert payload)
- Modify: `src/hooks/useOrders.ts:90-96` (`orderItems` insert payload)
- Modify: `src/hooks/useOrders.ts:104-116` (`notify-admin-order` invoke body)

**Interfaces:**
- Consumes: nothing new from other tasks (this is the lowest layer touched).
- Produces: `CartItem` now requires `color: string`. `ShippingInfo` gains optional `shippingFullName`, `shippingAddress`, `shippingSuburb`, `shippingState`, `shippingEmail`, `shippingPhone` (all `string | undefined`). `createOrder(cartItems, notes, accountId, shipping)` writes these onto the `orders` insert and `order_items` insert, and includes them (plus per-item `color`) in the `notify-admin-order` payload. Return shape unchanged: `{ success: boolean; orderId?: string; order?: any; error?: string }` — `orderId` is what Task 6/7 will use to mark the order paid later.

- [ ] **Step 1: Add `color` to the local `CartItem` interface**

In `src/hooks/useOrders.ts`, replace:

```ts
interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
}
```

with:

```ts
interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
  color: string;
}
```

- [ ] **Step 2: Extend `ShippingInfo` with shipping/contact fields**

Replace:

```ts
interface ShippingInfo {
  shippingPostcode?: string;
  shippingMethod?: string;
  shippingCost?: number;
}
```

with:

```ts
interface ShippingInfo {
  shippingPostcode?: string;
  shippingMethod?: string;
  shippingCost?: number;
  shippingFullName?: string;
  shippingAddress?: string;
  shippingSuburb?: string;
  shippingState?: string;
  shippingEmail?: string;
  shippingPhone?: string;
}
```

- [ ] **Step 3: Write the new fields onto the `orders` insert**

In the `orderData` object inside `createOrder`, add the six new fields after the existing `shipping_cost` line:

```ts
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

- [ ] **Step 4: Write `color` onto each `order_items` insert row**

Replace:

```ts
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: Number((item.price * item.quantity).toFixed(2)),
      }));
```

with:

```ts
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: Number((item.price * item.quantity).toFixed(2)),
        color: item.color,
      }));
```

- [ ] **Step 5: Enrich the `notify-admin-order` payload**

Replace:

```ts
      supabase.functions.invoke("notify-admin-order", {
        body: {
          orderNumber: orderNumberData,
          customerName: null,
          customerEmail: user.email,
          total: totalAmount,
          items: cartItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
          shippingMethod: shipping?.shippingMethod,
        },
      }).then(({ error: fnErr }) => {
```

with:

```ts
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

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exits 0, no new errors (this file has no compile-time consumers changed yet, so this mainly checks for syntax mistakes).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useOrders.ts
git commit -m "Capture colour and shipping/contact details when creating an order"
```

---

### Task 3: Colour Selection — Pass Chosen Colour to `onAddToCart`

**Files:**
- Modify: `src/components/ProductCardDB.tsx:56` (prop type), `:116` (call site)
- Modify: `src/components/ProductDetailModal.tsx:47` (prop type), `:76-81` (call site)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `onAddToCart` callback type in both components becomes `(product: Product, quantity: number, color: string) => void`. The `color` argument passed is the currently active colour label (`colorLabels[activeColor]` / `colorImages[activeColor]?.color`), falling back to the literal string `"default"` when the product has no colour variants. Task 4 (`Index.tsx`) consumes this new third argument.

- [ ] **Step 1: Update `ProductCardDB.tsx`'s prop type and call site**

Replace:

```ts
interface ProductCardDBProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  onProductClick?: (product: Product) => void;
}
```

with:

```ts
interface ProductCardDBProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number, color: string) => void;
  onProductClick?: (product: Product) => void;
}
```

Replace:

```ts
  const handleAddToCart = () => { onAddToCart(product, quantity); setQuantity(minQty); };
```

with:

```ts
  const handleAddToCart = () => {
    onAddToCart(product, quantity, colorLabels[activeColor] ?? "default");
    setQuantity(minQty);
  };
```

(`colorLabels` and `activeColor` are already defined earlier in this component — `colorLabels` at line 89, `activeColor` from `useSetActiveProduct()` at line 92.)

- [ ] **Step 2: Update `ProductDetailModal.tsx`'s prop type and call site**

Replace:

```ts
interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}
```

with:

```ts
interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, color: string) => void;
}
```

Replace:

```ts
  const handleAdd = () => {
    if (product) {
      onAddToCart(product, quantity);
      onClose();
    }
  };
```

with:

```ts
  const handleAdd = () => {
    if (product) {
      onAddToCart(product, quantity, colorImages[activeColor]?.color ?? "default");
      onClose();
    }
  };
```

(`colorImages` and `activeColor` are already defined earlier in this component — `colorImages` at line 60, `activeColor` from `useSetActiveProduct()` at line 57.)

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: fails at this point — `Index.tsx` still passes `handleAddToCart` (2-arg) where these components now require a 3-arg callback. This is expected; Task 4 fixes it. Confirm the *only* new errors are about `onAddToCart`/`handleAddToCart` arity in `Index.tsx`, nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductCardDB.tsx src/components/ProductDetailModal.tsx
git commit -m "Pass selected colour through to onAddToCart"
```

---

### Task 4: `Index.tsx` — Cart State Keyed by Product + Colour

**Files:**
- Modify: `src/pages/Index.tsx:22-30` (`CartItem` interface)
- Modify: `src/pages/Index.tsx:53-80` (`handleAddToCart`)
- Modify: `src/pages/Index.tsx:82-90` (`handleUpdateQuantity`, `handleRemoveItem`)

**Interfaces:**
- Consumes: `onAddToCart: (product, quantity, color) => void` signature from Task 3.
- Produces: `CartItem` gains `color: string`. `handleUpdateQuantity(id: string, color: string, quantity: number)` and `handleRemoveItem(id: string, color: string)` — both now take `color` as their second argument. Task 5 (`Cart.tsx`) consumes these new signatures.

- [ ] **Step 1: Add `color` to `CartItem`**

Replace:

```ts
interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
}
```

with:

```ts
interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
  color: string;
}
```

- [ ] **Step 2: Match cart lines by product id *and* colour**

Replace the whole `handleAddToCart` function:

```ts
  const handleAddToCart = (product: Product, quantity: number) => {
    if (!isAuthenticated) {
      toast({ title: "Sign In Required", description: "Please sign in to add pieces to your bag." });
      setShowAuthModal(true);
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          quantity,
          unit: product.unit,
          sku: product.sku,
        },
      ];
    });
    toast({ title: "Added to bag", description: `${quantity}× ${product.name}` });
  };
```

with:

```ts
  const handleAddToCart = (product: Product, quantity: number, color: string) => {
    if (!isAuthenticated) {
      toast({ title: "Sign In Required", description: "Please sign in to add pieces to your bag." });
      setShowAuthModal(true);
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.color === color);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id && item.color === color
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          quantity,
          unit: product.unit,
          sku: product.sku,
          color,
        },
      ];
    });
    toast({ title: "Added to bag", description: `${quantity}× ${product.name}` });
  };
```

- [ ] **Step 3: Update `handleUpdateQuantity` and `handleRemoveItem` to key by id + colour**

Replace:

```ts
  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) { handleRemoveItem(id); return; }
    setCartItems((prev) => prev.map((item) => item.id === id ? { ...item, quantity } : item));
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Removed from bag" });
  };
```

with:

```ts
  const handleUpdateQuantity = (id: string, color: string, quantity: number) => {
    if (quantity === 0) { handleRemoveItem(id, color); return; }
    setCartItems((prev) =>
      prev.map((item) => (item.id === id && item.color === color ? { ...item, quantity } : item))
    );
  };

  const handleRemoveItem = (id: string, color: string) => {
    setCartItems((prev) => prev.filter((item) => !(item.id === id && item.color === color)));
    toast({ title: "Removed from bag" });
  };
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: fails — `Cart.tsx`'s `onUpdateQuantity`/`onRemoveItem` prop types and call sites don't match the new 3-arg/2-arg signatures yet. Confirm the *only* new errors are in `Cart.tsx`; Task 5 fixes them.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "Key cart items by product id and colour"
```

---

### Task 5: `Cart.tsx` — Display Colour, Update Quantity/Remove Callbacks

**Files:**
- Modify: `src/components/Cart.tsx:8-15` (`CartItem` interface)
- Modify: `src/components/Cart.tsx:17-25` (`CartProps` interface)
- Modify: `src/components/Cart.tsx:84-139` (item list rendering)

**Interfaces:**
- Consumes: `handleUpdateQuantity(id, color, quantity)` / `handleRemoveItem(id, color)` from Task 4, passed in as `onUpdateQuantity` / `onRemoveItem` props.
- Produces: nothing further downstream — this is a leaf UI component.

- [ ] **Step 1: Add `color` to `CartItem` and update `CartProps` callback signatures**

Replace:

```ts
interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

with:

```ts
interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  color: string;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, color: string, quantity: number) => void;
  onRemoveItem: (id: string, color: string) => void;
  onCheckout: () => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

- [ ] **Step 2: Key each cart line by id + colour, show the colour, and pass colour through the callbacks**

Replace the `items.map((item) => ( ... ))` block:

```tsx
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group flex gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-border transition-colors duration-150"
                >
                  {/* Product colour swatch placeholder */}
                  <div className="h-12 w-12 rounded-lg gradient-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary/40" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider truncate">
                        {item.brand}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-card-foreground line-clamp-1 leading-snug">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${item.price.toFixed(2)} / {item.unit}
                    </p>

                    {/* Qty controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-semibold tabular-nums min-w-[1.5rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors duration-150 cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-sm font-bold text-foreground">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
```

with:

```tsx
              {items.map((item) => (
                <div
                  key={`${item.id}-${item.color}`}
                  className="group flex gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-border transition-colors duration-150"
                >
                  {/* Product colour swatch placeholder */}
                  <div className="h-12 w-12 rounded-lg gradient-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary/40" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider truncate">
                        {item.brand}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-card-foreground line-clamp-1 leading-snug">
                      {item.name}
                    </p>
                    {item.color && item.color !== "default" && (
                      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mt-0.5">
                        {item.color}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${item.price.toFixed(2)} / {item.unit}
                    </p>

                    {/* Qty controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.color, Math.max(1, item.quantity - 1))}
                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-semibold tabular-nums min-w-[1.5rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.color, item.quantity + 1)}
                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button
                      onClick={() => onRemoveItem(item.id, item.color)}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors duration-150 cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-sm font-bold text-foreground">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors. This closes out the colour-capture chain (Tasks 3–5): product card/detail modal → `Index.tsx` cart state → `Cart.tsx` display.

- [ ] **Step 4: Manual smoke check**

```bash
npm run dev
```

In the browser: sign in, open a product that has multiple colours (colour swatches visible), add it in one colour, then add the same product in a different colour. Confirm the cart drawer shows **two separate lines** with the correct colour label under each, and that the quantity +/- and remove (×) buttons on each line only affect that line's colour.

- [ ] **Step 5: Commit**

```bash
git add src/components/Cart.tsx
git commit -m "Show colour per cart line and key quantity/remove actions by colour"
```

---

### Task 6: Checkout Modal — Mandatory Shipping & Contact Form

**Files:**
- Modify: `src/components/CheckoutModal.tsx:1-13` (imports)
- Modify: `src/components/CheckoutModal.tsx:17-25` (`CartItem` interface)
- Modify: `src/components/CheckoutModal.tsx:45-78` (component state, `handleClose`)
- Modify: `src/components/CheckoutModal.tsx:113-147` (`handleSubmit`)
- Modify: `src/components/CheckoutModal.tsx:242-312` (Shipping Calculator section → Shipping & Contact section)
- Modify: `src/components/CheckoutModal.tsx:354-373` (submit button + footer hint)

**Interfaces:**
- Consumes: `ShippingInfo` shape from Task 2 (`shippingFullName`, `shippingAddress`, `shippingSuburb`, `shippingState`, `shippingEmail`, `shippingPhone`), `createOrder`'s existing return shape `{ success, orderId, order, error }`.
- Produces: `PlacedOrder` interface gains `orderId: string`, consumed by Task 7's `handleDone`.

- [ ] **Step 1: Add `color` to the local `CartItem` interface, add `useEffect` and `useAuth` imports, add the Select and AU-states imports**

Replace:

```ts
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Truck, CheckCircle2, Copy, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { AccountSelector } from "./AccountSelector";
import { supabase } from "@/integrations/supabase/client";

const NAKHRALI_PAYID = "77 440 681 399";

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
}
```

with:

```ts
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Truck, CheckCircle2, Copy, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
import { AccountSelector } from "./AccountSelector";
import { supabase } from "@/integrations/supabase/client";

const NAKHRALI_PAYID = "77 440 681 399";
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
  color: string;
}
```

- [ ] **Step 2: Add shipping/contact state, prefill on open, extend `handleClose`, extend `PlacedOrder`**

Replace:

```ts
export const CheckoutModal = ({ isOpen, onClose, cartItems, onSuccess }: CheckoutModalProps) => {
  // ── Step 1 form state ────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [selectedContext, setSelectedContext] = useState("individual");

  const [postcode, setPostcode] = useState("");
  const [shippingServices, setShippingServices] = useState<ShippingService[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingService | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  // ── Step 2 PayID state ───────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  const { createOrder, loading } = useOrders();
  const { toast } = useToast();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = selectedShipping?.price ?? 0;
  const total = subtotal + shippingCost;

  // ── Reset all state when dialog closes ───────────────────────────────────
  const handleClose = () => {
    setStep(1);
    setPlacedOrder(null);
    setNotes("");
    setSelectedContext("individual");
    setPostcode("");
    setShippingServices([]);
    setSelectedShipping(null);
    setShippingError("");
    onClose();
  };
```

with:

```ts
export const CheckoutModal = ({ isOpen, onClose, cartItems, onSuccess }: CheckoutModalProps) => {
  // ── Step 1 form state ────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [selectedContext, setSelectedContext] = useState("individual");

  const [postcode, setPostcode] = useState("");
  const [shippingServices, setShippingServices] = useState<ShippingService[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingService | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  // ── Shipping & contact form state ───────────────────────────────────────
  const [shippingFullName, setShippingFullName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingSuburb, setShippingSuburb] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingEmail, setShippingEmail] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");

  // ── Step 2 PayID state ───────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  const { createOrder, loading } = useOrders();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = selectedShipping?.price ?? 0;
  const total = subtotal + shippingCost;

  const shippingDetailsComplete = Boolean(
    shippingFullName.trim() &&
    shippingAddress.trim() &&
    shippingSuburb.trim() &&
    shippingState &&
    postcode.length === 4 &&
    shippingEmail.trim() &&
    shippingPhone.trim()
  );

  // ── Prefill name/email from profile when the modal opens ────────────────
  useEffect(() => {
    if (isOpen) {
      setShippingFullName((prev) => prev || profile?.full_name || "");
      setShippingEmail((prev) => prev || user?.email || "");
    }
  }, [isOpen, profile, user]);

  // ── Reset all state when dialog closes ───────────────────────────────────
  const handleClose = () => {
    setStep(1);
    setPlacedOrder(null);
    setNotes("");
    setSelectedContext("individual");
    setPostcode("");
    setShippingServices([]);
    setSelectedShipping(null);
    setShippingError("");
    setShippingFullName("");
    setShippingAddress("");
    setShippingSuburb("");
    setShippingState("");
    setShippingEmail("");
    setShippingPhone("");
    onClose();
  };
```

- [ ] **Step 3: Update `PlacedOrder` to carry `orderId`**

Replace:

```ts
interface PlacedOrder {
  orderNumber: string;
  total: number;
}
```

with:

```ts
interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  total: number;
}
```

- [ ] **Step 4: Validate shipping/contact details in `handleSubmit`, pass them to `createOrder`, and capture `orderId`**

Replace:

```ts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast({ title: "Empty Cart", description: "Add items before checkout", variant: "destructive" });
      return;
    }

    if (!selectedShipping) {
      toast({ title: "Shipping Required", description: "Please enter your postcode and select a shipping option before placing your order.", variant: "destructive" });
      return;
    }

    const accountId = selectedContext === "individual" ? undefined : selectedContext;
    const result = await createOrder(cartItems, notes, accountId, {
      shippingPostcode: postcode || undefined,
      shippingMethod: selectedShipping?.name,
      shippingCost: shippingCost,
    });

    if (!result.success || !result.order) {
      console.error("[Checkout] createOrder failed:", result.error);
      toast({
        title: "Order Failed",
        description: result.error || "An error occurred",
        variant: "destructive",
      });
      return;
    }

    // Order created — show PayID payment instructions
    setPlacedOrder({ orderNumber: result.order.order_number, total });
    onSuccess(); // clear cart
    setStep(2);
  };
```

with:

```ts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast({ title: "Empty Cart", description: "Add items before checkout", variant: "destructive" });
      return;
    }

    if (!shippingDetailsComplete) {
      toast({
        title: "Shipping Details Required",
        description: "Please fill in your full name, address, suburb, state, postcode, email, and phone.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedShipping) {
      toast({ title: "Shipping Required", description: "Please enter your postcode and select a shipping option before placing your order.", variant: "destructive" });
      return;
    }

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

    if (!result.success || !result.order || !result.orderId) {
      console.error("[Checkout] createOrder failed:", result.error);
      toast({
        title: "Order Failed",
        description: result.error || "An error occurred",
        variant: "destructive",
      });
      return;
    }

    // Order created — show PayID payment instructions
    setPlacedOrder({ orderId: result.orderId, orderNumber: result.order.order_number, total });
    onSuccess(); // clear cart
    setStep(2);
  };
```

- [ ] **Step 5: Replace the Shipping Calculator section with a full Shipping & Contact section**

Replace the entire block (heading through the postcode hint paragraph):

```tsx
              {/* Shipping Calculator */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Shipping
                </h3>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Delivery postcode (e.g. 2000)"
                      value={postcode}
                      onChange={(e) => {
                        setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4));
                        setShippingServices([]);
                        setSelectedShipping(null);
                        setShippingError("");
                      }}
                      maxLength={4}
                      pattern="\d{4}"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCalculateShipping}
                    disabled={shippingLoading || postcode.length !== 4}
                    className="shrink-0"
                  >
                    {shippingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate"}
                  </Button>
                </div>

                {shippingError && (
                  <p className="text-sm text-destructive">{shippingError}</p>
                )}

                {shippingServices.length > 0 && (
                  <div className="space-y-2">
                    {shippingServices.map((service) => (
                      <label
                        key={service.code}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedShipping?.code === service.code
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shipping"
                            checked={selectedShipping?.code === service.code}
                            onChange={() => setSelectedShipping(service)}
                            className="accent-primary"
                          />
                          <span className="text-sm font-medium">{service.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          ${service.price.toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {shippingServices.length === 0 && !shippingLoading && !shippingError && postcode.length < 4 && (
                  <p className="text-xs text-muted-foreground">
                    Enter your postcode to see AusPost delivery options from Melbourne.
                  </p>
                )}
              </div>
```

with:

```tsx
              {/* Shipping & Contact */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Shipping &amp; Contact
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="shippingFullName">Full Name</Label>
                    <Input
                      id="shippingFullName"
                      placeholder="Recipient's full name"
                      value={shippingFullName}
                      onChange={(e) => setShippingFullName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="shippingAddress">Street Address</Label>
                    <Input
                      id="shippingAddress"
                      placeholder="Unit/Street address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingSuburb">Suburb</Label>
                    <Input
                      id="shippingSuburb"
                      placeholder="Suburb"
                      value={shippingSuburb}
                      onChange={(e) => setShippingSuburb(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingState">State</Label>
                    <Select value={shippingState} onValueChange={setShippingState}>
                      <SelectTrigger id="shippingState">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingEmail">Email</Label>
                    <Input
                      id="shippingEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={shippingEmail}
                      onChange={(e) => setShippingEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingPhone">Phone</Label>
                    <Input
                      id="shippingPhone"
                      type="tel"
                      placeholder="04xx xxx xxx"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="postcode" className="sr-only">Postcode</Label>
                    <Input
                      id="postcode"
                      placeholder="Delivery postcode (e.g. 2000)"
                      value={postcode}
                      onChange={(e) => {
                        setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4));
                        setShippingServices([]);
                        setSelectedShipping(null);
                        setShippingError("");
                      }}
                      maxLength={4}
                      pattern="\d{4}"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCalculateShipping}
                    disabled={shippingLoading || postcode.length !== 4}
                    className="shrink-0"
                  >
                    {shippingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate"}
                  </Button>
                </div>

                {shippingError && (
                  <p className="text-sm text-destructive">{shippingError}</p>
                )}

                {shippingServices.length > 0 && (
                  <div className="space-y-2">
                    {shippingServices.map((service) => (
                      <label
                        key={service.code}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedShipping?.code === service.code
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shipping"
                            checked={selectedShipping?.code === service.code}
                            onChange={() => setSelectedShipping(service)}
                            className="accent-primary"
                          />
                          <span className="text-sm font-medium">{service.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          ${service.price.toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {shippingServices.length === 0 && !shippingLoading && !shippingError && postcode.length < 4 && (
                  <p className="text-xs text-muted-foreground">
                    Enter your postcode above to see AusPost delivery options from Melbourne.
                  </p>
                )}
              </div>
```

- [ ] **Step 6: Gate the submit button on `shippingDetailsComplete` too, and update the footer hint**

Replace:

```tsx
              <Button
                type="submit"
                disabled={loading || cartItems.length === 0 || !selectedShipping}
                className="flex-1 bg-gradient-primary hover:bg-gradient-warm"
                title={!selectedShipping ? "Calculate shipping first" : undefined}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Place Order
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2 border-t">
              {!selectedShipping
                ? "Enter your postcode above to calculate shipping before placing your order."
                : "Your order will be confirmed once payment is received."}
            </div>
```

with:

```tsx
              <Button
                type="submit"
                disabled={loading || cartItems.length === 0 || !selectedShipping || !shippingDetailsComplete}
                className="flex-1 bg-gradient-primary hover:bg-gradient-warm"
                title={
                  !shippingDetailsComplete
                    ? "Complete shipping & contact details first"
                    : !selectedShipping
                    ? "Calculate shipping first"
                    : undefined
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Place Order
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2 border-t">
              {!shippingDetailsComplete
                ? "Fill in your shipping & contact details above."
                : !selectedShipping
                ? "Enter your postcode above to calculate shipping before placing your order."
                : "Your order will be confirmed once payment is received."}
            </div>
```

- [ ] **Step 7: Verify the build**

```bash
npm run build
```

Expected: fails — `Index.tsx` still passes `cartItems` (its own `CartItem` type, now with `color`) into `<CheckoutModal cartItems={cartItems} .../>`; this should actually already satisfy the updated local `CartItem` type in `CheckoutModal.tsx` since both now require `color: string`. If the build fails here, check that Task 4's `Index.tsx` `CartItem.color` field was added correctly — it's a prerequisite for this task's props to type-check.

- [ ] **Step 8: Manual smoke check**

```bash
npm run dev
```

Sign in, add an item to cart, open checkout. Confirm: name/email are pre-filled from your profile; leaving address/suburb/state/phone blank and clicking "Place Order" shows the "Shipping Details Required" toast and does not create an order; filling in all fields plus calculating shipping enables "Place Order" and successfully creates the order (Step 2 PayID screen appears).

- [ ] **Step 9: Commit**

```bash
git add src/components/CheckoutModal.tsx
git commit -m "Add mandatory shipping & contact form to checkout"
```

---

### Task 7: Checkout Modal — Mark Order Paid on Payment Confirmation

**Files:**
- Modify: `src/components/CheckoutModal.tsx:149-167` (`handleDone`)

**Interfaces:**
- Consumes: `placedOrder.orderId` from Task 6, `shippingFullName`/`shippingEmail` state from Task 6.
- Produces: nothing further downstream — this is the last write in the checkout flow. `orders.payment_status` becomes `'paid'` in the DB, consumed by Task 8 (admin display) and Task 9 (admin email).

- [ ] **Step 1: Update `handleDone` to mark the order paid before notifying admin**

Replace:

```ts
  const handleDone = async () => {
    if (placedOrder) {
      // Notify admin that customer has claimed payment
      supabase.functions.invoke("notify-admin-order", {
        body: {
          orderNumber: placedOrder.orderNumber,
          customerName: null,
          customerEmail: null,
          total: placedOrder.total,
          items: [],
          shippingMethod: null,
          paymentClaimed: true,
        },
      }).then(({ error: fnErr }) => {
        if (fnErr) console.error("payment-claimed notification failed:", fnErr);
      }).catch((e) => console.error("payment-claimed notification error:", e));
    }
    handleClose();
  };
```

with:

```ts
  const handleDone = async () => {
    if (placedOrder) {
      const { error: paymentUpdateError } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", placedOrder.orderId);

      if (paymentUpdateError) {
        console.error("Failed to mark order paid:", paymentUpdateError);
      }

      // Notify admin that customer has claimed payment
      supabase.functions.invoke("notify-admin-order", {
        body: {
          orderNumber: placedOrder.orderNumber,
          customerName: shippingFullName || null,
          customerEmail: shippingEmail || null,
          total: placedOrder.total,
          items: [],
          shippingMethod: null,
          paymentClaimed: true,
        },
      }).then(({ error: fnErr }) => {
        if (fnErr) console.error("payment-claimed notification failed:", fnErr);
      }).catch((e) => console.error("payment-claimed notification error:", e));
    }
    handleClose();
  };
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Manual smoke check (requires Task 1's migration already applied)**

```bash
npm run dev
```

Place a test order through to the PayID screen, click "Done — I've made the transfer". In the Supabase dashboard's Table Editor (or SQL editor: `select payment_status from orders where order_number = '<the order number>';`), confirm `payment_status` is now `'paid'`.

- [ ] **Step 4: Commit**

```bash
git add src/components/CheckoutModal.tsx
git commit -m "Mark order paid when customer confirms PayID transfer"
```

---

### Task 8: Admin Order Management — Payment Badge, Shipping Details, Item Colour

**Files:**
- Modify: `src/components/admin/OrderManagement.tsx:30-51` (`OrderItem`/`Order` interfaces)
- Modify: `src/components/admin/OrderManagement.tsx:120-126` (`openOrder` — `order_items` select)
- Modify: `src/components/admin/OrderManagement.tsx:180-201` (add `getPaymentBadge`)
- Modify: `src/components/admin/OrderManagement.tsx:264-397` (orders table + detail dialog)

**Interfaces:**
- Consumes: `orders.payment_status`, `orders.shipping_full_name`, `shipping_address`, `shipping_suburb`, `shipping_state`, `shipping_postcode`, `shipping_email`, `shipping_phone` (Task 1/2), `order_items.color` (Task 1/2).
- Produces: nothing further downstream — this is the admin-facing leaf.

- [ ] **Step 1: Extend the `OrderItem` and `Order` interfaces**

Replace:

```ts
interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: { name: string; sku: string | null; unit: string } | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  notes: string | null;
  customer_id: string | null;
  account_id: string | null;
  shipping_method: string | null;
  shipping_cost: number | null;
  profiles?: { full_name: string; email: string } | null;
  accounts?: { name: string } | null;
}
```

with:

```ts
interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  color: string | null;
  product: { name: string; sku: string | null; unit: string } | null;
}

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

- [ ] **Step 2: Fetch `color` alongside each order item**

Replace:

```ts
    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, unit_price, total_price, product:products(name, sku, unit)")
      .eq("order_id", order.id);
```

with:

```ts
    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, unit_price, total_price, color, product:products(name, sku, unit)")
      .eq("order_id", order.id);
```

- [ ] **Step 3: Add a `getPaymentBadge` helper next to `getStatusBadge`**

Directly after the closing brace of `getStatusBadge` (the function that ends with `return ( <Badge ...>{status...}</Badge> ); };`), add:

```ts
  const getPaymentBadge = (paymentStatus: string) => {
    const colors: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      unpaid: "bg-orange-100 text-orange-800",
      pending_payment: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };
    const label = paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1).replace("_", " ");

    return (
      <Badge variant="secondary" className={colors[paymentStatus] || "bg-gray-100 text-gray-800"}>
        {label}
      </Badge>
    );
  };
```

- [ ] **Step 4: Add a "Payment" column to the orders table**

Replace:

```tsx
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
```

with:

```tsx
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
```

and replace:

```tsx
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), "MMM dd, yyyy")}
                  </TableCell>
```

with:

```tsx
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{getPaymentBadge(order.payment_status)}</TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), "MMM dd, yyyy")}
                  </TableCell>
```

- [ ] **Step 5: Add a "Shipping To" block to the detail dialog**

Replace:

```tsx
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Customer</label>
                                  <p className="text-sm text-muted-foreground">{getCustomerName(selectedOrder)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Total</label>
                                  <p className="text-sm text-muted-foreground">${selectedOrder.total_amount.toFixed(2)}</p>
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

                              {/* Order items */}
```

with:

```tsx
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Customer</label>
                                  <p className="text-sm text-muted-foreground">{getCustomerName(selectedOrder)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Total</label>
                                  <p className="text-sm text-muted-foreground">${selectedOrder.total_amount.toFixed(2)}</p>
                                </div>
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

                              {(selectedOrder.shipping_full_name || selectedOrder.shipping_address) && (
                                <div className="rounded-lg border p-3 bg-muted/30">
                                  <label className="text-sm font-medium">Shipping To</label>
                                  <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                    {selectedOrder.shipping_full_name && <p>{selectedOrder.shipping_full_name}</p>}
                                    {selectedOrder.shipping_address && (
                                      <p>
                                        {selectedOrder.shipping_address}
                                        {selectedOrder.shipping_suburb && `, ${selectedOrder.shipping_suburb}`}
                                        {selectedOrder.shipping_state && ` ${selectedOrder.shipping_state}`}
                                        {selectedOrder.shipping_postcode && ` ${selectedOrder.shipping_postcode}`}
                                      </p>
                                    )}
                                    {selectedOrder.shipping_email && <p>Email: {selectedOrder.shipping_email}</p>}
                                    {selectedOrder.shipping_phone && <p>Phone: {selectedOrder.shipping_phone}</p>}
                                  </div>
                                </div>
                              )}

                              {/* Order items */}
```

- [ ] **Step 6: Show each item's colour in the items table**

Replace:

```tsx
                                        <TableCell>
                                            <p className="font-medium text-sm">{item.product?.name ?? "—"}</p>
                                            {item.product?.sku && <p className="text-xs text-muted-foreground">{item.product.sku}</p>}
                                          </TableCell>
```

with:

```tsx
                                        <TableCell>
                                            <p className="font-medium text-sm">{item.product?.name ?? "—"}</p>
                                            {item.product?.sku && <p className="text-xs text-muted-foreground">{item.product.sku}</p>}
                                            {item.color && item.color !== "default" && (
                                              <p className="text-xs text-muted-foreground">Colour: {item.color}</p>
                                            )}
                                          </TableCell>
```

- [ ] **Step 7: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 8: Manual smoke check (requires Task 1's migration already applied, and at least one order placed via Tasks 6/7)**

```bash
npm run dev
```

Sign in as an admin, go to `/admin` → Orders tab. Confirm the new "Payment" column shows a badge for every order (e.g. "Unpaid" for older orders, "Paid" for the one placed in Task 7's smoke check). Open that order's detail view and confirm the "Shipping To" block shows the full address/email/phone, and each item shows its colour (when not `"default"`).

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/OrderManagement.tsx
git commit -m "Show payment status, shipping details, and item colour in admin Orders tab"
```

---

### Task 9: Admin Notification Email — Render Shipping Details and Item Colour

**Files:**
- Modify: `supabase/functions/notify-admin-order/index.ts:12` (payload destructuring)
- Modify: `supabase/functions/notify-admin-order/index.ts:17-43` (payment-claimed email)
- Modify: `supabase/functions/notify-admin-order/index.ts:45-53` (items HTML)
- Modify: `supabase/functions/notify-admin-order/index.ts:86-90` (new-order email meta block)

**Interfaces:**
- Consumes: the enriched `notify-admin-order` payload from Task 2 (new order) and Task 7 (payment claimed) — `shippingAddress`, `shippingSuburb`, `shippingState`, `shippingPostcode`, `shippingPhone`, per-item `color`.
- Produces: nothing further downstream — this is the final leaf in the chain.

- [ ] **Step 1: Destructure the new payload fields**

Replace:

```ts
    const { orderNumber, customerName, customerEmail, total, items, shippingMethod, paymentClaimed } = await req.json();
```

with:

```ts
    const {
      orderNumber, customerName, customerEmail, total, items, shippingMethod, paymentClaimed,
      shippingAddress, shippingSuburb, shippingState, shippingPostcode, shippingPhone,
    } = await req.json();
```

- [ ] **Step 2: Show colour per line item and shipping/contact details in the payment-claimed email**

Replace:

```ts
    // Payment-claimed notification — short email, different subject
    if (paymentClaimed) {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SENDGRID_API_KEY}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
          from: { email: "noreply@nakhrali.com.au", name: "Nakhrali" },
          subject: `Payment claimed for order ${orderNumber} — check your bank`,
          content: [{
            type: "text/html",
            value: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:40px auto;background:#fff;border-radius:4px;padding:32px;border:1px solid #e8e0d0;">
                <h2 style="font-size:16px;color:#1a1510;margin:0 0 16px;">💸 PayID payment claimed</h2>
                <p style="font-size:14px;color:#5c5040;margin:0 0 8px;">The customer says they have transferred payment for:</p>
                <p style="font-size:20px;font-weight:700;color:#8b6914;margin:0 0 8px;">Order ${orderNumber}</p>
                <p style="font-size:18px;color:#1a1510;margin:0 0 24px;"><strong>$${Number(total).toFixed(2)} AUD</strong></p>
                <p style="font-size:13px;color:#9c8a6a;">Please check your bank account (PayID ABN 77 440 681 399) and confirm receipt, then approve the order in the dashboard.</p>
                <a href="https://nakhrali.com.au/admin" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c9a84c;color:#fff;text-decoration:none;border-radius:2px;font-size:12px;letter-spacing:0.1em;">Go to Admin Dashboard</a>
              </div>`,
          }],
        }),
      });
      if (!res.ok) throw new Error(`SendGrid error ${res.status}: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

with:

```ts
    // Payment-claimed notification — short email, different subject
    if (paymentClaimed) {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SENDGRID_API_KEY}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
          from: { email: "noreply@nakhrali.com.au", name: "Nakhrali" },
          subject: `Payment claimed for order ${orderNumber} — check your bank`,
          content: [{
            type: "text/html",
            value: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:40px auto;background:#fff;border-radius:4px;padding:32px;border:1px solid #e8e0d0;">
                <h2 style="font-size:16px;color:#1a1510;margin:0 0 16px;">💸 PayID payment claimed</h2>
                <p style="font-size:14px;color:#5c5040;margin:0 0 8px;">The customer says they have transferred payment for:</p>
                <p style="font-size:20px;font-weight:700;color:#8b6914;margin:0 0 8px;">Order ${orderNumber}</p>
                <p style="font-size:18px;color:#1a1510;margin:0 0 8px;"><strong>$${Number(total).toFixed(2)} AUD</strong></p>
                ${customerName || customerEmail ? `<p style="font-size:13px;color:#5c5040;margin:0 0 24px;">Contact: ${customerName || "—"} · ${customerEmail || "—"}</p>` : ""}
                <p style="font-size:13px;color:#9c8a6a;">Order status has been marked <strong>Paid</strong>. Please check your bank account (PayID ABN 77 440 681 399) to confirm receipt, then approve the order in the dashboard.</p>
                <a href="https://nakhrali.com.au/admin" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c9a84c;color:#fff;text-decoration:none;border-radius:2px;font-size:12px;letter-spacing:0.1em;">Go to Admin Dashboard</a>
              </div>`,
          }],
        }),
      });
      if (!res.ok) throw new Error(`SendGrid error ${res.status}: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

- [ ] **Step 3: Show colour next to each item name in the new-order email**

Replace:

```ts
    const itemsHtml = Array.isArray(items)
      ? items.map((i: { name: string; quantity: number; price: number }) =>
          `<tr>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;">${i.name}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;text-align:center;">${i.quantity}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;text-align:right;">$${(i.price * i.quantity).toFixed(2)}</td>
          </tr>`
        ).join("")
      : "<tr><td colspan='3' style='font-size:13px;color:#9c8a6a;padding:6px 0;'>No item details available</td></tr>";
```

with:

```ts
    const itemsHtml = Array.isArray(items)
      ? items.map((i: { name: string; quantity: number; price: number; color?: string }) =>
          `<tr>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;">${i.name}${i.color && i.color !== "default" ? ` <span style="color:#9c8a6a;">(${i.color})</span>` : ""}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;text-align:center;">${i.quantity}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;text-align:right;">$${(i.price * i.quantity).toFixed(2)}</td>
          </tr>`
        ).join("")
      : "<tr><td colspan='3' style='font-size:13px;color:#9c8a6a;padding:6px 0;'>No item details available</td></tr>";
```

- [ ] **Step 4: Show shipping address and phone in the new-order email meta block**

Replace:

```html
      <div class="meta">
        <p><strong>Customer:</strong> ${customerName || "—"}</p>
        <p><strong>Email:</strong> ${customerEmail || "—"}</p>
        ${shippingMethod ? `<p><strong>Shipping:</strong> ${shippingMethod}</p>` : ""}
      </div>
```

with:

```html
      <div class="meta">
        <p><strong>Customer:</strong> ${customerName || "—"}</p>
        <p><strong>Email:</strong> ${customerEmail || "—"}</p>
        ${shippingPhone ? `<p><strong>Phone:</strong> ${shippingPhone}</p>` : ""}
        ${shippingAddress ? `<p><strong>Ship to:</strong> ${shippingAddress}${shippingSuburb ? `, ${shippingSuburb}` : ""}${shippingState ? ` ${shippingState}` : ""}${shippingPostcode ? ` ${shippingPostcode}` : ""}</p>` : ""}
        ${shippingMethod ? `<p><strong>Shipping:</strong> ${shippingMethod}</p>` : ""}
      </div>
```

- [ ] **Step 5: Deploy the edge function — requires explicit user confirmation first**

This modifies a live Supabase Edge Function. Tell the user the exact command (`npx supabase functions deploy notify-admin-order`) and wait for their go-ahead before running it.

- [ ] **Step 6: Manual smoke check**

Place a test order (Task 6/7's flow) and confirm the admin inbox (`ADMIN_NOTIFICATION_EMAIL`, defaulting to `admin@nakhrali.com.au`) receives: (a) the new-order email with shipping address/phone and item colour, and (b) the payment-claimed email after clicking "Done", both rendering without broken HTML.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/notify-admin-order/index.ts
git commit -m "Show shipping details and item colour in admin notification emails"
```

---

### Task 10: Final Full Build + End-to-End Verification

**Files:** none (verification-only task).

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits 0, no errors, matching the baseline confirmed before this plan started.

- [ ] **Step 2: Full end-to-end walkthrough**

```bash
npm run dev
```

1. Sign in as a customer. Add the same multi-colour product in two different colours to the bag — confirm two separate cart lines.
2. Open checkout. Confirm name/email are pre-filled. Try to submit with address/suburb/state/phone blank — confirm it's blocked with a toast.
3. Fill in all shipping/contact fields, calculate shipping, place the order — confirm the PayID screen appears.
4. Click "Done — I've made the transfer".
5. Sign in as admin, open `/admin` → Orders tab. Confirm: the new order's row shows a "Paid" payment badge; opening it shows the "Shipping To" block with the address/email/phone entered in step 3, and each item shows the colour chosen in step 1.
6. Confirm the admin inbox received both the new-order email (with address/phone/colour) and the payment-claimed email.

- [ ] **Step 3: Report back to the user**

Summarize what was verified end-to-end and flag anything that could not be tested (e.g. if SendGrid isn't configured in this environment, note that email delivery itself wasn't observed even though the payload/template changes were reviewed).
