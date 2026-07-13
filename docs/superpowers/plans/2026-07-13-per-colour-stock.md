# Per-Colour Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track stock per colour variant (keyed by the same disambiguated label already used in `order_items.color`), decrement the right colour's stock on order approval, and disable a specific sold-out swatch on the storefront while leaving other colours of the same product purchasable.

**Architecture:** A new `product_color_stock` table (one row per `product_id` + disambiguated colour label). The existing approval trigger is rewritten to try a per-colour row first, falling back to `products.stock_quantity` for colourless products or colours with no row yet. The storefront's two colour-picker components look up each swatch's stock via a new shared helper and disable sold-out ones. Admin manages per-variant stock in `ProductManagement.tsx`, reusing the existing `expandColorImages` helper to know which labels are sellable.

**Tech Stack:** Supabase Postgres (migration, PL/pgSQL trigger, RLS). Vite + React + TypeScript + shadcn/ui.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-per-colour-stock-design.md`
- Colourless products (no `color_images`) are completely unaffected — they keep using `products.stock_quantity` exactly as today.
- `ProductPage.tsx` is out of scope (no add-to-cart, doesn't expand multi-photo colours) — consistent with the earlier Multi-colour-labeling feature.
- A colour with no `product_color_stock` row yet is treated as in-stock (not sold out) — both in the trigger (falls back to product-level stock) and on the storefront (never shows disabled).
- `src/integrations/supabase/types.ts` is not regenerated (established convention this session) — new table/column access uses local TypeScript interfaces and casts, matching how `color_images`, `discount_codes`, etc. are already handled.
- No automated test suite. `npm run build` (vite build) is the standard gate. The trigger has no local test harness — verification is manual, as in Task 8.
- Applying the migration to the linked Supabase project modifies production schema — **do not run `supabase db push` without first telling the user exactly what will run and getting explicit confirmation.**

---

### Task 1: Database — `product_color_stock` Table and Colour-Aware Approval Trigger

**Files:**
- Create: `supabase/migrations/20260713000000_add_product_color_stock.sql`

**Interfaces:**
- Produces: table `public.product_color_stock` (`id`, `product_id`, `color` [disambiguated label], `stock_quantity`, timestamps), unique on `(product_id, color)`. Rewritten `decrement_stock_on_order_approval()` (same trigger name/attachment as before — no client code needs to change to benefit from this). Tasks 2–7 all read from or write to this table.

- [ ] **Step 1: Write the migration**

```sql
-- Per-colour stock: one row per (product, disambiguated colour label — the
-- same label already stored in order_items.color, e.g. "Pink", "Multi 1").
-- Colourless products keep using products.stock_quantity unchanged; a
-- colour with no row here is treated as in-stock until admin sets one.

CREATE TABLE public.product_color_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, color)
);

ALTER TABLE public.product_color_stock ENABLE ROW LEVEL SECURITY;

-- Public read — the storefront needs this to render Sold Out states,
-- same posture as "Products are viewable by everyone".
CREATE POLICY "Product colour stock is viewable by everyone"
ON public.product_color_stock
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product colour stock"
ON public.product_color_stock
FOR ALL
USING (public.get_my_role() IN ('admin', 'sales_admin'))
WITH CHECK (public.get_my_role() IN ('admin', 'sales_admin'));

CREATE TRIGGER update_product_color_stock_updated_at
BEFORE UPDATE ON public.product_color_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Rewrite the approval trigger to try a per-colour row first, falling
-- back to product-level stock (colourless products, or a colour with no
-- row set up yet). Same lock-check-decrement-or-raise pattern as before,
-- just colour-scoped when a matching row exists.
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
  color_stock_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    FOR item IN
      SELECT product_id, quantity, color
      FROM public.order_items
      WHERE order_id = NEW.id
    LOOP
      SELECT id, stock_quantity INTO color_stock_id, current_stock
      FROM public.product_color_stock
      WHERE product_id = item.product_id AND color = item.color
      FOR UPDATE;

      IF FOUND THEN
        SELECT name INTO prod_name FROM public.products WHERE id = item.product_id;

        IF item.quantity > current_stock THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (%): need %, only % in stock', prod_name, item.color, item.quantity, current_stock;
        END IF;

        UPDATE public.product_color_stock
        SET stock_quantity = stock_quantity - item.quantity
        WHERE id = color_stock_id;
      ELSE
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
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: Review the SQL for correctness**

