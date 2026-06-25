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
 * auto-verifies the payment silently. It does NOT trigger generation
 * because the form data was lost during the redirect page reload.
 * Instead, it shows a success toast and the user clicks Generate again
 * (which will now pass checkAccess since the payment is verified).
 */
export function usePaymentCallback() {
  const verifyPay = useServerFn(verifyPaymentFn);
  const [verified, setVerified] = useState(false);

  const verifyMut = useMutation({
    mutationFn: (ref: string) => verifyPay({ data: { reference: ref } }),
    onSuccess: () => {
      toast.success("Payment successful! Click Generate to start.");
      setVerified(true);
      // Clean up URL params
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        window.history.replaceState({}, "", url.toString());
      }
    },
    onError: () => {
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
