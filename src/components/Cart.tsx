import { X, Plus, Minus, ShoppingCart, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Cart = ({ items, onUpdateQuantity, onRemoveItem, onCheckout, trigger, open: openProp, onOpenChange }: CartProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const setIsOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v); };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>

      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0 bg-background border-l border-border/60 shadow-cart">
        {/* ── Header ── */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 shrink-0">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-base font-bold leading-none">Your Cart</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {items.length === 0
                    ? "Empty"
                    : `${items.reduce((s, i) => s + i.quantity, 0)} items`}
                </p>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* ── Body ── */}
        {items.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="h-20 w-20 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Browse the catalogue and add products to get started.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-5 cursor-pointer"
              onClick={() => setIsOpen(false)}
            >
              Browse Products
            </Button>
          </div>
        ) : (
          <>
            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group flex gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-border transition-colors duration-150"
                >
                  {/* Product colour swatch placeholder */}
                  <div className="h-12 w-12 rounded-lg gradient-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary/40" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider truncate">
                        {item.brand}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-card-foreground line-clamp-1 leading-snug">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${item.price.toFixed(2)} / {item.unit}
                    </p>

                    {/* Qty controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-semibold tabular-nums min-w-[1.5rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors duration-150 cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-sm font-bold text-foreground">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Footer / Totals ── */}
            <div className="px-5 py-4 border-t border-border/60 space-y-4 shrink-0 bg-muted/20">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST included in price</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full h-11 gradient-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 active:scale-[0.99] transition-all duration-150 cursor-pointer shadow-sm"
                onClick={() => {
                  onCheckout();
                  setIsOpen(false);
                }}
              >
                Proceed to Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-[11px] text-center text-muted-foreground">
                Orders are subject to approval by our team.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