Confirm: `UNIQUE (product_id, color)` is present (needed for the admin UI's delete-then-insert save pattern in Task 7 to behave predictably); the public SELECT policy has no role restriction (`USING (true)`); the per-colour branch's `FOR UPDATE` lock is acquired before its insufficient-stock check, matching the original trigger's pattern; the fallback branch is byte-for-byte the same logic as the original (pre-this-migration) trigger, so colourless products see zero behavior change; `CREATE OR REPLACE FUNCTION` makes this safe to re-run (the `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER` from the original migration already exists and doesn't need repeating since the trigger's name/attachment aren't changing, only the function body it points to).

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260713000000_add_product_color_stock.sql
git commit -m "Add product_color_stock table and colour-aware approval trigger"
```

- [ ] **Step 4: Apply the migration — requires explicit user confirmation first**

Tell the user the exact command (`npx supabase db push`) and wait for their go-ahead. Do not proceed to Task 8's manual verification until confirmed applied.

---

### Task 2: `useProducts.ts` — Join Per-Colour Stock

**Files:**
- Modify: `src/hooks/useProducts.ts`

**Interfaces:**
- Produces: `Product` type (local to this hook) gains `product_color_stock?: { color: string; stock_quantity: number }[]`. Consumed by Task 5 (`ProductCardDB.tsx`) and Task 6 (`ProductDetailModal.tsx`) via the `product` objects they receive as props from `Index.tsx`, which sources them from this hook.

- [ ] **Step 1: Extend the `Product` type**

Replace:

```ts
type Product = Database['public']['Tables']['products']['Row'] & {
  category?: Database['public']['Tables']['categories']['Row'];
};
```

with:

```ts
type Product = Database['public']['Tables']['products']['Row'] & {
  category?: Database['public']['Tables']['categories']['Row'];
  product_color_stock?: { color: string; stock_quantity: number }[];
};
```

- [ ] **Step 2: Join `product_color_stock` into the products query**

Replace:

```ts
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('is_active', true)
        .order('name');
```

with:

```ts
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          product_color_stock(color, stock_quantity)
        `)
        .eq('is_active', true)
        .order('name');
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useProducts.ts
git commit -m "Join per-colour stock into the storefront products query"
```

---

### Task 3: Shared Helper — `isColorSoldOut`

**Files:**
- Modify: `src/lib/productColors.ts`

**Interfaces:**
- Produces: `isColorSoldOut(label: string, stockRows: ColorStockRow[] | null | undefined): boolean` and the exported `ColorStockRow` type. Consumed by Task 4 (indirectly, via Task 5/6 passing computed flags into `ProductColorsThumbs`), Task 5, and Task 6.

- [ ] **Step 1: Add the helper**

Append to the end of the file:

```ts
export interface ColorStockRow {
  color: string;
  stock_quantity: number;
}

// A colour with no row yet is treated as in-stock — admin hasn't set a
// number for it, so don't hide it as sold out by default.
export function isColorSoldOut(
  label: string,
  stockRows: ColorStockRow[] | null | undefined
): boolean {
  if (!stockRows) return false;
  const row = stockRows.find((r) => r.color === label);
  return row ? row.stock_quantity <= 0 : false;
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/productColors.ts
git commit -m "Add isColorSoldOut helper for per-colour stock checks"
```

---

### Task 4: `ProductColorsThumbs` — Sold-Out Swatch Support (+ Key Fix)

**Files:**
- Modify: `src/components/ui/product-card.tsx:115-156`

**Interfaces:**
- Consumes: nothing from other tasks directly (this is a leaf UI component).
- Produces: `ProductColorsThumbsProps` gains an optional `soldOut?: boolean[]` prop, aligned by index with `productColors`/`colorLabels`. Task 5 (`ProductCardDB.tsx`) passes this in.

- [ ] **Step 1: Add sold-out support and fix the swatch key**

Replace:

