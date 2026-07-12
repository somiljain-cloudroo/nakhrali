# Multi Colour Labeling Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a product colour has more than one photo, label each expanded swatch "Multi 1", "Multi 2", etc. instead of repeating the bare colour name — and fix the resulting React key collision — via one shared helper used by both the product card and the detail modal.

**Architecture:** A new pure function `expandColorImages` in `src/lib/productColors.ts` replaces the near-identical inline expansion logic in `ProductCardDB.tsx` and `ProductDetailModal.tsx`. It returns each entry's canonical `color` (for swatch-colour lookups) alongside a disambiguated `label` (for display, React keys, and everything downstream that currently treats `color` as the value to show/store).

**Tech Stack:** Vite + React + TypeScript. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-multi-colour-labeling-design.md`
- No DB/schema change. No change to `Cart.tsx`, `CheckoutModal.tsx`, `useOrders.ts`, `OrderManagement.tsx`, or `notify-admin-order` — they already treat the colour value as an opaque string.
- No change to `ProductPage.tsx` or `COLOR_SWATCHES` (either file's copy) — out of scope per the spec.
- Colours with exactly one photo must keep their plain name unchanged (`"Pink"`, not `"Pink 1"`) — this is the majority case and must not regress.
- This repo has no automated test suite (no vitest/jest, no `tests/` dir, no test script in `package.json`). `npm run build` (`vite build`) is confirmed clean at baseline and is the standard verification gate. For this plan's one pure, DOM-free function (`expandColorImages`), Task 1 additionally uses a disposable `npx tsx` script with real assertions — write it, run it, then delete it; never commit it.

---

### Task 1: Shared Helper — `expandColorImages`

**Files:**
- Create: `src/lib/productColors.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `expandColorImages(colorImages: RawColorImage[] | null | undefined): ExpandedColorImage[]`, where `ExpandedColorImage = { color: string; image_url: string; label: string }`. Tasks 2 and 3 import this function and the `ExpandedColorImage` type is implicit in its return value (no need to import the type itself unless a task wants to annotate a variable).

- [ ] **Step 1: Write the helper**

```ts
export interface ExpandedColorImage {
  color: string;   // canonical colour name, e.g. "Multi" — use for COLOR_SWATCHES lookups
  image_url: string;
  label: string;    // display/storage value: color, or "color N" if this colour has >1 photo
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

- [ ] **Step 2: Write a disposable verification script and run it**

Create `verify-color-labels.ts` at the repo root (this file is temporary — do not commit it, delete it in Step 4 below):

```ts
import { expandColorImages } from "./src/lib/productColors";

let failed = false;
const assertEqual = (actual: unknown, expected: unknown, msg: string) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${msg}\n  actual:   ${a}\n  expected: ${e}`);
    failed = true;
  } else {
    console.log(`OK: ${msg}`);
  }
};

assertEqual(
  expandColorImages([
    { color: "Pink", image_url: "pink.jpg" },
    { color: "Blue", image_url: "blue.jpg" },
  ]).map((c) => c.label),
  ["Pink", "Blue"],
  "single-photo colours keep their plain name"
);

assertEqual(
  expandColorImages([
    { color: "Pink", image_url: "pink.jpg" },
    { color: "Multi", image_url: "multi1.jpg", image_urls: ["multi1.jpg", "multi2.jpg", "multi3.jpg"] },
  ]).map((c) => c.label),
  ["Pink", "Multi 1", "Multi 2", "Multi 3"],
  "Multi colour with 3 photos gets numbered labels"
);

assertEqual(
  expandColorImages([
    { color: "Multi", image_url: "multi1.jpg", image_urls: ["multi1.jpg"] },
  ]).map((c) => c.label),
  ["Multi"],
  "Multi colour with only 1 url in image_urls keeps plain name (falls back to single)"
);

assertEqual(expandColorImages(undefined), [], "undefined input returns empty array");
assertEqual(expandColorImages([]), [], "empty array input returns empty array");

assertEqual(
  expandColorImages([
    { color: "Multi", image_url: "a.jpg", image_urls: ["a.jpg", "b.jpg"] },
  ]).map((c) => c.color),
  ["Multi", "Multi"],
  "canonical color field stays the plain colour name even when label is disambiguated"
);

if (failed) {
  console.error("\nSome checks FAILED");
  process.exitCode = 1;
} else {
  console.log("\nAll checks passed");
}
```

Run: `npx tsx verify-color-labels.ts`
Expected: every line prints `OK: ...`, ending with `All checks passed`, exit code 0.

- [ ] **Step 3: Delete the disposable script**

```bash
rm verify-color-labels.ts
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/productColors.ts
git commit -m "Add expandColorImages helper for disambiguated colour labels"
```

(The verification script is never staged/committed — confirm `git status` shows only `src/lib/productColors.ts` before committing.)

---

### Task 2: `ProductCardDB.tsx` — Use the Shared Helper

**Files:**
- Modify: `src/components/ProductCardDB.tsx:1-21` (imports)
- Modify: `src/components/ProductCardDB.tsx:66-89` (colour expansion block)

