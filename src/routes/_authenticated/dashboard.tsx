import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment } from "@/lib/payment.functions";
import { Sparkles, Bookmark, ArrowRight, CheckCircle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ThesisPro" }] }),
  component: DashboardPage,
});

function PaymentVerifier() {
  const verifyPay = useServerFn(verifyPayment);
  const [status, setStatus] = useState<"verifying" | "success" | "failed" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    const paymentVerify = params.get("payment_verify");

    if (!reference || !paymentVerify) return;

    setStatus("verifying");

    verifyPay({ data: { reference } })
      .then(() => {
        setStatus("success");
        toast.success("Payment successful! You can now draft.");
        // Clean URL params
        window.history.replaceState({}, "", "/dashboard");
      })
      .catch((e) => {
        setStatus("failed");
        toast.error(String(e instanceof Error ? e.message : e));
      });
  }, []);

  if (!status) return null;

  const borderColor = status === "success" ? "border-green-200 bg-green-50" : status === "failed" ? "border-red-200 bg-red-50" : "border-ink/10 bg-ink/5";

  return (
    <div className={`mb-6 p-4 border rounded-sm flex items-center gap-3 text-sm ${borderColor}`}>
      {status === "verifying" && <Loader2 className="size-5 animate-spin text-ink/40" />}
      {status === "success" && <CheckCircle className="size-5 text-green-600" />}
      {status === "failed" && <XCircle className="size-5 text-red-500" />}
      <span>
        {status === "verifying" && "Verifying your payment…"}
        {status === "success" && "Payment verified! Your credit is now active."}
        {status === "failed" && "Payment verification failed. Please contact support."}
      </span>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <PaymentVerifier />
      <div className="mb-8 md:mb-12">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Research Studio
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Welcome back.</h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          Discover original research topics, then turn any saved topic into a structured proposal or full thesis.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <Link
          to="/topic-generator"
          className="group p-6 sm:p-10 bg-card border border-ink/10 rounded-sm hover:border-ink/30 transition-all"
        >
          <Sparkles className="size-6 text-verde mb-4 sm:mb-6" />
          <h3 className="font-serif text-xl sm:text-2xl mb-2">Discover Topics</h3>
          <p className="text-sm text-ink/60 mb-4 sm:mb-6">
            Up to seven original research topics, scored on novelty and feasibility.
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-ink group-hover:text-verde transition-colors">
            Open topic finder <ArrowRight className="size-4" />
          </span>
        </Link>

        <Link
          to="/my-topics"
          className="group p-6 sm:p-10 bg-card border border-ink/10 rounded-sm hover:border-ink/30 transition-all"
        >
          <Bookmark className="size-6 text-sage mb-4 sm:mb-6" />
          <h3 className="font-serif text-xl sm:text-2xl mb-2">My Topics</h3>
          <p className="text-sm text-ink/60 mb-4 sm:mb-6">
            Review and manage every topic in your research library.
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-ink group-hover:text-sage transition-colors">
            View library <ArrowRight className="size-4" />
          </span>
        </Link>
      </div>

      <div className="mt-10 md:mt-16 p-6 sm:p-8 bg-parchment/60 border border-ink/10 rounded-sm">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 mb-2">
          Coming next
        </div>
        <h3 className="font-serif text-lg sm:text-xl mb-2">
          Proposal &amp; Full Thesis Drafting
        </h3>
        <p className="text-sm text-ink/60">
          Once you've shortlisted topics, the proposal and full-thesis drafting tools with verified
          OpenAlex / Crossref citations will appear here.
        </p>
      </div>
    </div>
  );
}