```tsx
interface ProductColorsThumbsProps {
  productId: string
  productColors: string[]        // CSS color values e.g. "#C9A84C"
  colorLabels?: string[]         // Human-readable labels e.g. "Gold"
  activeColor: number
  setActiveColor: (index: number) => void
  className?: string
}

export function ProductColorsThumbs({
  productId,
  productColors,
  colorLabels,
  activeColor,
  setActiveColor,
  className,
}: ProductColorsThumbsProps) {
  return (
    <div className={cn("my-2 flex gap-2 px-1", className)}>
      {productColors.map((productColor, index) => (
        <button
          key={productColor}
          role="button"
          aria-label={colorLabels?.[index] ?? `Color ${index + 1}`}
          title={colorLabels?.[index] ?? productColor}
          className="relative size-4 appearance-none rounded-full border border-neutral-200 cursor-pointer"
          style={{ background: productColor }}
          onMouseEnter={() => setActiveColor(index)}
          onClick={() => setActiveColor(index)}
        >
          {index === activeColor && (
            <motion.div
              layoutId={productId}
              className="absolute -left-[2px] -top-[2px] size-[18px] rounded-full border border-gray-500"
              transition={springTransition}
            />
          )}
        </button>
      ))}
    </div>
  )
}
```

with:

```tsx
interface ProductColorsThumbsProps {
  productId: string
  productColors: string[]        // CSS color values e.g. "#C9A84C"
  colorLabels?: string[]         // Human-readable labels e.g. "Gold"
  activeColor: number
  setActiveColor: (index: number) => void
  soldOut?: boolean[]            // Aligned by index with productColors/colorLabels
  className?: string
}

export function ProductColorsThumbs({
  productId,
  productColors,
  colorLabels,
  activeColor,
  setActiveColor,
  soldOut,
  className,
}: ProductColorsThumbsProps) {
  return (
    <div className={cn("my-2 flex gap-2 px-1", className)}>
      {productColors.map((productColor, index) => {
        const isSoldOut = soldOut?.[index] ?? false
        const label = colorLabels?.[index] ?? `Color ${index + 1}`
        return (
          <button
            key={label}
            role="button"
            aria-label={isSoldOut ? `${label} (Sold Out)` : label}
            title={isSoldOut ? `${label} — Sold Out` : (colorLabels?.[index] ?? productColor)}
            disabled={isSoldOut}
            className={cn(
              "relative size-4 appearance-none rounded-full border border-neutral-200 cursor-pointer",
              isSoldOut && "opacity-30 cursor-not-allowed"
            )}
            style={{ background: productColor }}
            onMouseEnter={() => !isSoldOut && setActiveColor(index)}
            onClick={() => !isSoldOut && setActiveColor(index)}
          >
            {index === activeColor && (
              <motion.div
                layoutId={productId}
                className="absolute -left-[2px] -top-[2px] size-[18px] rounded-full border border-gray-500"
                transition={springTransition}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
```

Note: the swatch `key` changes from `productColor` (the CSS colour VALUE — a real bug, since e.g. "Multi 1" and "Multi 2" share the same gradient CSS string and would collide) to `label` (guaranteed unique per the `expandColorImages` helper's own invariant, same fix already applied elsewhere in this codebase for the Multi-colour-labeling feature).

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/product-card.tsx
git commit -m "Add sold-out swatch support to ProductColorsThumbs, fix key collision"
```

---

### Task 5: `ProductCardDB.tsx` — Wire Sold-Out State

**Files:**
- Modify: `src/components/ProductCardDB.tsx`

**Interfaces:**
- Consumes: `isColorSoldOut`/`ColorStockRow` from Task 3, `ProductColorsThumbs`'s new `soldOut` prop from Task 4, `product.product_color_stock` from Task 2.
- Produces: nothing further downstream.

- [ ] **Step 1: Import the helper and extend the local `Product` type**

Replace:

```ts
import { expandColorImages } from "@/lib/productColors";
```

with:

```ts
import { expandColorImages, isColorSoldOut } from "@/lib/productColors";
```

Replace:

```ts
type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: ColorImage[];
};
```

with:

```ts
type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: ColorImage[];
  product_color_stock?: { color: string; stock_quantity: number }[];
};
```

- [ ] **Step 2: Compute per-swatch sold-out flags and the colour-aware `isInStock`**

Replace:

```ts
  const cssSwatches = expandedColorImages.map((ci) => COLOR_SWATCHES[ci.color] ?? "#ccc");
  const colorLabels  = expandedColorImages.map((ci) => ci.label);
```

with:

```ts
  const cssSwatches = expandedColorImages.map((ci) => COLOR_SWATCHES[ci.color] ?? "#ccc");
  const colorLabels  = expandedColorImages.map((ci) => ci.label);
  const soldOutFlags = expandedColorImages.map((ci) => isColorSoldOut(ci.label, product.product_color_stock));
