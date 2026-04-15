/**
 * ProductCardDB — Nakhrali jewellery card
 * 21st.dev ProductHighlightCard pattern:
 * framer-motion useMotionValue/useSpring/useTransform 3D tilt + mouse glow
 * Uses design system CSS vars — no inline gold overrides
 */
import { Plus, Minus, ShoppingCart, Lock, Gem, AlertCircle } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Database } from "@/integrations/supabase/types";
import {
  ProductCardImages,
  ProductColorsThumbs,
  useSetActiveProduct,
  type ProductImagesProps,
} from "@/components/ui/product-card";

interface ColorImage {
  color: string;
  image_url: string;
}

// CSS swatch values — mirrors ProductManagement
const COLOR_SWATCHES: Record<string, string> = {
  "Gold":            "#C9A84C",
  "Rose Gold":       "#B76E79",
  "Silver":          "#A8A9AD",
  "Antique Gold":    "#8B7536",
  "Oxidised Silver": "#6B6B6B",
  "White Gold":      "#E8E4DC",
  "Two-tone":        "linear-gradient(135deg, #C9A84C 50%, #A8A9AD 50%)",
  "Kundan":          "linear-gradient(135deg, #D4AF37 50%, #1B6CA8 50%)",
  "Meenakari":       "linear-gradient(135deg, #D4AF37 33%, #E74C3C 33% 66%, #27AE60 66%)",
  "Black":           "#1A1A1A",
};

type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: ColorImage[];
};

interface ProductCardDBProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  onProductClick?: (product: Product) => void;
}

