import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ProductCardDB } from "@/components/ProductCardDB";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Cart } from "@/components/Cart";
import { AuthModal } from "@/components/AuthModal";
import { CheckoutModal } from "@/components/CheckoutModal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ShoppingCart, Gem, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category?: Database["public"]["Tables"]["categories"]["Row"];
};

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
}

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const { toast } = useToast();
  const { user, profile, loading: authLoading, isAuthenticated } = useAuth();
  const {
    products,
    categories,
    loading: productsLoading,
    error: productsError,
    getProductsByCategory,
  } = useProducts();

  const filteredProducts = getProductsByCategory(selectedCategory);

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

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) { handleRemoveItem(id); return; }
    setCartItems((prev) => prev.map((item) => item.id === id ? { ...item, quantity } : item));
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Removed from bag" });
  };

  const handleCheckout = () => {
    if (!isAuthenticated) { setShowAuthModal(true); return; }
    if (cartItems.length === 0) {
      toast({ title: "Bag is empty", description: "Add some pieces first." });
      return;
    }
    setShowCheckoutModal(true);
  };

  const handleCheckoutSuccess = () => {
    setCartItems([]);
    toast({ title: "Order placed!", description: "Your order is pending approval." });
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  /* ── Loading ── */
  if (authLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-primary/8 border border-primary/20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Loading collection…
          </p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (productsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto bg-primary/6 border border-primary/18">
            <Gem className="h-7 w-7 text-primary/50" />
          </div>
          <h2 className="font-display text-xl font-light text-foreground">
            Could not load collection
          </h2>
          <p className="text-sm text-muted-foreground">{productsError}</p>
          <Button onClick={() => window.location.reload()} className="rounded-full px-6">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={cartCount}
        onCartClick={() => {}}
        onLoginClick={() => setShowAuthModal(true)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => toast({ title: "Welcome to Nakhrali", description: "You're now signed in." })}
      />

      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        cartItems={cartItems}
        onSuccess={handleCheckoutSuccess}
      />

      {/* ── Hero ── */}
      <HeroSection
        isAuthenticated={isAuthenticated}
        onBrowse={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })}
        onSignIn={() => setShowAuthModal(true)}
      />

      {/* ── Collection ── */}
      <section id="collection" className="py-16">
        <div className="container mx-auto px-4">

          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              {/* Ornament line */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px w-10" style={{ background: "linear-gradient(to right, rgba(184,150,12,0.6), transparent)" }} />
                <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(184,150,12,0.5)" }}>
                  The Complete Collection
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl font-light tracking-tight"
                style={{ fontFamily: "'Cormorant Garamond', serif", color: "#faf8f2" }}
              >
                Our Pieces
              </h2>
              <p className="text-sm font-light mt-1.5 max-w-md" style={{ color: "rgba(250,248,242,0.35)" }}>
                Each piece named for a Sanskrit word — handcrafted with heritage stones and gold-plated settings.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.14em] shrink-0" style={{ color: "rgba(184,150,12,0.35)" }}>
              {filteredProducts.length} {filteredProducts.length !== 1 ? "pieces" : "piece"}
            </p>
          </div>

          {/* Category filter */}
          <div className="mb-10">
            <CategoryFilter
              categories={categories.map((cat) => cat.name)}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>

          {/* Grid */}
          {filteredProducts.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
                >
                  <ProductCardDB product={product} onAddToCart={handleAddToCart} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(184,150,12,0.05)", border: "1px solid rgba(184,150,12,0.14)" }}
              >
                <Gem className="h-8 w-8" style={{ color: "rgba(184,150,12,0.35)" }} />
              </div>
              <h3 className="font-light text-xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: "rgba(250,248,242,0.7)" }}>
                No pieces found
              </h3>
              <p className="text-sm font-light max-w-xs" style={{ color: "rgba(250,248,242,0.3)" }}>
                {selectedCategory === "all"
                  ? "The collection is currently unavailable."
                  : `No pieces in the "${selectedCategory}" collection.`}
              </p>
              {selectedCategory !== "all" && (
                <button
                  className="mt-5 h-9 px-5 rounded-full text-xs uppercase tracking-[0.12em] font-light cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                  style={{ border: "1px solid rgba(184,150,12,0.2)", color: "rgba(184,150,12,0.6)", background: "rgba(184,150,12,0.04)" }}
                  onClick={() => setSelectedCategory("all")}
                >
                  View All Pieces
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Floating Bag FAB ── */}
      <Cart
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
        trigger={
          <div className="fixed bottom-6 right-6 z-40">
            <button
              className="relative h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 bg-primary shadow-glow hover:shadow-[0_0_28px_hsl(44_76%_38%_/_0.4)]"
            >
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold rounded-full px-1 shadow-sm"
                  className="bg-background text-foreground border-2 border-background"
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          </div>
        }
      />
    </div>
  );
};

export default Index;