```

Replace:

```ts
  const isInStock = product.stock_quantity > 0;
```

with:

```ts
  const isInStock = expandedColorImages.length > 0
    ? soldOutFlags.some((so) => !so)
    : product.stock_quantity > 0;
  const activeColorSoldOut = soldOutFlags[activeColor] ?? false;
```

Note: `activeColorSoldOut` must be declared after `activeColor` is available (from `useSetActiveProduct()`, already defined earlier in the component) — place this replacement block after that line, not before. Read the current file to confirm ordering before applying.

- [ ] **Step 3: Pass `soldOut` into `ProductColorsThumbs`**

Replace:

```tsx
      {cssSwatches.length > 1 && (
        <ProductColorsThumbs
          productId={product.id}
          productColors={cssSwatches}
          colorLabels={colorLabels}
          activeColor={activeColor}
          setActiveColor={handleColorChange}
          className="px-4 pt-2 pb-0"
        />
      )}
```

with:

```tsx
      {cssSwatches.length > 1 && (
        <ProductColorsThumbs
          productId={product.id}
          productColors={cssSwatches}
          colorLabels={colorLabels}
          activeColor={activeColor}
          setActiveColor={handleColorChange}
          soldOut={soldOutFlags}
          className="px-4 pt-2 pb-0"
        />
      )}
```

- [ ] **Step 4: Gate the Add to Bag CTA on the active colour not being sold out**

Replace:

```tsx
        {/* CTA */}
        {isAuthenticated && isInStock ? (
          <div className="flex flex-col gap-2">
```

with:

```tsx
        {/* CTA */}
        {isAuthenticated && isInStock && !activeColorSoldOut ? (
          <div className="flex flex-col gap-2">
```

Replace:

```tsx
        ) : !isAuthenticated ? (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium border-dashed" disabled>
            <Lock className="h-3.5 w-3.5 mr-1.5" />Login to Order
          </Button>
        ) : (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium text-muted-foreground" disabled>
            Sold Out
          </Button>
        )}
```

with:

```tsx
        ) : isAuthenticated && isInStock && activeColorSoldOut ? (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium text-muted-foreground" disabled>
            Select an available colour
          </Button>
        ) : !isAuthenticated ? (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium border-dashed" disabled>
            <Lock className="h-3.5 w-3.5 mr-1.5" />Login to Order
          </Button>
        ) : (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium text-muted-foreground" disabled>
            Sold Out
          </Button>
        )}
```

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProductCardDB.tsx
git commit -m "Disable sold-out colour swatches on the product card"
```

---

### Task 6: `ProductDetailModal.tsx` — Wire Sold-Out State

**Files:**
- Modify: `src/components/ProductDetailModal.tsx`

**Interfaces:**
- Consumes: `isColorSoldOut` from Task 3, `product.product_color_stock` from Task 2.
- Produces: nothing further downstream.

- [ ] **Step 1: Import the helper and extend the local `Product` type**

Replace:

```ts
import { expandColorImages } from "@/lib/productColors";
```

with:

```ts
import { expandColorImages, isColorSoldOut } from "@/lib/productColors";
```

Replace:

```ts
type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: { color: string; image_url: string; image_urls?: string[] }[];
};
```

with:

```ts
type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: { color: string; image_url: string; image_urls?: string[] }[];
  product_color_stock?: { color: string; stock_quantity: number }[];
};
```

- [ ] **Step 2: Compute sold-out flags and the colour-aware `isInStock`**

Replace:

```ts
  const displayImage =
    colorImages[activeColor]?.image_url ?? product?.image_url ?? null;

  const minQty = product?.min_order_quantity || 1;
  const [quantity, setQuantity] = useState(minQty);

  const isInStock = (product?.stock_quantity ?? 0) > 0;
```

with:

```ts
  const displayImage =
    colorImages[activeColor]?.image_url ?? product?.image_url ?? null;

  const minQty = product?.min_order_quantity || 1;
  const [quantity, setQuantity] = useState(minQty);

  const soldOutFlags = colorImages.map((ci) => isColorSoldOut(ci.label, product?.product_color_stock));
  const isInStock = colorImages.length > 0
    ? soldOutFlags.some((so) => !so)
    : (product?.stock_quantity ?? 0) > 0;
  const activeColorSoldOut = soldOutFlags[activeColor] ?? false;
```

- [ ] **Step 3: Disable sold-out thumbnails in the thumbnail strip**