export const ProductCardDB = ({ product, onAddToCart, onProductClick }: ProductCardDBProps) => {
  const { isAuthenticated } = useAuth();
  const minQty = product.min_order_quantity || 1;
  const [quantity, setQuantity] = useState(minQty);
  const cardRef = useRef<HTMLDivElement>(null);

  // Build ProductImagesProps[] from color_images (one image per colour)
  // If no colour images, fall back to the single image_url
  const rawColorImages: ColorImage[] = Array.isArray(product.color_images)
    ? (product.color_images as ColorImage[]).filter((ci) => ci.image_url)
    : [];

  const productImages: ProductImagesProps[] = rawColorImages.length > 0
    ? rawColorImages.map((ci) => ({
        id: `${product.id}-${ci.color}`,
        color: ci.color,
        // pass same URL twice so hover effect is a subtle re-render; swap for real hover shot when available
        images: [ci.image_url, ci.image_url],
      }))
    : product.image_url
      ? [{ id: product.id, color: "default", images: [product.image_url, product.image_url] }]
      : [];

  const cssSwatches = rawColorImages.map((ci) => COLOR_SWATCHES[ci.color] ?? "#ccc");
  const colorLabels  = rawColorImages.map((ci) => ci.color);

  // 21st.dev useSetActiveProduct hook drives colour + hover state
  const { activeColor, activeImage, handleColorChange, handleMouse } = useSetActiveProduct();

  /* ── 21st.dev ProductHighlightCard: useMotionValue + useSpring tilt ── */
  // Start at centre (175) so rotateX/rotateY both resolve to 0 at rest
  const mouseX = useMotionValue(175);
  const mouseY = useMotionValue(175);

  const handleMouseMove = ({ clientX, clientY, currentTarget }: React.MouseEvent) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  const rotateX = useTransform(mouseY, [0, 350], [10, -10]);
  const rotateY = useTransform(mouseX, [0, 350], [-10, 10]);
  const springConfig = { stiffness: 300, damping: 20 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  const glowX = useTransform(mouseX, [0, 350], [0, 100]);
  const glowY = useTransform(mouseY, [0, 350], [0, 100]);
  const glowOpacity = useTransform(mouseX, [0, 350], [0, 0.5]);

  const handleQuantityChange = (delta: number) => setQuantity((q) => Math.max(minQty, q + delta));
  const handleAddToCart = () => { onAddToCart(product, quantity); setQuantity(minQty); };

  const isInStock = product.stock_quantity > 0;
  const stockLow = product.stock_quantity > 0 && product.stock_quantity <= 5;

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mouseX.set(175); mouseY.set(175); }}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative flex flex-col rounded-2xl bg-card shadow-lg transition-shadow duration-300 hover:shadow-2xl border border-border/50",
        !isInStock && "opacity-70"
      )}
    >
      {/* ── Inner depth layer (21st.dev pattern) ── */}
      <div style={{ transform: "translateZ(20px)", transformStyle: "preserve-3d" }} className="absolute inset-3 rounded-xl bg-card-foreground/5 shadow-inner overflow-hidden pointer-events-none">
        {/* Diagonal grid texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        {/* Mouse-tracking glow */}
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-xl"
          style={{
            opacity: glowOpacity,
            background: `radial-gradient(80px at ${glowX}% ${glowY}%, hsl(var(--primary) / 0.25), transparent)`,
          }}
        />
      </div>

      {/* ── Image area (21st.dev ProductCardImages) — click opens detail modal ── */}
      <div
        className={cn("relative rounded-t-2xl overflow-hidden", onProductClick && "cursor-pointer")}
        onClick={() => onProductClick?.(product)}
      >
        {productImages.length > 0 ? (
          <ProductCardImages
            productImages={productImages}
            activeColor={activeColor}
            activeImage={activeImage}
            handleMouse={handleMouse}
            className="rounded-t-2xl"
          />
        ) : (
          <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-purple-500/20 flex flex-col items-center justify-center p-5 text-center">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 shadow-md">
              <Gem className="h-6 w-6 text-primary" />
            </div>
            {product.sku && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{product.sku}</p>}
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.name}</p>
          </div>
        )}

        {/* Category badge */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-background/90 backdrop-blur-sm border border-border/40">
            {product.category?.name || "Jewellery"}
          </Badge>
        </div>

        {/* Out of stock overlay */}
        {!isInStock && (
          <div className="absolute inset-0 bg-background/55 backdrop-blur-[2px] flex items-center justify-center z-10">
            <Badge variant="destructive" className="font-semibold px-3 py-1 rounded-full shadow-sm">Sold Out</Badge>
          </div>
        )}

        {/* Low stock badge */}
        {stockLow && isInStock && (
          <div className="absolute bottom-2.5 right-2.5 z-10">
            <div className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
              <AlertCircle className="h-2.5 w-2.5" />
              Only {product.stock_quantity} left
            </div>
          </div>
        )}
      </div>

      {/* ── Colour swatches (21st.dev ProductColorsThumbs) ── */}
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

      {/* ── Content ── */}
      <div className="flex flex-col flex-1 p-4 gap-3" style={{ transform: "translateZ(10px)" }}>
        <div className="flex-1">
          <p className="text-[10px] font-mono text-muted-foreground mb-0.5">{product.sku}</p>
          <h3 className="font-semibold text-sm text-card-foreground line-clamp-2 leading-snug">{product.name}</h3>
          {product.description && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {product.description.split('.')[0]}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="flex items-end justify-between">
          <div>
            {isAuthenticated ? (
              <>
                <p className="text-xl font-extrabold text-primary leading-none">${product.price.toFixed(2)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">per {product.unit}</p>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-3 w-3" />
                <p className="text-xs font-medium">Sign in for pricing</p>
              </div>
            )}
            {minQty > 1 && <p className="text-[10px] text-muted-foreground mt-0.5">Min. order: {minQty}</p>}
          </div>
          {!stockLow && isInStock && (
            <p className="text-[11px] text-muted-foreground">{product.stock_quantity} in stock</p>
          )}
        </div>

        {/* CTA */}
        {isAuthenticated && isInStock ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= minQty}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="h-3.5 w-3.5" />
              </motion.button>
              <span className="flex-1 text-center text-sm font-semibold tabular-nums">{quantity}</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleQuantityChange(1)}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              whileTap={{ scale: 0.97 }}
              onClick={handleAddToCart}
              className="w-full h-9 rounded-xl font-semibold text-sm text-primary-foreground cursor-pointer flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 transition-all duration-150"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add to Bag
            </motion.button>
          </div>
        ) : !isAuthenticated ? (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium border-dashed" disabled>
            <Lock className="h-3.5 w-3.5 mr-1.5" />Login to Order
          </Button>
        ) : (
          <Button variant="outline" className="w-full h-9 rounded-xl text-sm font-medium text-muted-foreground" disabled>
            Sold Out
          </Button>
        )}
      </div>
    </motion.div>
  );
};
