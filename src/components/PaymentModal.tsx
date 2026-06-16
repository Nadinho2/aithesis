import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { initPayment as initPaymentFn, verifyPayment as verifyPaymentFn } from "@/lib/payment.functions";
import { useUser } from "@clerk/clerk-react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getPrice } from "@/lib/pricing";
import type { ProductType, ThesisLevel } from "@/lib/pricing";

type Props = {
  open: boolean;
  onClose: () => void;
  product: ProductType;
  level?: ThesisLevel;
  onPaid: () => void;
};

export function PaymentModal({ open, onClose, product, level, onPaid }: Props) {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const price = getPrice(product, level);
  const [reference, setReference] = useState<string | null>(null);

  const initPay = useServerFn(initPaymentFn);
  const verifyPay = useServerFn(verifyPaymentFn);

  const initMut = useMutation({
    mutationFn: () => initPay({ data: { product, level, email } }),
    onSuccess: (res) => {
      setReference(res.reference);
      window.location.href = res.authorization_url;
    },
    onError: (e) => {
      toast.error(String(e instanceof Error ? e.message : e));
    },
  });

  const verifyMut = useMutation({
    mutationFn: (ref: string) => verifyPay({ data: { reference: ref } }),
    onSuccess: () => {
      toast.success("Payment successful!");
      onPaid();
    },
    onError: (e) => {
      toast.error(String(e instanceof Error ? e.message : e));
    },
  });

  // Handle Paystack redirect callback (?reference=xxx)
  const urlRef = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("reference")
    : null;
  if (urlRef && !reference) {
    setReference(urlRef);
    verifyMut.mutate(urlRef);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-sm mx-4 p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-ink/40 hover:text-ink">
          <X className="size-5" />
        </button>

        <h2 className="font-serif text-xl mb-1">Complete Payment</h2>
        <p className="text-sm text-ink/60 mb-6">
          {product === "proposal"
            ? "Unlock proposal drafting"
            : `Unlock ${level} thesis drafting`}
        </p>

        <div className="border border-ink/10 rounded-sm p-4 mb-6">
          <p className="text-xs text-ink/40 uppercase tracking-wider mb-1">Amount</p>
          <p className="font-serif text-3xl">₦{price.toLocaleString()}</p>
          <p className="text-xs text-ink/40 mt-1">
            {product === "proposal"
              ? "Research Proposal"
              : `${level?.charAt(0).toUpperCase()}${level?.slice(1)} Thesis`}
          </p>
        </div>

        {reference ? (
          <div className="text-center py-4">
            <Loader2 className="animate-spin mx-auto h-6 w-6 text-ink/40" />
            <p className="text-sm text-ink/60 mt-2">Verifying payment…</p>
          </div>
        ) : (
          <button
            onClick={() => initMut.mutate()}
            disabled={initMut.isPending}
            className="w-full py-3 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {initMut.isPending ? (
              <><Loader2 className="size-4 animate-spin" /> Redirecting…</>
            ) : (
              "Pay with Paystack"
            )}
          </button>
        )}

        <p className="text-xs text-ink/40 text-center mt-4">
          Secured by Paystack. You will be redirected to complete payment.
        </p>
      </div>
    </div>
  );
}
