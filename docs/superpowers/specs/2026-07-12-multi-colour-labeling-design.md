# Multi Colour Labeling Fix — Design

## Context

Products can offer a colour option ("Multi") whose entry in `color_images` carries several photos (`image_urls`, authored via `ProductManagement.tsx`'s multi-photo upload UI). Both `ProductCardDB.tsx` and `ProductDetailModal.tsx` independently expand that one colour entry into one swatch/thumbnail per photo — but every expanded swatch is labeled with the same bare colour name (`"Multi"`). This means:

- Customers see multiple identical-looking swatch tooltips/captions and can't tell them apart.
- The label is also what gets passed to `onAddToCart` and stored as the cart line's / order item's `color` — so admin sees `"Multi"` on every line regardless of which photo/variant was actually ordered.
- React renders these duplicate entries with `key={ci.color}` (both components), which collide for duplicate colour names — a latent key-collision bug independent of the display issue.

## Goal

When a colour has more than one photo, disambiguate each expanded entry as `"<colour> 1"`, `"<colour> 2"`, etc. (1-based, in upload order). That disambiguated label is what's displayed and what flows into the cart/order/admin pipeline. Colours with only one photo keep their plain name unchanged (no behavior change for the overwhelming majority of products).

## Non-goals

- No change to `ProductPage.tsx` — it doesn't expand multi-photo colours today (only shows one image per canonical colour name) and has no "Add to Cart", so this bug doesn't manifest there.
- No change to `COLOR_SWATCHES` — swatch colour styling continues to key off the canonical colour name, not the disambiguated label.
- No change to `Cart.tsx`, `CheckoutModal.tsx`, `useOrders.ts`, `OrderManagement.tsx`, or `notify-admin-order` — all of these already treat `color` as an opaque string with only a `"default"` sentinel guard, so a more specific label flows through unchanged.
- No change to `ProductManagement.tsx`'s authoring UI (admin still uploads photos under one "Multi" checkbox) — only the storefront's *display/labeling* of the resulting photos changes.

## Design

### New shared helper: `src/lib/productColors.ts`

```ts
export interface ExpandedColorImage {
  color: string;   // canonical colour name, e.g. "Multi" — use for COLOR_SWATCHES lookup
  image_url: string;
  label: string;   // display/storage value: color, or "color N" if color has >1 photo
}

interface RawColorImage {
  color: string;
  image_url: string;
  image_urls?: string[];
}

export function expandColorImages(
  colorImages: RawColorImage[] | null | undefined
): ExpandedColorImage[] {
  const raw = Array.isArray(colorImages) ? colorImages.filter((ci) => ci.image_url) : [];

  const expanded = raw.flatMap((ci) => {
    const urls = ci.image_urls && ci.image_urls.length > 1 ? ci.image_urls : [ci.image_url];
    return urls.filter(Boolean).map((url) => ({ color: ci.color, image_url: url }));
  });

  const countByColor = expanded.reduce<Record<string, number>>((acc, ci) => {
    acc[ci.color] = (acc[ci.color] ?? 0) + 1;
    return acc;
  }, {});

  const seenByColor: Record<string, number> = {};
  return expanded.map((ci) => {
    seenByColor[ci.color] = (seenByColor[ci.color] ?? 0) + 1;
    const label = countByColor[ci.color] > 1 ? `${ci.color} ${seenByColor[ci.color]}` : ci.color;
    return { ...ci, label };
  });
}
```

### `ProductCardDB.tsx`

Replace the inline `rawColorImages`/`expandedColorImages` block with `const expandedColorImages = expandColorImages(product.color_images);`. Downstream:
- `productImages` construction keeps using `.color` for the `id`/`color` fields it builds (image display doesn't care about the label).
- `cssSwatches` keeps using `.color` for `COLOR_SWATCHES` lookup.
- `colorLabels` becomes `expandedColorImages.map((ci) => ci.label)` — this is what's passed to `ProductColorsThumbs` (tooltips) and what `handleAddToCart` reads: `colorLabels[activeColor] ?? "default"`.

### `ProductDetailModal.tsx`

Replace the inline `colorImages` flatMap with `const colorImages = expandColorImages(product?.color_images);`. Downstream:
- Thumbnail strip caption (`colorImages[activeColor]?.color`) and colour dot selector caption change to `.label`.
- `key={ci.color}` in both the thumbnail-strip `.map` and the colour-dot-selector `.map` changes to `key={ci.label}` (guaranteed unique per the helper's own invariant).
- `handleAdd` changes `onAddToCart(product, quantity, colorImages[activeColor]?.color ?? "default")` to use `.label` instead of `.color`.
- Swatch dot background (`COLOR_SWATCHES[ci.color]`) keeps using `.color`.

## Testing

No automated test suite exists in this repo (established in the prior order-flow feature). Verification is `npm run build` plus manual checks:
- A product with a single-photo "Multi" colour (or any colour with exactly one photo) — swatch/label unchanged.
- A product with a multi-photo "Multi" colour — swatches labeled "Multi 1", "Multi 2", ... in upload order; adding each to cart produces a distinct cart line with the correct disambiguated label; admin Orders tab shows the disambiguated label per item.