**Interfaces:**
- Consumes: `expandColorImages` from Task 1.
- Produces: `colorLabels` now holds disambiguated labels (`"Multi 1"`, `"Multi 2"`, ...) instead of raw colour names; this is what `handleAddToCart` (unchanged, already reads `colorLabels[activeColor] ?? "default"`) passes to `onAddToCart`.

- [ ] **Step 1: Import the helper**

Add to the import block at the top of the file (after the existing `@/components/ui/product-card` import):

```ts
import { expandColorImages } from "@/lib/productColors";
```

- [ ] **Step 2: Replace the inline expansion logic**

Replace:

```ts
  // Build ProductImagesProps[] from color_images (one image per colour)
  // If no colour images, fall back to the single image_url
  const rawColorImages: ColorImage[] = Array.isArray(product.color_images)
    ? (product.color_images as ColorImage[]).filter((ci) => ci.image_url)
    : [];

  // Expand entries with multiple images (Multi colour) into individual display slots
  const expandedColorImages = rawColorImages.flatMap((ci) => {
    const urls = ci.image_urls && ci.image_urls.length > 1 ? ci.image_urls : [ci.image_url];
    return urls.filter(Boolean).map((url, i) => ({ color: ci.color, image_url: url, index: i }));
  });

  const productImages: ProductImagesProps[] = expandedColorImages.length > 0
    ? expandedColorImages.map((ci, i) => ({
        id: `${product.id}-${ci.color}-${i}`,
        color: ci.color,
        images: [ci.image_url, ci.image_url],
      }))
    : product.image_url
      ? [{ id: product.id, color: "default", images: [product.image_url, product.image_url] }]
      : [];

  const cssSwatches = expandedColorImages.map((ci) => COLOR_SWATCHES[ci.color] ?? "#ccc");
  const colorLabels  = expandedColorImages.map((ci) => ci.color);
```

with:

```ts
  // Expand color_images into one display slot per photo, with disambiguated
  // labels ("Multi 1", "Multi 2", ...) when a colour has more than one photo.
  const expandedColorImages = expandColorImages(product.color_images);

  const productImages: ProductImagesProps[] = expandedColorImages.length > 0
    ? expandedColorImages.map((ci, i) => ({
        id: `${product.id}-${ci.color}-${i}`,
        color: ci.color,
        images: [ci.image_url, ci.image_url],
      }))
    : product.image_url
      ? [{ id: product.id, color: "default", images: [product.image_url, product.image_url] }]
      : [];

  const cssSwatches = expandedColorImages.map((ci) => COLOR_SWATCHES[ci.color] ?? "#ccc");
  const colorLabels  = expandedColorImages.map((ci) => ci.label);
```

Note: the local `ColorImage` interface (near the top of the file, used for the `Product.color_images` field type) is unchanged and still needed — do not remove it.

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductCardDB.tsx
git commit -m "Use shared expandColorImages helper in ProductCardDB"
```

---

### Task 3: `ProductDetailModal.tsx` — Use the Shared Helper, Fix Key Collision

**Files:**
- Modify: `src/components/ProductDetailModal.tsx:1-14` (imports)
- Modify: `src/components/ProductDetailModal.tsx:59-66` (colour expansion block)
- Modify: `src/components/ProductDetailModal.tsx:76-81` (`handleAdd`)
- Modify: `src/components/ProductDetailModal.tsx:158-187` (thumbnail strip)
- Modify: `src/components/ProductDetailModal.tsx:224-253` (colour dot selector)

**Interfaces:**
- Consumes: `expandColorImages` from Task 1.
- Produces: `colorImages[activeColor]?.label` is now what `onAddToCart` receives — same downstream contract as before (a string, `"default"` fallback preserved), just a more specific value when a colour has multiple photos.

- [ ] **Step 1: Import the helper**

Add to the import block at the top of the file (after `import { cn } from "@/lib/utils";`):

```ts
import { expandColorImages } from "@/lib/productColors";
```

- [ ] **Step 2: Replace the inline expansion logic**

Replace:

```ts
  // Expand entries with multiple images (e.g. Multi colour) into individual display slots
  const colorImages = Array.isArray(product?.color_images)
    ? (product!.color_images as { color: string; image_url: string; image_urls?: string[] }[])
        .flatMap((ci) => {
          const urls = ci.image_urls && ci.image_urls.length > 1 ? ci.image_urls : [ci.image_url];
          return urls.filter(Boolean).map((url) => ({ color: ci.color, image_url: url }));
        })
    : [];
```

with:

```ts
  // Expand color_images into one display slot per photo, with disambiguated
  // labels ("Multi 1", "Multi 2", ...) when a colour has more than one photo.
  const colorImages = expandColorImages(product?.color_images);
```

- [ ] **Step 3: Use the disambiguated label in `handleAdd`**

Replace:

```ts
  const handleAdd = () => {
    if (product) {
      onAddToCart(product, quantity, colorImages[activeColor]?.color ?? "default");
      onClose();
    }
  };