Replace:

```tsx
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
```

with:

```tsx
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {colorImages.map((ci, idx) => {
                      const isSoldOut = soldOutFlags[idx];
                      return (
                        <button
                          key={ci.label}
                          title={isSoldOut ? `${ci.label} — Sold Out` : ci.label}
                          disabled={isSoldOut}
                          onClick={() => !isSoldOut && handleColorChange(idx)}
                          className={cn(
                            "relative flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all duration-200",
                            isSoldOut
                              ? "border-white/10 opacity-30 cursor-not-allowed"
                              : "cursor-pointer",
                            !isSoldOut && activeColor === idx
                              ? "border-white/90 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                              : !isSoldOut && "border-white/20 opacity-60 hover:opacity-100 hover:border-white/50"
                          )}
                        >
                          <img
                            src={ci.image_url}
                            alt={ci.label}
                            className="h-full w-full object-cover"
                          />
                          {isSoldOut && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[8px] uppercase tracking-wide text-white">
                              Sold Out
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
```

- [ ] **Step 4: Disable sold-out dots in the colour dot selector**

Replace:

```tsx
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
```

with:

```tsx
                    <div className="flex gap-2.5">
                      {colorImages.map((ci, idx) => {
                        const isSoldOut = soldOutFlags[idx]
                        return (
                          <button
                            key={ci.label}
                            title={isSoldOut ? `${ci.label} — Sold Out` : ci.label}
                            disabled={isSoldOut}
                            onClick={() => !isSoldOut && handleColorChange(idx)}
                            className={cn(
                              "relative h-5 w-5 rounded-full border border-black/10",
                              isSoldOut ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                            )}
                            style={{ background: COLOR_SWATCHES[ci.color] ?? "#ccc" }}
                          >
                            {!isSoldOut && activeColor === idx && (
                              <motion.div
                                layoutId={`detail-swatch-${product.id}`}
                                className="absolute -inset-[3px] rounded-full border-2 border-[#09090B]/60"
                                transition={springTransition}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
```

- [ ] **Step 5: Gate the sticky CTA on the active colour not being sold out**

Replace:

```tsx
                  {isAuthenticated ? (
                    isInStock ? (
                      <div className="flex items-center gap-3">
```

with:

```tsx
                  {isAuthenticated ? (
                    isInStock && !activeColorSoldOut ? (
                      <div className="flex items-center gap-3">
```

Replace:

```tsx
                    ) : (
                      <button
                        disabled
                        className="w-full h-10 rounded-xl text-sm font-medium text-[#A1A1AA]
                                   border border-[#E4E4E7] bg-white cursor-not-allowed"
                      >
                        Sold Out
                      </button>
                    )
                  ) : (
```

with:

```tsx
                    ) : isInStock && activeColorSoldOut ? (
                      <button
                        disabled
                        className="w-full h-10 rounded-xl text-sm font-medium text-[#A1A1AA]
                                   border border-[#E4E4E7] bg-white cursor-not-allowed"
                      >
                        Select an available colour
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full h-10 rounded-xl text-sm font-medium text-[#A1A1AA]
                                   border border-[#E4E4E7] bg-white cursor-not-allowed"
                      >
                        Sold Out
                      </button>
                    )
                  ) : (
```

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProductDetailModal.tsx
git commit -m "Disable sold-out colour swatches in the product detail modal"
```

---

### Task 7: `ProductManagement.tsx` — Admin Per-Colour Stock

**Files:**
- Modify: `src/components/admin/ProductManagement.tsx`

**Interfaces:**
- Consumes: `expandColorImages` (already imported? — check; if not, import it from `@/lib/productColors`).
- Produces: nothing further downstream — this is the admin-facing leaf that writes `product_color_stock` rows Task 1's trigger and Tasks 5/6's storefront reads consume.

- [ ] **Step 1: Import `expandColorImages` and extend the `Product` interface**

Add near the top imports (after the existing `import Papa from "papaparse";` line):

```ts
import { expandColorImages } from "@/lib/productColors";
```

Replace:

```ts
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  brand: string | null;
  category_id: string | null;
  stock_quantity: number;
  min_order_quantity: number;
  unit: string;
  is_active: boolean;
  image_url: string | null;
  color_images: ColorImage[];
  categories?: { name: string } | null;
}
```

with:

```ts
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  brand: string | null;
  category_id: string | null;
  stock_quantity: number;
  min_order_quantity: number;
  unit: string;
  is_active: boolean;
  image_url: string | null;
  color_images: ColorImage[];
  categories?: { name: string } | null;
  product_color_stock?: { color: string; stock_quantity: number }[];
}
```

- [ ] **Step 2: Add `colorStock` state**

Replace:

```ts
  const [formData, setFormData] = useState<FormData>(emptyForm());
