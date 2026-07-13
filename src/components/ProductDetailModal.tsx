/**
 * ProductDetailModal — 21st.dev Liquid Glass design system
 * Dark backdrop blur • Full-bleed image • AnimatePresence crossfade
 * Thumbnail strip overlay • Spring colour selector • Cream details panel
 */
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X, ShoppingCart, Minus, Plus, Lock, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSetActiveProduct } from "@/components/ui/product-card";
import { useAuth } from "@/hooks/useAuth";
import { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { expandColorImages, isColorSoldOut } from "@/lib/productColors";

type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: { color: string; image_url: string; image_urls?: string[] }[];
  product_color_stock?: { color: string; stock_quantity: number }[];
};

const COLOR_SWATCHES: Record<string, string> = {
  "Pink":   "#F4A7B9",
  "Teal":   "#008080",
  "Purple": "#7B4F9E",
  "Green":  "#3A7D44",
  "White":  "#F5F5F5",
  "Beige":  "#D9C4A0",
  "Multi":  "linear-gradient(135deg, #F4A7B9 20%, #7B4F9E 20% 40%, #3A7D44 40% 60%, #D4AF37 60% 80%, #1B6CA8 80%)",
  "Kundan": "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #aee6ff 25%, rgba(255,255,255,0.8) 45%, #ffb7d5 65%, rgba(255,255,255,0.95) 80%, #c8b6ff 100%)",
  "Golden": "#C9A84C",
  "Blue":   "#1B6CA8",
  "Maroon": "#800000",
  "Yellow": "#F5C518",
  "Brown":  "#795548",
  "Orange": "#E65100",
  "Silver": "#A8A9AD",
  "Black":  "#1A1A1A",
};

