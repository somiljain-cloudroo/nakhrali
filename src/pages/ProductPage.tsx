import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Gem, Loader2, Minus, Plus, ShoppingCart, Lock, AlertCircle, ChevronLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
  color_images?: { color: string; image_url: string }[];
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const formatAUD = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

export default function ProductPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeColor, setActiveColor] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!sku) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("sku", sku)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setProduct(data as Product);
        setQuantity(data.min_order_quantity || 1);

        window.fbq?.("track", "ViewContent", {
          content_ids: [data.sku],
          content_type: "product",
          content_name: data.name,
          content_category: (data as Product).category?.name,
          value: Number(data.price),
          currency: "AUD",
        });
      }
      setLoading(false);
    })();
  }, [sku]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <Gem className="h-12 w-12 mx-auto text-primary/40 mb-4" />
          <h1 className="text-2xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Piece not found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            We couldn't find the piece you're looking for.
          </p>
          <Link to="/" className="text-sm text-primary underline">
            Browse the collection
          </Link>
        </div>
      </div>
    );
  }

  const colorImages = Array.isArray(product.color_images)
    ? (product.color_images as { color: string; image_url: string }[]).filter((ci) => ci.image_url)
    : [];
  const displayImage = colorImages[activeColor]?.image_url ?? product.image_url;

  const minQty = product.min_order_quantity || 1;
  const isInStock = (product.stock_quantity ?? 0) > 0;
  const stockLow = isInStock && (product.stock_quantity ?? 0) <= 5;

  const handleAdd = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign In Required", description: "Please sign in to add pieces to your bag." });
      navigate("/");
      return;
    }
    window.fbq?.("track", "AddToCart", {
      content_ids: [product.sku],
      content_type: "product",
      content_name: product.name,
      value: Number(product.price) * quantity,
      currency: "AUD",
    });
    toast({ title: "Added to bag", description: `${quantity}× ${product.name}` });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 pt-24 pb-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-primary/70 hover:text-primary mb-8 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Collection
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 md:gap-12 rounded-2xl overflow-hidden border border-[#E4E4E7]/10">
          <div className="relative bg-[#18181B] min-h-[400px] md:min-h-[640px] overflow-hidden">
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
                  className="absolute inset-0 h-full w-full object-contain p-6"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Gem className="h-14 w-14 text-white/20" />
                </div>
              )}
            </AnimatePresence>

            <div className="absolute top-4 left-4 z-10">
              <span className="text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full font-medium bg-white/10 backdrop-blur-sm text-white/70 border border-white/10">
                {product.category?.name ?? "Jewellery"}
              </span>
            </div>

            {!isInStock && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                <span className="px-5 py-2 rounded-full text-sm font-semibold bg-red-600/90 text-white">
                  Sold Out
                </span>
              </div>
            )}

            {colorImages.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-12 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-2">
                  {colorImages[activeColor]?.color}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {colorImages.map((ci, idx) => (
                    <button
                      key={ci.color}
                      onClick={() => setActiveColor(idx)}
                      className={cn(
                        "flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all",
                        activeColor === idx
                          ? "border-white/90"
                          : "border-white/20 opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={ci.image_url} alt={ci.color} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col bg-[#FAFAFA] p-6 md:p-10">
            {product.sku && (
              <p className="text-[10px] font-mono text-[#71717A] tracking-[0.15em] mb-1.5">
                {product.sku}
              </p>
            )}
            <h1
              className="text-3xl md:text-4xl font-light leading-tight text-[#09090B] mb-6"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {product.name}
            </h1>

            <div className="h-px bg-[#E4E4E7] mb-6" />

            {product.description && (
              <p className="text-sm text-[#52525B] leading-relaxed mb-6">{product.description}</p>
            )}

            {stockLow && isInStock && (
              <div className="flex items-center gap-2 text-amber-600 text-xs font-medium mb-4">
                <AlertCircle className="h-3.5 w-3.5" />
                Only {product.stock_quantity} left
              </div>
            )}

            <div className="mt-auto pt-6 border-t border-[#E4E4E7] space-y-4">
              {isAuthenticated ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold leading-none text-primary">
                      {formatAUD(Number(product.price))}
                    </span>
                    <span className="text-sm text-[#71717A]">per {product.unit}</span>
                  </div>
                  {minQty > 1 && <p className="text-xs text-[#A1A1AA]">Min. order: {minQty}</p>}

                  {isInStock ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-xl border border-[#E4E4E7] bg-white">
                        <button
                          onClick={() => setQuantity((q) => Math.max(minQty, q - 1))}
                          disabled={quantity <= minQty}
                          className="h-10 w-10 flex items-center justify-center hover:bg-[#F4F4F5] rounded-l-xl disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5 text-[#18181B]" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold tabular-nums text-[#09090B]">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity((q) => q + 1)}
                          className="h-10 w-10 flex items-center justify-center hover:bg-[#F4F4F5] rounded-r-xl"
                        >
                          <Plus className="h-3.5 w-3.5 text-[#18181B]" />
                        </button>
                      </div>

                      <button
                        onClick={handleAdd}
                        className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-primary-foreground bg-primary hover:bg-primary/90"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add to Bag
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled
                      className="w-full h-10 rounded-xl text-sm font-medium text-[#A1A1AA] border border-[#E4E4E7] bg-white cursor-not-allowed"
                    >
                      Sold Out
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#71717A]">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="text-sm">Sign in to see pricing & order</span>
                  </div>
                  <Link
                    to="/"
                    className="w-full h-10 rounded-xl text-sm font-medium border border-dashed border-[#E4E4E7] bg-white flex items-center justify-center gap-2 text-[#71717A]"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Sign In to Order
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