```

with:

```ts
  const [formData, setFormData] = useState<FormData>(emptyForm());
  const [colorStock, setColorStock] = useState<Record<string, string>>({});
```

- [ ] **Step 3: Join `product_color_stock` into `fetchData`**

Replace:

```ts
        supabase
          .from("products")
          .select("*, categories (name)")
          .order("created_at", { ascending: false }),
```

with:

```ts
        supabase
          .from("products")
          .select("*, categories (name), product_color_stock (color, stock_quantity)")
          .order("created_at", { ascending: false }),
```

- [ ] **Step 4: Populate `colorStock` when editing**

Replace:

```ts
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      sku: product.sku || "",
      brand: product.brand || "",
      category_id: product.category_id || "",
      stock_quantity: product.stock_quantity.toString(),
      min_order_quantity: product.min_order_quantity.toString(),
      unit: product.unit,
      image_url: product.image_url || "",
      color_images: product.color_images || [],
      is_active: product.is_active,
    });
    setIsDialogOpen(true);
  };
```

with:

```ts
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      sku: product.sku || "",
      brand: product.brand || "",
      category_id: product.category_id || "",
      stock_quantity: product.stock_quantity.toString(),
      min_order_quantity: product.min_order_quantity.toString(),
      unit: product.unit,
      image_url: product.image_url || "",
      color_images: product.color_images || [],
      is_active: product.is_active,
    });
    const stockMap: Record<string, string> = {};
    (product.product_color_stock ?? []).forEach((row) => {
      stockMap[row.color] = row.stock_quantity.toString();
    });
    setColorStock(stockMap);
    setIsDialogOpen(true);
  };
```

- [ ] **Step 5: Reset `colorStock` alongside the rest of the form**

Replace:

```ts
  const resetForm = () => {
    setFormData(emptyForm());
    setEditingProduct(null);
  };
```

with:

```ts
  const resetForm = () => {
    setFormData(emptyForm());
    setEditingProduct(null);
    setColorStock({});
  };
