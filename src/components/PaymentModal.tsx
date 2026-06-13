import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUser } from "@clerk/clerk-react";
import { initPayment, checkAccess } from "@/lib/payment.functions";
import { getPrice, getLabel, type ProductType, type ThesisLevel } from "@/lib/pricing";
import { toast } from "sonner";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  product: ProductType;
  level?: ThesisLevel;
  onPaid: () => void;
}

export function PaymentModal({ open, onClose, product, level, onPaid }: PaymentModalProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const initPaymentFn = useServerFn(initPayment);
  const checkAccessFn = useServerFn(checkAccess);

  if (!open) return null;

  const price = getPrice(product, level);
  const label = getLabel(product, level);
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const handlePay = async () => {
    if (!email) {
      toast.error("No email found on your account");
      return;
    }
    setLoading(true);
    try {
      const result = await initPaymentFn({ data: { product, level, email } });
      // Redirect to Paystack checkout
      window.location.href = result.authorization_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    // Check URL for reference param (from callback)
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    if (!ref) return;
    try {
      await checkAccessFn({ data: { product, level } });
      toast.success("Payment confirmed! You can now generate.");
      onPaid();
      onClose();
    } catch {
      // if checkAccess still fails, the user hasn't actually paid
    }
  };

  // Auto-verify on mount if reference is in URL
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "verify") {
      handleVerify();
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-sm shadow-lg max-w-sm w-full p-6">
        <h3 className="font-serif text-lg text-ink mb-2">Complete Payment</h3>
        <p className="text-sm text-ink/60 mb-4">
          You need a {label} credit to continue.
        </p>

        <div className="bg-ink/[0.02] border border-ink/10 rounded-sm p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-ink/70">{label}</span>
            <span className="text-lg font-semibold text-ink">
              ₦{price.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-ink/10 text-sm text-ink/60 rounded-sm hover:bg-ink/[0.02] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={loading || !email}
            className="flex-1 py-2.5 bg-ink text-bone text-sm font-medium rounded-sm hover:bg-sage transition-colors disabled:opacity-50"
          >
            {loading ? "Processing..." : `Pay ₦${price.toLocaleString()}`}
          </button>
        </div>

        <p className="text-xs text-ink/40 text-center mt-3">
          Secured by Paystack. You will be redirected to complete payment.
        </p>
      </div>
    </div>
  );
}
