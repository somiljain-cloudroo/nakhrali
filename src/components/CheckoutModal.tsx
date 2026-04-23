import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Package, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { AccountSelector } from "./AccountSelector";
import { supabase } from "@/integrations/supabase/client";

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
}

interface ShippingService {
  code: string;
  name: string;
  price: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onSuccess: () => void;
}

export const CheckoutModal = ({ isOpen, onClose, cartItems, onSuccess }: CheckoutModalProps) => {
  const [notes, setNotes] = useState("");
  const [selectedContext, setSelectedContext] = useState("individual");

  const [postcode, setPostcode] = useState("");
  const [shippingServices, setShippingServices] = useState<ShippingService[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingService | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const { createOrder, loading } = useOrders();
  const { toast } = useToast();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = selectedShipping?.price ?? 0;
  const total = subtotal + shippingCost;

  const handleCalculateShipping = async () => {
    if (!/^\d{4}$/.test(postcode)) {
      setShippingError("Enter a valid 4-digit Australian postcode.");
      return;
    }
    setShippingError("");
    setShippingLoading(true);
    setShippingServices([]);
    setSelectedShipping(null);

    try {
      const { data, error } = await supabase.functions.invoke("calculate-shipping", {
        body: { to_postcode: postcode },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const services: ShippingService[] = data?.services ?? [];
      setShippingServices(services);
      if (services.length > 0) setSelectedShipping(services[0]);
    } catch (err) {
      setShippingError("Could not fetch shipping rates. Please try again.");
      console.error("Shipping calc error:", err);
    } finally {
      setShippingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast({ title: "Empty Cart", description: "Add items before checkout", variant: "destructive" });
      return;
    }

    const accountId = selectedContext === "individual" ? undefined : selectedContext;
    const result = await createOrder(cartItems, notes, accountId, {
      shippingPostcode: postcode || undefined,
      shippingMethod: selectedShipping?.name,
      shippingCost: shippingCost,
    });

    if (result.success && result.order) {
      toast({
        title: "Order Placed!",
        description: `Order ${result.order.order_number} is pending approval.`,
      });
      onSuccess();
      onClose();
      setNotes("");
      setSelectedContext("individual");
      setPostcode("");
      setShippingServices([]);
      setSelectedShipping(null);
    } else {
      toast({
        title: "Order Failed",
        description: result.error || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col bg-gradient-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Review Order &amp; Checkout
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-6 overflow-y-auto pr-2 flex-1">

            {/* Ordering Context */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Ordering Context</Label>
              <AccountSelector
                value={selectedContext}
                onValueChange={setSelectedContext}
                placeholder="Select how to place this order..."
                className="w-full"
              />
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-4">
              <h3 className="font-semibold">Order Summary</h3>
              <div className="max-h-48 overflow-y-auto space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border">
                    <div className="flex-1">
                      {item.brand && (
                        <Badge variant="outline" className="text-xs mb-1">{item.brand}</Badge>
                      )}
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        ${item.price.toFixed(2)} per {item.unit}
                        {item.sku && ` · SKU: ${item.sku}`}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium">Qty: {item.quantity}</p>
                      <p className="text-sm font-semibold text-primary">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Shipping Calculator */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Shipping
              </h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Delivery postcode (e.g. 2000)"
                    value={postcode}
                    onChange={(e) => {
                      setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4));
                      setShippingServices([]);
                      setSelectedShipping(null);
                      setShippingError("");
                    }}
                    maxLength={4}
                    pattern="\d{4}"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCalculateShipping}
                  disabled={shippingLoading || postcode.length !== 4}
                  className="shrink-0"
                >
                  {shippingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate"}
                </Button>
              </div>

              {shippingError && (
                <p className="text-sm text-destructive">{shippingError}</p>
              )}

              {shippingServices.length > 0 && (
                <div className="space-y-2">
                  {shippingServices.map((service) => (
                    <label
                      key={service.code}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedShipping?.code === service.code
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping"
                          checked={selectedShipping?.code === service.code}
                          onChange={() => setSelectedShipping(service)}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium">{service.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        ${service.price.toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {shippingServices.length === 0 && !shippingLoading && !shippingError && postcode.length < 4 && (
                <p className="text-xs text-muted-foreground">
                  Enter your postcode to see AusPost delivery options from Melbourne.
                </p>
              )}
            </div>

            <Separator />

            {/* Pricing Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {selectedShipping && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping ({selectedShipping.name})</span>
                  <span>${shippingCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>GST included in price</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total:</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            {/* Order Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special instructions for this order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || cartItems.length === 0}
              className="flex-1 bg-gradient-primary hover:bg-gradient-warm"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" />
              Place Order
            </Button>
          </div>
        </form>

        <div className="text-center text-sm text-muted-foreground pt-2 border-t">
          Your order will be reviewed by our team before processing.
        </div>
      </DialogContent>
    </Dialog>
  );
};
