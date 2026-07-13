# Per-Colour Stock — Design

## Context

`products.stock_quantity` is a single number for the whole product. The stock-reduction-on-approval trigger (built earlier) decrements it by the total ordered quantity regardless of which colour was ordered, and the storefront's "Sold Out" state (`isInStock = stock_quantity > 0`) hides the entire product's Add to Cart, even if only one colour is actually out. Admin wants stock tracked per colour: when a specific colour sells out, only that swatch becomes unselectable — other colours of the same product stay purchasable.

## Goals

- Admin sets a stock number per sellable colour variant (not per canonical colour name — see below).
- Approving an order decrements the specific colour's stock, atomically and race-safe, same guarantees as the existing product-level trigger.
- On the storefront, a sold-out colour's swatch/thumbnail is visibly disabled and cannot be selected; other colours remain selectable. The product-level "Sold Out" overlay only applies when every colour (or the single stock count, for colourless products) is exhausted.

## Non-goals

- No change for colourless products (no `color_images`) — they keep using `products.stock_quantity` exactly as today.
- No change to `ProductPage.tsx` — consistent with the earlier Multi-colour-labeling feature, it doesn't do add-to-cart and doesn't expand multi-photo colours, so per-colour stock doesn't apply there.
- No automatic backfill of initial per-colour numbers from the existing `products.stock_quantity` — admin fills these in manually per the earlier decision. Until a colour has an explicit row, it's treated as in-stock (not sold out) so shipping this doesn't instantly hide every existing colour.
- No auto-selecting the first in-stock colour if the default (first) swatch happens to be sold out — the swatch just shows disabled; the customer picks another.

## Key design point: stock is tracked per *sellable variant*, not per canonical colour name

A colour like "Multi" can have several photos, and the Multi-colour-labeling feature already disambiguates them into separate purchasable entries — "Multi 1", "Multi 2" — each becoming its own cart line and its own `order_items.color` value (via the existing `expandColorImages` helper's `label` field). Per-colour stock must track at this same granularity: `product_color_stock.color` stores the exact disambiguated label (`"Pink"`, `"Multi 1"`, `"Multi 2"`, ...), matching what's already stored in `order_items.color`. This is consistent with how that column is already used — no new naming convention introduced.

## Data Model

New table:

```sql
CREATE TABLE public.product_color_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, color)
);
```

RLS: public `SELECT` (the storefront needs to read stock levels to render Sold Out states — same "viewable by everyone" posture as `products` itself), admin-only `INSERT`/`UPDATE`/`DELETE` via `get_my_role()`, matching the existing admin-table pattern.

## Approval Trigger

`decrement_stock_on_order_approval()` is rewritten: for each ordered item, look up a `product_color_stock` row for `(product_id, order_items.color)`. If one exists, lock and decrement it (same FOR UPDATE + insufficient-stock exception as today, just scoped to that row). If none exists (colourless product, or a colour with no stock row set up yet), fall back to the current behavior — decrement `products.stock_quantity`. Same all-or-nothing transaction semantics: any insufficient-stock exception aborts the whole approval.

## Admin UI (`ProductManagement.tsx`)

The existing "Colours & Photos" section already lets admin pick canonical colours and upload one or more photos per colour. This adds a stock number field next to each *actual sellable variant* — computed via the same `expandColorImages` helper the storefront uses, so a colour with 2 photos gets 2 separate stock inputs (labeled "Multi 1", "Multi 2"), not one combined field. New form state holds `{ [label]: string }` stock values, populated from existing `product_color_stock` rows when editing, and on save, the product's `product_color_stock` rows are fully replaced (delete-then-insert scoped to that product) to match whatever labels currently exist after any photo add/remove.

## Storefront (`ProductCardDB.tsx`, `ProductDetailModal.tsx`)

Both already compute `expandColorImages(product.color_images)`. Each swatch/thumbnail's stock is looked up from `product.product_color_stock` (a new field the product fetch — `useProducts.ts` — joins in) by matching `label`; a row with `stock_quantity <= 0` disables that swatch (greyed out, unclickable, not just visually different — its `onClick`/`handleColorChange` is a no-op, so it can never become the `activeColor`, matching the "not letting it remain selectable" requirement literally) and shows a "Sold Out" indicator on it.

The product-level "Sold Out" overlay and Add-to-Cart disabling (`isInStock`) changes: for a colourless product, unchanged (`stock_quantity > 0`). For a product with colour variants, `isInStock` becomes true if *any* expanded colour is not sold out (has no row, or has `stock_quantity > 0`) — only fully hides purchase when every colour is exhausted.

## Testing

No automated test suite exists in this repo. Verification is `npm run build` plus manual checks:
- Set one colour's stock to 0 for a multi-colour product — its swatch shows disabled/Sold Out on both the product card and the detail modal; other colours remain selectable and orderable; the product-level Sold Out overlay does NOT appear (since other colours still have stock).
- Set every colour's stock to 0 — the product-level Sold Out overlay now appears, matching today's whole-product behavior.
- Approve an order for a colour with sufficient per-colour stock — that colour's `product_color_stock` row decrements by the ordered quantity; approving with insufficient stock blocks with a specific error, same as the existing product-level behavior.
- A colour with no `product_color_stock` row yet still behaves as in-stock/selectable.
- A colourless product's behavior is completely unchanged (still uses `products.stock_quantity`).
