# Order Colour, Shipping Details & Payment Status — Design

## Context

Three related gaps in the order flow, all centered on what the admin sees on the Orders tab:

1. Customers pick a product colour on the product page/card (image swatch), but the choice is purely cosmetic — it's never sent with the order, so admin can't tell which colour was ordered.
2. Checkout only collects a postcode (for AusPost rate lookup). There is no full shipping address, no per-order contact email, and no phone number — admin has no way to know where/how to ship or contact the customer.
3. `orders.payment_status` already exists in the DB (`unpaid` / `pending_payment` / `paid` / `failed` / `refunded`) but nothing in the app ever sets it to `paid` or displays it — admin has no visibility into payment state.

## Goals

- Colour chosen per cart line survives into the order and is visible to admin per line item.
- Checkout requires full shipping address, email, and phone before an order can be placed; these are stored on the order and shown to admin.
- When a customer confirms they've paid (clicks "Done — I've made the transfer"), the order is marked `paid` and this is visible in the admin dashboard and the admin notification email.

## Non-goals

- No real payment gateway / webhook integration — payment confirmation remains customer self-reported, same trust model as today (admin still reconciles against bank statement independently).
- No change to the B2B `accounts.shipping_address` (company-level address) — this is a separate, existing field for account-level defaults and is untouched.
- No change to sign-up form fields (`phone`/`address` on `profiles` remain unused/optional).

## Data Model Changes

New migration `supabase/migrations/<timestamp>_add_color_and_shipping_contact.sql`:

```sql
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

- All new columns are nullable at the DB level (existing rows have none of this data). Enforcement of "mandatory" happens in the checkout form, not a DB constraint.
- `orders.shipping_postcode` already exists and is reused as the address postcode — no new postcode column.
- `order_items.color` is nullable; `null`/`"default"` represents a product with no colour variants.

## Cart & Colour Capture

- `ProductCardDB.tsx` and `ProductDetailModal.tsx`: `handleAddToCart` / `onAddToCart` calls pass the active colour label — `colorImages[activeColor]?.color ?? "default"` — as a third argument.
- `onAddToCart` signature changes from `(product, quantity) => void` to `(product, quantity, color) => void` in both components and in `Index.tsx`.
- `Index.tsx` `CartItem` interface gains `color: string`.
- Cart merge logic in `handleAddToCart` (Index.tsx) changes from matching `item.id === product.id` to `item.id === product.id && item.color === color`, so the same product in two colours becomes two separate cart lines, each with its own quantity.
- `Cart.tsx` displays the colour under/next to the product name on each line (small text, consistent with existing brand/SKU treatment).

## Checkout Form (`CheckoutModal.tsx`)

- New "Shipping & Contact" section in Step 1, above or alongside the existing shipping calculator:
  - Full name (prefilled from `profile.full_name` if present)
  - Street address
  - Suburb
  - State (select: NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
  - Postcode (replaces today's standalone postcode-only input; still drives the AusPost `calculate-shipping` call exactly as today)
  - Email (prefilled from `user.email`)
  - Phone
- All fields required — "Place Order" stays disabled (or submit is blocked with a toast) until all are filled, same pattern as the existing `!selectedShipping` guard.
- `useOrders.createOrder`'s `ShippingInfo` type gains `shippingFullName`, `shippingAddress`, `shippingSuburb`, `shippingState`, `shippingEmail`, `shippingPhone`; these map onto the new `orders` columns in the insert payload.

## Payment Status

- `CheckoutModal.handleDone` (fires when the customer clicks "Done — I've made the transfer"):
  - Adds a Supabase update: `orders.update({ payment_status: 'paid' }).eq('id', placedOrder.orderId)` (requires `placedOrder` to carry `orderId`, not just `orderNumber`/`total` — extend `PlacedOrder` interface accordingly).
  - This runs alongside (not instead of) the existing `notify-admin-order` invoke.
- No other payment_status transitions are introduced (`pending_payment`/`failed`/`refunded` remain unused for now, same as today).

## Admin Dashboard (`OrderManagement.tsx`)

- `Order` interface gains: `payment_status`, `shipping_full_name`, `shipping_address`, `shipping_suburb`, `shipping_state`, `shipping_email`, `shipping_phone`.
- `OrderItem` interface gains `color`.
- Orders table: new "Payment" column next to "Status", rendered as a colour-coded badge (reuse `getStatusBadge`-style mapping: e.g. `paid` → green, `unpaid` → grey/orange).
- Order detail dialog:
  - New "Shipping To" block: full name, address/suburb/state/postcode, email, phone — placed near the existing "Shipping" (method/cost) block.
  - Items table: colour shown as a small line under the product name/SKU (only when not `"default"`).

## Admin Email (`notify-admin-order`)

- Payload sent from both `useOrders.createOrder` (new order) and `CheckoutModal.handleDone` (payment claimed) is extended with: `shippingFullName`, `shippingAddress`, `shippingSuburb`, `shippingState`, `shippingEmail`, `shippingPhone`, and per-item `color`.
- Edge function template updated to render these fields in the email body.
- When invoked from `handleDone`, the payload's existing `paymentClaimed: true` flag continues to signal "paid" in the email copy (e.g. "Payment claimed — mark verified once confirmed" already implied by that flag; template just also now shows the full shipping/colour context that was previously missing).

## Testing

- Manual verification (per project convention — no automated test suite exists for this flow):
  - Add same product in two colours to cart → confirm two separate lines, independent quantities.
  - Attempt checkout with shipping fields incomplete → confirm blocked.
  - Complete checkout → confirm `orders` row has all shipping/contact columns populated and `order_items` rows have `color` set.
  - Click "Done — I've made the transfer" → confirm `orders.payment_status` becomes `'paid'` in the DB.
  - Open the order in Admin → Orders tab → confirm Payment badge, Shipping To block, and per-item colour all render correctly.
  - Confirm the admin notification email (new order, and payment-claimed) includes the new fields.
