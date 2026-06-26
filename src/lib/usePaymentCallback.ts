import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment as verifyPaymentFn } from "@/lib/payment.functions";
import { toast } from "sonner";

/**
 * Save form data to sessionStorage before Paystack redirect so it can be
 * restored when the user returns after payment.
 */
export function saveFormBeforePay(formData: Record<string, unknown>) {
  sessionStorage.setItem("pending_form_data", JSON.stringify(formData));
}

/**
 * Restore form data from sessionStorage after Paystack redirect.
 * Returns the saved data or null if nothing was saved.
 * Automatically clears the saved data after reading.
 */
export function restoreFormAfterPay<T extends Record<string, unknown>>(): T | null {
  try {
    const raw = sessionStorage.getItem("pending_form_data");
    if (!raw) return null;
    sessionStorage.removeItem("pending_form_data");
    return JSON.parse(raw) as T;
  } catch {
    sessionStorage.removeItem("pending_form_data");
    return null;
  }
}

/**
 * Hook for service pages to handle Paystack redirect callback.
 *
 * When Paystack redirects back to the page after payment, it appends
 * ?reference=REF&trxref=REF to the URL. This hook detects that and
 * auto-verifies the payment silently. It also restores form data that
 * was saved via saveFormBeforePay() before the redirect.
 *
 * After verification, the user clicks Generate again (which now passes
 * checkAccess since the payment transaction exists and is unused).
 */
export function usePaymentCallback() {
  const verifyPay = useServerFn(verifyPaymentFn);
  const [verified, setVerified] = useState(false);

  const verifyMut = useMutation({
    mutationFn: (ref: string) => verifyPay({ data: { reference: ref } }),
    onSuccess: () => {
      setVerified(true);

      // Redirect back to the service page the user came from
      const returnPath = sessionStorage.getItem("return_path");
      if (returnPath && returnPath !== window.location.pathname) {
        sessionStorage.removeItem("return_path");
        window.location.href = returnPath;
        return;
      }

      toast.success("Payment successful! Click Generate to start.");

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