```

- [ ] **Step 6: Capture the saved product's id and sync `product_color_stock` on submit**

Replace:

```ts
      let error: Error | null = null;
      if (editingProduct) {
        const { data: rows, error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)
          .select("id");
        error = updateError;
        if (!updateError && (!rows || rows.length === 0)) {
          error = new Error("Update blocked — check your admin permissions");
        }
      } else {
        const { error: insertError } = await supabase.from("products").insert(productData);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Success", description: `Product ${editingProduct ? "updated" : "created"} successfully` });
```

with:

```ts
      let error: Error | null = null;
      let savedProductId: string | null = editingProduct?.id ?? null;
      if (editingProduct) {
        const { data: rows, error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)
          .select("id");
        error = updateError;
        if (!updateError && (!rows || rows.length === 0)) {
          error = new Error("Update blocked — check your admin permissions");
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();
        error = insertError;
        savedProductId = inserted?.id ?? null;
      }

      if (error) throw error;

      // Sync per-colour stock: full replace, scoped to this product, matching
      // whatever sellable labels currently exist after any photo add/remove.
      if (savedProductId) {
        await supabase.from("product_color_stock").delete().eq("product_id", savedProductId);
        const currentLabels = expandColorImages(formData.color_images).map((ci) => ci.label);
        if (currentLabels.length > 0) {
          const stockRows = currentLabels.map((label) => ({
            product_id: savedProductId,
            color: label,
            stock_quantity: parseInt(colorStock[label] || "0") || 0,
          }));
          const { error: stockError } = await supabase.from("product_color_stock").insert(stockRows);
          if (stockError) throw stockError;
        }
      }

      toast({ title: "Success", description: `Product ${editingProduct ? "updated" : "created"} successfully` });
```

- [ ] **Step 7: Add a stock input per multi-photo variant**

Replace:

```tsx
                            {isMulti ? (
                              /* Multi-photo grid */
                              <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  {multiUrls.map((url, imgIdx) => (
                                    <div key={imgIdx} className="relative rounded-lg overflow-hidden border border-border">
                                      <img
                                        src={url}
                                        alt={`${ci.color} ${imgIdx + 1}`}
                                        className="w-full h-24 object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeMultiImage(idx, imgIdx)}
                                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
```

with:

```tsx
                            {isMulti ? (
                              /* Multi-photo grid */
                              <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  {multiUrls.map((url, imgIdx) => {
                                    const variantLabel = multiUrls.length > 1 ? `${ci.color} ${imgIdx + 1}` : ci.color;
                                    return (
                                    <div key={imgIdx} className="space-y-1">
                                      <div className="relative rounded-lg overflow-hidden border border-border">
                                        <img
                                          src={url}
                                          alt={`${ci.color} ${imgIdx + 1}`}
                                          className="w-full h-24 object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeMultiImage(idx, imgIdx)}
                                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="Stock"
                                        className="text-[11px] h-7 px-2"
                                        value={colorStock[variantLabel] ?? ""}
                                        onChange={(e) => setColorStock({ ...colorStock, [variantLabel]: e.target.value })}
                                      />
                                    </div>
                                    );
                                  })}
```

Note: `variantLabel` mirrors `expandColorImages`'s own numbering rule (plain name if only one photo, `"<color> N"` if more than one) — must match exactly what `expandColorImages(formData.color_images)` will compute for this same data, since Step 6's save logic reads `colorStock` keyed by those same computed labels.

- [ ] **Step 8: Add a stock input for single-photo colours**

Replace:

```tsx
                                <Input
                                  className="text-[11px] h-7 px-2"
                                  placeholder="Or paste URL…"
                                  value={ci.image_url}
                                  onChange={(e) => {
                                    const updated = [...formData.color_images];
                                    updated[idx] = { ...updated[idx], image_url: e.target.value };
                                    setFormData({ ...formData, color_images: updated });
                                  }}
                                />
                              </>
                            )}
```

with:

```tsx
                                <Input
                                  className="text-[11px] h-7 px-2"
                                  placeholder="Or paste URL…"
                                  value={ci.image_url}
                                  onChange={(e) => {
                                    const updated = [...formData.color_images];
                                    updated[idx] = { ...updated[idx], image_url: e.target.value };
                                    setFormData({ ...formData, color_images: updated });
                                  }}
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Stock"
                                  className="text-[11px] h-7 px-2"
                                  value={colorStock[ci.color] ?? ""}
                                  onChange={(e) => setColorStock({ ...colorStock, [ci.color]: e.target.value })}
                                />
                              </>
                            )}
```

- [ ] **Step 9: Verify the build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/ProductManagement.tsx
git commit -m "Add per-colour stock inputs to admin product form"
```

---

### Task 8: Final Build + Manual Verification

**Files:** none (verification-only task).

- [ ] **Step 1: Full production build**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 2: Manual walkthrough (requires Task 1's migration applied)**

1. In the admin Products tab, edit a product that has a colour with 2+ photos (e.g. "Multi"). Confirm two separate stock inputs appear, one per photo, labeled implicitly by position ("Multi 1", "Multi 2" — check via the placeholder/hover if not directly labeled). Set one to 0, save.
2. On the storefront (product card and detail modal), confirm the sold-out variant's swatch/thumbnail is visibly disabled and cannot be clicked/selected, while the other colour(s) of the same product remain selectable and orderable. Confirm the product-level Sold Out overlay does NOT appear (since other colours still have stock).
3. Set every colour's stock to 0 for that product — confirm the product-level Sold Out overlay now appears and Add to Bag is fully disabled, matching today's whole-product behavior.
4. Approve an order for a colour with sufficient per-colour stock — confirm that specific `product_color_stock` row decrements by the ordered quantity (check via the admin Products tab's stock inputs after re-opening the product).
5. Attempt to approve an order for a colour with insufficient per-colour stock — confirm it's blocked with a specific error naming the product and colour, order stays pending, stock unchanged.
6. Confirm a colourless product (no colour variants) is completely unaffected — its single "Sold Out" behavior driven by `stock_quantity` still works exactly as before.
7. Confirm a colour that has photos but no `product_color_stock` row yet (e.g. a product not touched by this rollout) still shows as selectable/in-stock.

- [ ] **Step 3: Report back to the user**

Summarize what was verified. If step 2 couldn't be performed live (no multi-photo product available, or migration not yet applied), say so explicitly rather than claiming success.
