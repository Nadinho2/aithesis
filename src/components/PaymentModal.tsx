import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { initPayment as initPaymentFn, verifyPayment as verifyPaymentFn } from "@/lib/payment.functions";
import { useUser } from "@clerk/clerk-react";
import { Loader2, X, Globe, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getUsdPrice, type ProductType, type ThesisLevel, type CurrencyType } from "@/lib/pricing";

type Props = {
  open: boolean;
  onClose: () => void;
  product: ProductType;
  level?: ThesisLevel;
  price: number;
  onPaid: () => void;
  callbackPath?: string;
};

const toolLabels: Record<string, string> = {
  assignment: "Assignment Assistant",
  exam: "Exam Preparation",
  presentation: "Presentation Assistant",
  cv: "CV Maker",
};

export function PaymentModal({ open, onClose, product, level, price, onPaid, callbackPath }: Props) {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const [reference, setReference] = useState<string | null>(null);

  // Auto-detect currency: default to USD if user's timezone is outside Nigeria
  const [currency, setCurrency] = useState<CurrencyType>(() => {
    if (typeof window !== "undefined") {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        if (tz && !tz.includes("Lagos") && !tz.includes("Nigeria")) {
          return "USD";
        }
      } catch {
        return "NGN";
      }
    }
    return "NGN";
  });

  const initPay = useServerFn(initPaymentFn);
  const verifyPay = useServerFn(verifyPaymentFn);

  const usdPrice = getUsdPrice(product, level);
  const displayAmount = currency === "USD" ? `$${usdPrice.toFixed(2)}` : `₦${price.toLocaleString()}`;

  const initMut = useMutation({
    mutationFn: () => {
      const appUrl = typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.host}`
        : "https://mybrainpadi.com";
      const callbackUrl = callbackPath ? `${appUrl}${callbackPath}` : undefined;
      return initPay({ data: { product, level, email, currency, callbackUrl } });
    },
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

  // Handle Bachs redirect callback (?reference=xxx or ?checkout_id=xxx)
  const urlRef = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("reference") ||
      new URLSearchParams(window.location.search).get("checkout_id") ||
      new URLSearchParams(window.location.search).get("session_id") ||
      new URLSearchParams(window.location.search).get("id")
    : null;
  if (urlRef && !reference) {
    setReference(urlRef);
    verifyMut.mutate(urlRef);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-sm mx-4 p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-ink/40 hover:text-ink">
          <X className="size-5" />
        </button>

        <h2 className="font-serif text-xl mb-1">Complete Payment</h2>
        <p className="text-sm text-ink/60 mb-4">
          {product === "proposal"
            ? "Unlock proposal drafting"
            : product === "thesis"
              ? `Unlock ${level} thesis drafting`
              : "Unlock this tool"}
        </p>

        {/* Currency Switcher */}
        <div className="flex items-center p-1 bg-ink/5 rounded-sm mb-4">
          <button
            type="button"
            onClick={() => setCurrency("NGN")}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xs transition-all flex items-center justify-center gap-1.5 ${
              currency === "NGN"
                ? "bg-white text-ink shadow-xs"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            <span>🇳🇬</span>
            <span>Naira (NGN)</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xs transition-all flex items-center justify-center gap-1.5 ${
              currency === "USD"
                ? "bg-white text-ink shadow-xs"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            <span>🌐</span>
            <span>USD ($) / Global</span>
          </button>
        </div>

        <div className="border border-ink/10 rounded-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-ink/40 uppercase tracking-wider">Amount</p>
            <span className="text-[11px] font-medium text-sage flex items-center gap-1">
              {currency === "USD" ? (
                <>
                  <Globe className="size-3" /> Global Checkout
                </>
              ) : (
                <>
                  <CreditCard className="size-3" /> Local Checkout
                </>
              )}
            </span>
          </div>
          <p className="font-serif text-3xl">{displayAmount}</p>
          <p className="text-xs text-ink/40 mt-1">
            {product === "proposal"
              ? "Research Proposal"
              : product === "thesis"
                ? `${level?.charAt(0).toUpperCase()}${level?.slice(1)} Thesis`
                : toolLabels[product] ?? product}
          </p>
          <p className="text-[11px] text-ink/50 mt-2 border-t border-ink/5 pt-2">
            {currency === "USD"
              ? "Accepts International Cards, Apple Pay, Google Pay, and Crypto (USDT/USDC)."
              : "Accepts Nigerian Debit Cards, Bank Transfer, and USSD."}
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
              `Pay ${displayAmount} with Bachs`
            )}
          </button>
        )}

        <p className="text-xs text-ink/40 text-center mt-4">
          Secured by Bachs. You will be redirected to complete payment.
        </p>
      </div>
    </div>
  );
}