```

with:

```ts
  const handleAdd = () => {
    if (product) {
      onAddToCart(product, quantity, colorImages[activeColor]?.label ?? "default");
      onClose();
    }
  };
```

- [ ] **Step 4: Fix the thumbnail strip's caption, key, title, and alt text**

Replace:

```tsx
              {/* ── Thumbnail strip — colour switcher ── */}
              {colorImages.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-12
                                bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-2">
                    {colorImages[activeColor]?.color}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {colorImages.map((ci, idx) => (
                      <button
                        key={ci.color}
                        title={ci.color}
                        onClick={() => handleColorChange(idx)}
                        className={cn(
                          "flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer",
                          activeColor === idx
                            ? "border-white/90 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                            : "border-white/20 opacity-60 hover:opacity-100 hover:border-white/50"
                        )}
                      >
                        <img
                          src={ci.image_url}
                          alt={ci.color}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

with:

```tsx
              {/* ── Thumbnail strip — colour switcher ── */}
              {colorImages.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-12
                                bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-2">
                    {colorImages[activeColor]?.label}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {colorImages.map((ci, idx) => (
                      <button
                        key={ci.label}
                        title={ci.label}
                        onClick={() => handleColorChange(idx)}
                        className={cn(
                          "flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer",
                          activeColor === idx
                            ? "border-white/90 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                            : "border-white/20 opacity-60 hover:opacity-100 hover:border-white/50"
                        )}
                      >
                        <img
                          src={ci.image_url}
                          alt={ci.label}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

- [ ] **Step 5: Fix the colour dot selector's caption and key/title**

Replace:

```tsx
                {/* Colour dot selector */}
                {colorImages.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#71717A]">
                      Colour —{" "}
                      <span className="text-[#09090B] font-medium">
                        {colorImages[activeColor]?.color}
                      </span>
                    </p>
                    <div className="flex gap-2.5">
                      {colorImages.map((ci, idx) => (
                        <button
                          key={ci.color}
                          title={ci.color}
                          onClick={() => handleColorChange(idx)}
                          className="relative h-5 w-5 rounded-full border border-black/10 cursor-pointer"
                          style={{ background: COLOR_SWATCHES[ci.color] ?? "#ccc" }}
                        >
                          {activeColor === idx && (
                            <motion.div
                              layoutId={`detail-swatch-${product.id}`}
                              className="absolute -inset-[3px] rounded-full border-2 border-[#09090B]/60"
                              transition={springTransition}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
```

with:

```tsx
                {/* Colour dot selector */}
                {colorImages.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#71717A]">
                      Colour —{" "}
                      <span className="text-[#09090B] font-medium">
                        {colorImages[activeColor]?.label}
                      </span>
                    </p>
                    <div className="flex gap-2.5">
                      {colorImages.map((ci, idx) => (
                        <button
                          key={ci.label}
                          title={ci.label}
                          onClick={() => handleColorChange(idx)}
                          className="relative h-5 w-5 rounded-full border border-black/10 cursor-pointer"
                          style={{ background: COLOR_SWATCHES[ci.color] ?? "#ccc" }}
                        >
                          {activeColor === idx && (
                            <motion.div
                              layoutId={`detail-swatch-${product.id}`}
                              className="absolute -inset-[3px] rounded-full border-2 border-[#09090B]/60"
                              transition={springTransition}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
```

Note: `style={{ background: COLOR_SWATCHES[ci.color] ?? "#ccc" }}` keeps using `.color` (unchanged) — swatch colour styling must stay keyed off the canonical colour name, not the disambiguated label.

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProductDetailModal.tsx
git commit -m "Use shared expandColorImages helper in ProductDetailModal, fix key collision"
```

---

### Task 4: Final Build + Manual Verification

**Files:** none (verification-only task).

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 2: Manual walkthrough**

```bash
npm run dev
```

In the browser (as an authenticated customer):
1. Find a product whose "Multi" colour has more than one uploaded photo (check via the admin Products tab if unsure which product has this). Open its detail modal or hover its card. Confirm the swatch tooltips/captions read "Multi 1", "Multi 2", etc. — not repeated "Multi".
2. Add "Multi 1" to the bag, then add "Multi 2" from the same product. Confirm the cart shows two separate lines, each labeled with its specific "Multi N" value.
3. Open a product whose colours are all single-photo (e.g. Pink/Blue/Green). Confirm labels are unchanged — still "Pink", "Blue", etc., no "1" suffix.
4. Complete checkout for the multi-photo product and confirm the admin Orders tab (`/admin`) shows the disambiguated colour ("Multi 1" or "Multi 2", matching whichever was ordered) against the correct line item.

- [ ] **Step 3: Report back to the user**

Summarize what was verified, and flag anything that couldn't be tested (e.g. if no product in the current catalogue actually has a multi-photo "Multi" colour, note that the fix was verified via the Task 1 script's assertions and via build only, and ask the user to confirm visually once such a product exists).
