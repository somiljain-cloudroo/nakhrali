import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Truck, CheckCircle2, Copy, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
import { AccountSelector } from "./AccountSelector";
import { supabase } from "@/integrations/supabase/client";

const NAKHRALI_PAYID = "77 440 681 399";
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
  color: string;
}

interface ShippingService {
  code: string;
  name: string;
  price: number;
}

interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  total: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onSuccess: () => void;
}

export const CheckoutModal = ({ isOpen, onClose, cartItems, onSuccess }: CheckoutModalProps) => {
  // ── Step 1 form state ────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [selectedContext, setSelectedContext] = useState("individual");

  const [postcode, setPostcode] = useState("");
  const [shippingServices, setShippingServices] = useState<ShippingService[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingService | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  // ── Shipping & contact form state ───────────────────────────────────────
  const [shippingFullName, setShippingFullName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingSuburb, setShippingSuburb] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingEmail, setShippingEmail] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");

  // ── Step 2 PayID state ───────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  const { createOrder, loading } = useOrders();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = selectedShipping?.price ?? 0;
  const total = subtotal + shippingCost;

  const shippingDetailsComplete = Boolean(
    shippingFullName.trim() &&
    shippingAddress.trim() &&
    shippingSuburb.trim() &&
    shippingState &&
    postcode.length === 4 &&
    shippingEmail.trim() &&
    EMAIL_REGEX.test(shippingEmail.trim()) &&
    shippingPhone.trim()
  );

  // ── Prefill name/email from profile once per modal-open session ─────────
  // Only marks itself "done" once profile/user data has actually arrived, so
  // an async profile load right after opening still gets one legitimate
  // prefill — but once that happens (or the user edits/clears the field),
  // it won't be silently overwritten again for the rest of this open session.
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (isOpen && !hasPrefilledRef.current) {
      if (profile?.full_name || user?.email) {
        hasPrefilledRef.current = true;
      }
      setShippingFullName((prev) => prev || profile?.full_name || "");
      setShippingEmail((prev) => prev || user?.email || "");
    }
  }, [isOpen, profile, user]);

  // ── Reset all state when dialog closes ───────────────────────────────────
  const handleClose = () => {
    setStep(1);
    setPlacedOrder(null);
    setNotes("");
    setSelectedContext("individual");
    setPostcode("");
    setShippingServices([]);
    setSelectedShipping(null);
    setShippingError("");
    setShippingFullName("");
    setShippingAddress("");
    setShippingSuburb("");
    setShippingState("");
    setShippingEmail("");
    setShippingPhone("");
    hasPrefilledRef.current = false;
    onClose();
  };

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
      if (data?.error === "AUSPOST_API_KEY is not configured") {
        setShippingError("Shipping rates unavailable — AusPost API key not yet configured.");
        return;
      }
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

    if (!shippingDetailsComplete) {
      toast({
        title: "Shipping Details Required",
        description: "Please fill in your full name, address, suburb, state, postcode, email, and phone.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedShipping) {
      toast({ title: "Shipping Required", description: "Please enter your postcode and select a shipping option before placing your order.", variant: "destructive" });
      return;
    }

    const accountId = selectedContext === "individual" ? undefined : selectedContext;
    const result = await createOrder(cartItems, notes, accountId, {
      shippingPostcode: postcode || undefined,
      shippingMethod: selectedShipping?.name,
      shippingCost: shippingCost,
      shippingFullName,
      shippingAddress,
      shippingSuburb,
      shippingState,
      shippingEmail,
      shippingPhone,
    });

    if (!result.success || !result.order || !result.orderId) {
      console.error("[Checkout] createOrder failed:", result.error);
      toast({
        title: "Order Failed",
        description: result.error || "An error occurred",
        variant: "destructive",
      });
      return;
    }

    // Order created — show PayID payment instructions
    setPlacedOrder({ orderId: result.orderId, orderNumber: result.order.order_number, total });
    onSuccess(); // clear cart
    setStep(2);
  };

  const handleDone = async () => {
    if (placedOrder) {
      const { error: paymentUpdateError } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", placedOrder.orderId);

      if (paymentUpdateError) {
        console.error("Failed to mark order paid:", paymentUpdateError);
      }

      // Notify admin that customer has claimed payment
      supabase.functions.invoke("notify-admin-order", {
        body: {
          orderNumber: placedOrder.orderNumber,
          customerName: shippingFullName || null,
          customerEmail: shippingEmail || null,
          total: placedOrder.total,
          items: [],
          shippingMethod: null,
          paymentClaimed: true,
        },
      }).then(({ error: fnErr }) => {
        if (fnErr) console.error("payment-claimed notification failed:", fnErr);
      }).catch((e) => console.error("payment-claimed notification error:", e));
    }
    handleClose();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied`, description: text });
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col bg-gradient-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <Package className="h-5 w-5" />
                Review Order &amp; Checkout
              </>
            ) : (
              <>
                <Banknote className="h-5 w-5 text-primary" />
                Complete Payment via PayID
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Order form ─────────────────────────────────────── */}
        {step === 1 && (
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

              {/* Shipping & Contact */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Shipping &amp; Contact
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="shippingFullName">Full Name</Label>
                    <Input
                      id="shippingFullName"
                      placeholder="Recipient's full name"
                      value={shippingFullName}
                      onChange={(e) => setShippingFullName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="shippingAddress">Street Address</Label>
                    <Input
                      id="shippingAddress"
                      placeholder="Unit/Street address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingSuburb">Suburb</Label>
                    <Input
                      id="shippingSuburb"
                      placeholder="Suburb"
                      value={shippingSuburb}
                      onChange={(e) => setShippingSuburb(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingState">State</Label>
                    <Select value={shippingState} onValueChange={setShippingState}>
                      <SelectTrigger id="shippingState">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingEmail">Email</Label>
                    <Input
                      id="shippingEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={shippingEmail}
                      onChange={(e) => setShippingEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingPhone">Phone</Label>
                    <Input
                      id="shippingPhone"
                      type="tel"
                      placeholder="04xx xxx xxx"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="postcode" className="sr-only">Postcode</Label>
                    <Input
                      id="postcode"
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
                    Enter your postcode above to see AusPost delivery options from Melbourne.
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
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || cartItems.length === 0 || !selectedShipping || !shippingDetailsComplete}
                className="flex-1 bg-gradient-primary hover:bg-gradient-warm"
                title={
                  !shippingDetailsComplete
                    ? "Complete shipping & contact details first"
                    : !selectedShipping
                    ? "Calculate shipping first"
                    : undefined
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Place Order
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2 border-t">
              {!shippingDetailsComplete
                ? "Fill in your shipping & contact details above."
                : !selectedShipping
                ? "Enter your postcode above to calculate shipping before placing your order."
                : "Your order will be confirmed once payment is received."}
            </div>
          </form>
        )}

        {/* ── STEP 2: PayID payment instructions ────────────────────── */}
        {step === 2 && placedOrder && (
          <div className="flex flex-col gap-5 overflow-y-auto">

            {/* Success banner */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Order placed!</p>
                <p className="text-xs text-muted-foreground">
                  Order <span className="font-mono font-semibold">{placedOrder.orderNumber}</span> is saved. Complete payment below to confirm it.
                </p>
              </div>
            </div>

            {/* PayID instructions card */}
            <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Pay via PayID (Bank Transfer)</h3>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Open your banking app, choose <strong>Pay to PayID</strong>, and enter the details below. Use the exact reference so we can match your payment.
              </p>

              <div className="space-y-3">
                {/* Amount */}
                <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Amount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">${placedOrder.total.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">AUD</span>
                  </div>
                </div>

                {/* PayID */}
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-card">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">PayID (ABN)</p>
                    <p className="font-mono font-medium text-sm">{NAKHRALI_PAYID}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(NAKHRALI_PAYID, "PayID")}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                    title="Copy PayID"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Reference */}
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-card">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Reference (required)</p>
                    <p className="font-mono font-semibold text-sm">{placedOrder.orderNumber}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(placedOrder.orderNumber, "Reference")}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                    title="Copy reference"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Once we receive your payment we'll confirm the order and arrange dispatch. Questions? Contact us at <strong>admin@nakhrali.com.au</strong>
              </p>
            </div>

            <Button onClick={handleDone} className="w-full">
              Done — I've made the transfer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
