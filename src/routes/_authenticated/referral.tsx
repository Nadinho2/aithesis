import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Check, Share2, Wallet, TrendingUp, ArrowUpRight, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { getMyReferralCode, getMyWallet, getMyEarnings, getMyWithdrawals, getBanks, getMyReferralCount } from "@/lib/referral.functions";
import { getReferralLink } from "@/lib/referral";

export const Route = createFileRoute("/_authenticated/referral")({
  head: () => ({ meta: [{ title: "Referral Program — MyBrainPadi" }] }),
  component: ReferralPage,
});

function ReferralPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(5000);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const fnCode = useServerFn(getMyReferralCode);
  const fnWallet = useServerFn(getMyWallet);
  const fnEarnings = useServerFn(getMyEarnings);
  const fnWithdrawals = useServerFn(getMyWithdrawals);
  const fnBanks = useServerFn(getBanks);
  const fnReferralCount = useServerFn(getMyReferralCount);

  // Fetch referral code
  const { data: refCode, isLoading: codeLoading } = useQuery({
    queryKey: ["my-referral-code"],
    queryFn: () => fnCode(),
  });

  const refLink = refCode ? getReferralLink(refCode) : "";

  // Fetch wallet
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["my-wallet"],
    queryFn: () => fnWallet(),
    refetchInterval: 10000,
  });

  // Fetch earnings
  const { data: earnings = [], isLoading: earningsLoading } = useQuery({
    queryKey: ["my-earnings"],
    queryFn: () => fnEarnings(),
  });

  // Fetch withdrawals
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: () => fnWithdrawals(),
  });

  // Fetch banks
  const { data: banks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: () => fnBanks(),
    staleTime: 86400000,
  });

  // Fetch referral count
  const { data: referralCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["my-referral-count"],
    queryFn: () => fnReferralCount(),
  });

  const balance = wallet?.balance ?? 0;
  const totalEarned = wallet?.total_earned ?? 0;
  const totalWithdrawn = wallet?.total_withdrawn ?? 0;

  const copyToClipboard = () => {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareWhatsApp = () => {
    if (!refLink) return;
    const text = `Use%20my%20referral%20link%20to%20get%20started%20on%20MyBrainPadi%3A%20${encodeURIComponent(refLink)}`;
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/withdrawal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: withdrawAmount,
          bankCode: selectedBank,
          accountNumber,
          accountName,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: (data) => {
      toast.success(data.message ?? "Withdrawal initiated!");
      qc.invalidateQueries({ queryKey: ["my-wallet"] });
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      setWithdrawAmount(5000);
      setSelectedBank("");
      setAccountNumber("");
      setAccountName("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Withdrawal failed");
    },
  });

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      success: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold flex items-center gap-3">
          <Gift className="size-7 text-sage" />
          Referral Program
        </h1>
        <p className="text-ink/60 text-sm mt-1">
          Earn 20% lifetime commission on every payment made by users you refer
        </p>
      </div>

      {/* Referral Link Section */}
      <div className="bg-card border border-ink/10 rounded-sm p-6 space-y-4">
        <h2 className="font-serif text-lg font-medium">Your Referral Link</h2>
        {codeLoading ? (
          <p className="text-sm text-ink/50">Loading your referral link...</p>
        ) : refCode ? (
          <>
            <div className="flex items-center gap-2 bg-ink/5 rounded-sm px-4 py-3 border border-ink/10">
              <code className="flex-1 text-sm break-all">{refLink}</code>
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-ink/10 rounded-sm transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-ink text-bone rounded-sm text-sm hover:bg-sage transition-colors"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex items-center gap-2 px-4 py-2 border border-ink/20 rounded-sm text-sm hover:bg-ink/5 transition-colors"
              >
                <Share2 className="size-4" />
                Share via WhatsApp
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink/50">No referral code found. Contact support.</p>
        )}
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-ink/10 rounded-sm p-5">
          <div className="flex items-center gap-2 text-ink/50 text-sm mb-2">
            <Gift className="size-4" />
            People Referred
          </div>
          <p className="font-serif text-2xl font-semibold">
            {countLoading ? "..." : referralCount}
          </p>
        </div>
        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-ink/10 rounded-sm p-5">
            <div className="flex items-center gap-2 text-ink/50 text-sm mb-2">
              <Wallet className="size-4" />
              Available Balance
            </div>
            <p className="font-serif text-2xl font-semibold">
              {walletLoading ? "..." : `₦${balance.toLocaleString()}`}
            </p>
          </div>
          <div className="bg-card border border-ink/10 rounded-sm p-5">
            <div className="flex items-center gap-2 text-ink/50 text-sm mb-2">
              <TrendingUp className="size-4" />
              Total Earned
            </div>
            <p className="font-serif text-2xl font-semibold">
              {walletLoading ? "..." : `₦${totalEarned.toLocaleString()}`}
            </p>
          </div>
          <div className="bg-card border border-ink/10 rounded-sm p-5">
            <div className="flex items-center gap-2 text-ink/50 text-sm mb-2">
              <ArrowUpRight className="size-4" />
              Total Withdrawn
            </div>
            <p className="font-serif text-2xl font-semibold">
              {walletLoading ? "..." : `₦${totalWithdrawn.toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Earnings Table */}
      <div className="bg-card border border-ink/10 rounded-sm p-6">
        <h2 className="font-serif text-lg font-medium mb-4">Recent Earnings</h2>
        {earningsLoading ? (
          <p className="text-sm text-ink/50">Loading...</p>
        ) : earnings.length === 0 ? (
          <p className="text-sm text-ink/50">No earnings yet. Share your referral link to start earning!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink/50">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Tool</th>
                  <th className="pb-2 font-medium text-right">Amount Paid</th>
                  <th className="pb-2 font-medium text-right">Your Commission</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e: any) => (
                  <tr key={e.id} className="border-b border-ink/5">
                    <td className="py-2">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="py-2 capitalize">{e.tool}</td>
                    <td className="py-2 text-right">₦{e.payment_amount.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium text-green-600">₦{e.commission_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal Form */}
      <div className="bg-card border border-ink/10 rounded-sm p-6">
        <h2 className="font-serif text-lg font-medium mb-4">Withdraw Earnings</h2>

        {balance < 5000 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-800">
            You need <strong>₦5,000</strong> minimum to withdraw. Your current balance is <strong>₦{balance.toLocaleString()}</strong>.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedBank || !accountNumber || !accountName) {
                toast.error("Please fill in all fields");
                return;
              }
              withdrawalMutation.mutate();
            }}
            className="space-y-4 max-w-md"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Amount (₦)</label>
              <input
                type="number"
                min={5000}
                max={balance}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-ink/20 rounded-sm text-sm focus:outline-none focus:border-sage"
              />
              <p className="text-xs text-ink/50 mt-1">Min: ₦5,000 · Max: ₦{balance.toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bank</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full px-3 py-2 border border-ink/20 rounded-sm text-sm focus:outline-none focus:border-sage"
              >
                <option value="">Select bank</option>
                {banks.map((b: any) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Account Number</label>
              <input
                type="text"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="0123456789"
                className="w-full px-3 py-2 border border-ink/20 rounded-sm text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-ink/20 rounded-sm text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <button
              type="submit"
              disabled={withdrawalMutation.isPending || withdrawAmount < 5000 || withdrawAmount > balance}
              className="flex items-center gap-2 px-6 py-2 bg-ink text-bone rounded-sm text-sm hover:bg-sage transition-colors disabled:opacity-50"
            >
              {withdrawalMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
              {withdrawalMutation.isPending ? "Processing..." : `Withdraw ₦${withdrawAmount.toLocaleString()}`}
            </button>
          </form>
        )}
      </div>

      {/* Withdrawal History */}
      <div className="bg-card border border-ink/10 rounded-sm p-6">
        <h2 className="font-serif text-lg font-medium mb-4">Withdrawal History</h2>
        {withdrawalsLoading ? (
          <p className="text-sm text-ink/50">Loading...</p>
        ) : withdrawals.length === 0 ? (
          <p className="text-sm text-ink/50">No withdrawals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink/50">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Bank</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w: any) => (
                  <tr key={w.id} className="border-b border-ink/5">
                    <td className="py-2">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="py-2 font-medium">₦{w.amount.toLocaleString()}</td>
                    <td className="py-2 text-ink/50">{w.account_name ?? "—"}</td>
                    <td className="py-2">{statusBadge(w.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
