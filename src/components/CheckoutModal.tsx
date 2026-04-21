import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { AccountSelector } from "./AccountSelector";

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
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
  const { createOrder, loading } = useOrders();
  const { toast } = useToast();

  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cartItems.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before checkout",
        variant: "destructive",
      });
      return;
    }

    const accountId = selectedContext === "individual" ? undefined : selectedContext;
    const result = await createOrder(cartItems, notes, accountId);
    
    if (result.success && result.order) {
      toast({
        title: "Order Placed Successfully!",
        description: `Order ${result.order.order_number} is pending approval from our sales team.`,
      });
      onSuccess();
      onClose();
      setNotes("");
      setSelectedContext("individual");
    } else {
      toast({
        title: "Order Failed",
        description: result.error || "An error occurred while placing your order",
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
            Review Order & Checkout
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-6 overflow-y-auto pr-2 flex-1">
            {/* Ordering Context */}
            <div className="space-y-2">
              <Label htmlFor="ordering-context" className="text-base font-medium">
                Ordering Context
              </Label>
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
              <div className="max-h-60 overflow-y-auto space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {item.brand && (
                          <Badge variant="outline" className="text-xs">
                            {item.brand}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        ${item.price.toFixed(2)} per {item.unit}
                        {item.sku && ` • SKU: ${item.sku}`}
                      </p>
                    </div>
                    <div className="text-right">
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

            {/* Pricing Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
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
                placeholder="Any special instructions or requirements for this order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Checkout Actions */}
          <div className="flex gap-3 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
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
          Your order will be reviewed by our sales team before processing.
        </div>
      </DialogContent>
    </Dialog>
  );
};