import { useState } from "react";
import { Header } from "@/components/Header";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { Cart } from "@/components/Cart";
import { AuthModal } from "@/components/AuthModal";
import { ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const TestimonialsPage = () => {
  const [cartItems] = useState<never[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const cartCount = 0;

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={cartCount}
        onCartClick={() => setIsCartOpen(true)}
        onLoginClick={() => setShowAuthModal(true)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => toast({ title: "Welcome to Nakhrali", description: "You're now signed in." })}
      />

      <div className="pt-8">
        <TestimonialsSection />
      </div>

      {/* ── Footer ── */}
      <footer className="border-t py-8 mt-4" style={{ borderColor: "rgba(184,150,12,0.25)", background: "#0f0d09" }}>
        <div className="container mx-auto px-4 flex flex-col items-center gap-5">
          <div className="flex items-center gap-5">
            <a href="https://www.facebook.com/profile.php?id=61569099445411" target="_blank" rel="noopener noreferrer"
               aria-label="Nakhrali on Facebook"
               style={{ color: "rgba(184,150,12,0.6)" }}
               onMouseEnter={e => (e.currentTarget.style.color = "rgba(184,150,12,1)")}
               onMouseLeave={e => (e.currentTarget.style.color = "rgba(184,150,12,0.6)")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com/nakhrali_au/" target="_blank" rel="noopener noreferrer"
               aria-label="Nakhrali on Instagram"
               style={{ color: "rgba(184,150,12,0.6)" }}
               onMouseEnter={e => (e.currentTarget.style.color = "rgba(184,150,12,1)")}
               onMouseLeave={e => (e.currentTarget.style.color = "rgba(184,150,12,0.6)")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
            <a href="https://www.tiktok.com/@nakhrali_au" target="_blank" rel="noopener noreferrer"
               aria-label="Nakhrali on TikTok"
               style={{ color: "rgba(184,150,12,0.6)" }}
               onMouseEnter={e => (e.currentTarget.style.color = "rgba(184,150,12,1)")}
               onMouseLeave={e => (e.currentTarget.style.color = "rgba(184,150,12,0.6)")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
              </svg>
            </a>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(184,150,12,0.7)" }}>
              nakhrali.com.au &nbsp;·&nbsp; Melbourne, Australia
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(250,248,242,0.55)" }}>
              &copy; 2026 Nakhrali. All rights reserved.
            </p>
            <p className="text-[10px] tracking-[0.2em] uppercase" style={{ fontFamily: "'Cormorant Garamond', serif", color: "rgba(184,150,12,0.7)" }}>
              Bold · Elegant · You
            </p>
          </div>
        </div>
      </footer>

      <Cart
        items={cartItems}
        onUpdateQuantity={() => {}}
        onRemoveItem={() => {}}
        onCheckout={() => {}}
        open={isCartOpen}
        onOpenChange={setIsCartOpen}
        trigger={
          <div className="fixed bottom-6 right-6 z-40">
            <button className="relative h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 bg-primary shadow-glow">
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </button>
          </div>
        }
      />
    </div>
  );
};

export default TestimonialsPage;
