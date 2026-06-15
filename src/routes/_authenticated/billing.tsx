import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPaymentHistory } from "@/lib/payment.functions";
import { PRICING } from "@/lib/pricing";
import { CreditCard, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — ThesisPro AI" }] }),
  component: BillingPage,
});

function BillingPage() {
  const historyFn = useServerFn(getPaymentHistory);
  const { data: history, isLoading } = useQuery({
    queryKey: ["payment-history"],
    queryFn: () => historyFn(),
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8 md:mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Account
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Billing</h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          View pricing and your payment history.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        <PricingCard
          product="Proposal"
          price={`₦${PRICING.proposal.price.toLocaleString()}`}
          description="Generate a full research proposal with verified references"
        />
        <PricingCard
          product="Undergrad Thesis"
          price={`₦${PRICING.thesis.undergraduate.price.toLocaleString()}`}
          description="Complete undergraduate thesis (5 chapters, 6,000-15,000 words)"
        />
        <PricingCard
          product="Masters Thesis"
          price={`₦${PRICING.thesis.masters.price.toLocaleString()}`}
          description="Complete masters thesis (5 chapters, 6,000-15,000 words)"
        />
        <PricingCard
          product="PhD Thesis"
          price={`₦${PRICING.thesis.phd.price.toLocaleString()}`}
          description="Complete PhD thesis (5 chapters, 6,000-15,000 words)"
        />
      </div>

      {/* Payment history */}
      <h2 className="font-serif text-2xl mb-4">Payment History</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin h-6 w-6 text-ink/40" />
        </div>
      ) : !history || history.length === 0 ? (
        <div className="text-center py-12 border border-ink/10 rounded-sm">
          <CreditCard className="mx-auto h-8 w-8 text-ink/20 mb-3" />
          <p className="text-ink/40 text-sm">No payments yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left">
                <th className="pb-3 font-medium text-ink/60">Product</th>
                <th className="pb-3 font-medium text-ink/60">Amount</th>
                <th className="pb-3 font-medium text-ink/60">Status</th>
                <th className="pb-3 font-medium text-ink/60">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((tx: any) => (
                <tr key={tx.id} className="border-b border-ink/5">
                  <td className="py-3 capitalize">{tx.product}{tx.level ? ` (${tx.level})` : ""}</td>
                  <td className="py-3">₦{Number(tx.amount).toLocaleString()}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      tx.status === "completed" ? "text-green-600" :
                      tx.status === "failed" ? "text-red-500" :
                      "text-ink/40"
                    }`}>
                      {tx.status === "completed" ? <CheckCircle className="h-3 w-3" /> :
                       tx.status === "failed" ? <XCircle className="h-3 w-3" /> :
                       <Clock className="h-3 w-3" />}
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 text-ink/40">{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PricingCard({ product, price, description }: { product: string; price: string; description: string }) {
  return (
    <div className="border border-ink/10 rounded-sm p-5 bg-white">
      <h3 className="font-medium text-sm text-ink/60 mb-1">{product}</h3>
      <p className="font-serif text-3xl mb-2">{price}</p>
      <p className="text-xs text-ink/40">{description}</p>
    </div>
  );
}