// Spring config for colour ring
const springTransition = { type: "spring", stiffness: 500, damping: 50, mass: 1 };

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, color: string) => void;
}

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const { isAuthenticated } = useAuth();
  const { activeColor, handleColorChange } = useSetActiveProduct();

  // Expand color_images into one display slot per photo, with disambiguated
  // labels ("Multi 1", "Multi 2", ...) when a colour has more than one photo.
  const colorImages = expandColorImages(product?.color_images);

  const displayImage =
    colorImages[activeColor]?.image_url ?? product?.image_url ?? null;

  const minQty = product?.min_order_quantity || 1;
  const [quantity, setQuantity] = useState(minQty);

  const soldOutFlags = colorImages.map((ci) => isColorSoldOut(ci.label, product?.product_color_stock));
  const isInStock = colorImages.length > 0
    ? soldOutFlags.some((so) => !so)
    : (product?.stock_quantity ?? 0) > 0;
  const activeColorSoldOut = soldOutFlags[activeColor] ?? false;

  const handleAdd = () => {
    if (product) {
      onAddToCart(product, quantity, colorImages[activeColor]?.label ?? "default");
      onClose();
    }
  };

  if (!product) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        {/* ── Backdrop: dark blur ── */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                     duration-300"
        />

        {/* ── Modal ── */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                     w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh]
                     overflow-hidden rounded-2xl shadow-2xl outline-none
                     grid grid-cols-1 md:grid-cols-[3fr_2fr]
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                     data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
                     data-[state=open]:slide-in-from-top-[2%] duration-300"
        >
          <>
            {/* ─────────────────────────────────────────────────────────── */}
            {/* LEFT — full-bleed image panel                               */}
            {/* ─────────────────────────────────────────────────────────── */}
            <div className="relative bg-[#18181B] min-h-[280px] md:min-h-[600px] overflow-hidden">

              {/* Crossfade image */}
              <AnimatePresence mode="wait">
                {displayImage ? (
                  <motion.img
                    key={displayImage}
                    src={displayImage}
                    alt={product.name}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="absolute inset-0 h-full w-full object-contain p-4"
                  />
                ) : (
                  <motion.div
                    key="no-img"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-10"
                  >
                    <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Gem className="h-10 w-10 text-white/30" />
                    </div>
                    <p className="text-sm text-white/30 font-light">{product.name}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Category badge */}
              <div className="absolute top-4 left-4 z-10">
                <span className="text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full font-medium
                                 bg-white/10 backdrop-blur-sm text-white/70 border border-white/10">
                  {product.category?.name ?? "Jewellery"}
                </span>
              </div>

              {/* Sold out overlay */}
              {!isInStock && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                  <span className="px-5 py-2 rounded-full text-sm font-semibold bg-red-600/90 text-white">
                    Sold Out
                  </span>
                </div>
              )}

              {/* ── Thumbnail strip — colour switcher ── */}
              {colorImages.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-12
                                bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-2">
                    {colorImages[activeColor]?.label}
                  </p>
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
                </div>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* RIGHT — details panel                                       */}
            {/* ─────────────────────────────────────────────────────────── */}
            <div className="flex flex-col bg-[#FAFAFA] overflow-y-auto max-h-[90vh] md:max-h-[600px]">

              {/* Close button */}
              <DialogPrimitive.Close asChild>
                <button className="absolute top-4 right-4 z-50 h-8 w-8 rounded-full
                                   bg-white/10 backdrop-blur-sm border border-white/20
                                   flex items-center justify-center
                                   hover:bg-white/20 transition-colors duration-150 cursor-pointer
                                   md:bg-[#18181B]/10 md:border-[#18181B]/20 md:hover:bg-[#18181B]/20">
                  <X className="h-3.5 w-3.5 text-white md:text-[#18181B]" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogPrimitive.Close>

              <div className="flex flex-col flex-1 p-6 md:p-8 gap-6">

                {/* Product name */}
                <div>
                  {product.sku && (
                    <p className="text-[10px] font-mono text-[#71717A] tracking-[0.15em] mb-1.5">
                      {product.sku}
                    </p>
                  )}
                  <h2
                    className="text-2xl md:text-3xl font-light leading-tight text-[#09090B]"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {product.name}
                  </h2>
                </div>

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
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-[#E4E4E7]" />

                {/* Description */}
                {product.description && (
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    {product.description}
                  </p>
                )}


              </div>

              {/* ── Sticky CTA footer ── */}
              <div className="border-t border-[#E4E4E7] px-6 md:px-8 py-5 bg-[#FAFAFA] space-y-4">

                <>
                  {/* Price */}
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-3xl font-bold leading-none"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-[#71717A]">per {product.unit}</span>
                  </div>
                  {minQty > 1 && (
                    <p className="text-xs text-[#A1A1AA]">Min. order: {minQty}</p>
                  )}

                  {isAuthenticated ? (
                    isInStock && !activeColorSoldOut ? (
                      <div className="flex items-center gap-3">
                        {/* Qty */}
                        <div className="flex items-center rounded-xl border border-[#E4E4E7] bg-white">
                          <button
                            onClick={() => setQuantity((q) => Math.max(minQty, q - 1))}
                            disabled={quantity <= minQty}
                            className="h-10 w-10 flex items-center justify-center hover:bg-[#F4F4F5] rounded-l-xl transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Minus className="h-3.5 w-3.5 text-[#18181B]" />
                          </button>
                          <span className="w-10 text-center text-sm font-semibold tabular-nums text-[#09090B]">
                            {quantity}
                          </span>
                          <button
                            onClick={() => setQuantity((q) => q + 1)}
                            className="h-10 w-10 flex items-center justify-center hover:bg-[#F4F4F5] rounded-r-xl transition-colors duration-150 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5 text-[#18181B]" />
                          </button>
                        </div>

                        {/* Add to bag */}
                        <motion.button
                          whileHover={{ scale: 1.02, boxShadow: "0 6px 24px hsl(var(--primary) / 0.35)" }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleAdd}
                          className="flex-1 h-10 rounded-xl text-sm font-semibold
                                     flex items-center justify-center gap-2
                                     text-primary-foreground bg-primary
                                     hover:bg-primary/90 transition-colors duration-150 cursor-pointer"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Add to Bag
                        </motion.button>
                      </div>
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
                    <button
                      disabled
                      className="w-full h-10 rounded-xl text-sm font-medium text-[#A1A1AA]
                                 border border-dashed border-[#E4E4E7] bg-white cursor-not-allowed
                                 flex items-center justify-center gap-2"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Login to Order
                    </button>
                  )}
                </>
              </div>
            </div>
          </>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
