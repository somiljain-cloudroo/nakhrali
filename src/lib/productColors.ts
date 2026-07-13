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

export interface ColorStockRow {
  color: string;
  stock_quantity: number;
}

// A colour with no row yet falls back to the product's own stock_quantity
// (when provided) — mirroring the approval trigger's own fallback, so a
// colour never shows "available" on the storefront when the trigger would
// actually reject an order for it. With no fallback provided, a rowless
// colour is treated as in-stock (admin hasn't set a number for it yet).
export function isColorSoldOut(
  label: string,
  stockRows: ColorStockRow[] | null | undefined,
  fallbackStock?: number
): boolean {
  const row = stockRows?.find((r) => r.color === label);
  if (row) return row.stock_quantity <= 0;
  return fallbackStock !== undefined ? fallbackStock <= 0 : false;
}
