import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Landing page that Westpac redirects to after the customer completes (or
 * cancels) payment.  The returnUrl we send is:
 *   https://nakhrali.com.au/payment-complete
 *
 * Westpac appends query params to that URL — exact param names and values
 * depend on the OnlinePay API version.
 *
 * TODO: confirm exact query param names once Westpac credentials are available.
 *       Common patterns:
 *         ?status=approved  (or APPROVED, success, 00)
 *         ?result=approved
 *         ?paymentStatus=approved
 */

function isApproved(params: URLSearchParams): boolean {
  // Check several common param name / value patterns
  // TODO: narrow down to the exact params Westpac sends
  const status = (
    params.get("status") ??
    params.get("result") ??
    params.get("paymentStatus") ??
    params.get("responseCode") ??
    ""
  ).toLowerCase();

  return status === "approved" || status === "success" || status === "00";
}

export default function PaymentComplete() {
  const [params] = useSearchParams();
  const approved = isApproved(params);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ backgroundColor: "#0f0d09" }}
    >
      {/* Logo / brand mark */}
      <p
        className="mb-10 tracking-[0.2em] uppercase text-xs"
        style={{ color: "#c9a84c", fontFamily: "'Cormorant Garamond', serif" }}
      >
        Nakhrali
      </p>

      {approved ? (
        /* ── Payment approved ──────────────────────────────────────── */
        <div className="flex flex-col items-center text-center max-w-md gap-6">
          <div
            className="rounded-full p-4"
            style={{ backgroundColor: "rgba(201, 168, 76, 0.12)" }}
          >
            <CheckCircle2
              className="h-14 w-14"
              style={{ color: "#c9a84c" }}
              strokeWidth={1.5}
            />
          </div>

          <h1
            className="text-3xl font-light tracking-wide"
            style={{
              color: "#f5edd6",
              fontFamily: "'Cormorant Garamond', serif",
            }}
          >
            Payment Received
          </h1>

          <p className="text-base leading-relaxed" style={{ color: "#a89070" }}>
            Thank you — your payment has been received and your order is now
            being reviewed by our team. You will receive a confirmation email
            once your order is approved.
          </p>

          <Button asChild className="mt-2" style={{ backgroundColor: "#c9a84c", color: "#0f0d09" }}>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Store
            </Link>
          </Button>
        </div>
      ) : (
        /* ── Generic / pending state (no params or non-approved status) ── */
        <div className="flex flex-col items-center text-center max-w-md gap-6">
          <div
            className="rounded-full p-4"
            style={{ backgroundColor: "rgba(201, 168, 76, 0.08)" }}
          >
            <Clock
              className="h-14 w-14"
              style={{ color: "#c9a84c" }}
              strokeWidth={1.5}
            />
          </div>

          <h1
            className="text-3xl font-light tracking-wide"
            style={{
              color: "#f5edd6",
              fontFamily: "'Cormorant Garamond', serif",
            }}
          >
            Thank You
          </h1>

          <p className="text-base leading-relaxed" style={{ color: "#a89070" }}>
            Your payment is being processed. If you have completed the payment,
            you will receive a confirmation email shortly. If you have any
            questions please contact us.
          </p>

          <Button asChild variant="outline" className="mt-2 border-[#c9a84c]/40 text-[#c9a84c] hover:bg-[#c9a84c]/10">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Store
            </Link>
          </Button>
        </div>
      )}

      <p className="mt-16 text-xs" style={{ color: "#4a3f30" }}>
        Secure payment powered by Westpac OnlinePay
      </p>
    </div>
  );
}
