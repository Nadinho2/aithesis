import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment as verifyPaymentFn } from "@/lib/payment.functions";
import { toast } from "sonner";

/**
 * Hook for service pages to handle Paystack redirect callback.
 *
 * When Paystack redirects back to the page after payment, it appends
 * ?reference=REF&trxref=REF to the URL. This hook detects that and
 * auto-verifies the payment, then calls onPaid() to trigger generation.
 */
export function usePaymentCallback(onPaid: () => void) {
  const verifyPay = useServerFn(verifyPaymentFn);
  const [verified, setVerified] = useState(false);

  const verifyMut = useMutation({
    mutationFn: (ref: string) => verifyPay({ data: { reference: ref } }),
    onSuccess: () => {
      toast.success("Payment successful! Starting generation…");
      setVerified(true);
      onPaid();
      // Clean up URL params
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        window.history.replaceState({}, "", url.toString());
      }
    },
    onError: (e) => {
      toast.error("Payment verification failed. Please contact support.");
    },
  });

  useEffect(() => {
    if (typeof window === "undefined" || verified) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    if (ref) {
      verifyMut.mutate(ref);
    }
  }, []);

  return { isVerifying: verifyMut.isPending, verified };
}
