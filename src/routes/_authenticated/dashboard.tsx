import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment } from "@/lib/payment.functions";
import { getActivePlan } from "@/lib/side-hustle.functions";
import { getUserLimits, getRecentItems, getQuickStats } from "@/lib/dashboard.functions";
import {
  Sparkles, CheckCircle, Loader2, XCircle,
  FileText, BookOpen, Zap, Target,
  ArrowRight, Clock, Search,
  CreditCard, Gift, Settings, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useClerk } from "@clerk/clerk-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Mybrainpadi" }] }),
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
        window.history.replaceState({}, "", "/dashboard");
      })
      .catch((e) => {
        setStatus("failed");
        toast.error(String(e instanceof Error ? e.message : e));
      });
  }, []);

  if (!status) return null;

  const borderColor =
    status === "success"
      ? "border-green-200 bg-green-50"
      : status === "failed"
        ? "border-red-200 bg-red-50"
        : "border-ink/10 bg-ink/5";

  return (
    <div className={`mb-6 p-4 border rounded-sm flex items-center gap-3 text-sm ${borderColor}`}>
      {status === "verifying" && <Loader2 className="size-5 animate-spin text-ink/40" />}
      {status === "success" && <CheckCircle className="size-5 text-green-600" />}
      {status === "failed" && <XCircle className="size-5 text-red-500" />}
      <span>
        {status === "verifying" && "Verifying your payment\u2026"}
        {status === "success" && "Payment verified! Your credit is now active."}
        {status === "failed" && "Payment verification failed. Please contact support."}
      </span>
    </div>
  );
}

/* ─── Active Journey Card ─── */
function ActiveJourneyCard() {
  const activeFn = useServerFn(getActivePlan);
  const { data: plan } = useQuery({
    queryKey: ["side-hustle-active-plan"],
    queryFn: () => activeFn({}),
    refetchInterval: 30000,
  });

  if (!plan) return null;

  const milestones = typeof plan.milestones === "string" ? JSON.parse(plan.milestones) : plan.milestones;
  const totalSteps = milestones?.length ?? 7;
  const currentStep = plan.current_step ?? 0;
  const progressPct = Math.round((currentStep / totalSteps) * 100);

  return (
    <Link
      to="/tools/side-hustle/journey"
      className="mt-3 block p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-md hover:border-purple-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-purple-100 text-purple-700">
            <Target className="size-4" />
          </div>
          <div>
            <h3 className="font-serif text-sm group-hover:text-sage transition-colors">
              {plan.title}
            </h3>
            <p className="text-[10px] text-ink/40">Active journey</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-sm">
          {progressPct}%
        </span>
      </div>
      <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="text-[10px] text-ink/40 mt-1.5">
        {currentStep} of {totalSteps} phases &middot; Goal: First paying client
      </p>
    </Link>
  );
}

function DashboardPage() {
  const isMobile = useIsMobile();
  const { user, signOut: clerkSignOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStartY, setMenuStartY] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const limitsFn = useServerFn(getUserLimits);
  const recentFn = useServerFn(getRecentItems);
  const statsFn = useServerFn(getQuickStats);

  const { data: limits } = useQuery({
    queryKey: ["dashboard-limits"],
    queryFn: () => limitsFn(),
    staleTime: 30_000,
  });
  const { data: recentItems } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: () => recentFn(),
    staleTime: 30_000,
  });
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statsFn(),
    staleTime: 60_000,
  });

  const userInitial = user?.firstName?.charAt(0) ?? user?.emailAddresses?.[0]?.emailAddress?.charAt(0) ?? "?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMenuTouchStart(e: React.TouchEvent) {
    setMenuStartY(e.touches[0].clientY);
  }
  function handleMenuTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientY - menuStartY > 60) setMenuOpen(false);
  }

  function formatRelativeTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const totalThesisCredits = (limits?.thesis_available_ug ?? 0) + (limits?.thesis_available_masters ?? 0) + (limits?.thesis_available_phd ?? 0);

  return (
    <div className={`mx-auto pb-8 ${isMobile ? "px-0" : "max-w-4xl px-4 sm:px-6 py-8 md:py-12"}`}>
      <PaymentVerifier />

      {/* Mobile: Home header with avatar menu */}
      {isMobile && (
        <div className="px-4 py-3 flex items-center justify-between border-b border-ink/10 bg-white">
          <div>
            <h1 className="font-serif text-lg font-bold text-ink">MyBrainPadi</h1>
            <p className="text-[11px] text-muted-foreground">Education Ecosystem</p>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="size-9 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ backgroundColor: "#0B3527", color: "#4ADE80" }}
            >
              {userInitial.toUpperCase()}
            </button>

            {menuOpen && (
              <div
                onTouchStart={handleMenuTouchStart}
                onTouchEnd={handleMenuTouchEnd}
                className="absolute right-0 top-full mt-2 w-52 rounded-lg shadow-lg py-1 z-50 border"
                style={{ backgroundColor: "#0B3527", borderColor: "rgba(255,255,255,0.1)" }}
              >
                <Link
                  to="/billing"
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  <CreditCard className="size-4" style={{ color: "rgba(255,255,255,0.55)" }} />
                  Billing
                </Link>
                <Link
                  to="/referral"
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  <Gift className="size-4" style={{ color: "rgba(255,255,255,0.55)" }} />
                  Referral Program
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="size-4" style={{ color: "rgba(255,255,255,0.55)" }} />
                  Settings
                </Link>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => { setMenuOpen(false); clerkSignOut(); }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors w-full"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  <LogOut className="size-4" style={{ color: "rgba(255,255,255,0.55)" }} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Ask AI Card ─── */}
      <Link
        to="/chat"
        className={`group block cursor-pointer transition-all hover:shadow-md ${
          isMobile
            ? "mx-4 mt-4 p-5 rounded-2xl"
            : "mb-10 p-5 rounded-xl"
        }`}
        style={{ backgroundColor: "#0B3527" }}
      >
        <div className={`flex ${isMobile ? "flex-col items-center text-center gap-3" : "items-center gap-5"}`}>
          <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${isMobile ? "size-12" : "size-11"}`}
            style={{ backgroundColor: "rgba(74, 222, 128, 0.15)" }}>
            <Sparkles className={isMobile ? "size-6" : "size-5"} style={{ color: "#4ADE80" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white" style={{ fontSize: isMobile ? "15px" : "15px" }}>
              Ask AI anything about your coursework
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Get instant help with concepts, assignments, and exam prep
            </p>
          </div>
          {!isMobile && (
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              <span>Type your question...</span>
              <ArrowRight className="size-4" style={{ color: "#4ADE80" }} />
            </div>
          )}
          {isMobile && (
            <ArrowRight className="size-5" style={{ color: "#4ADE80" }} />
          )}
        </div>
      </Link>

      {/* ─── Hero (desktop only) ─── */}
      {!isMobile && (
        <div className="mb-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            Education Ecosystem
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Welcome back.</h1>
          <p className="text-ink/60 max-w-xl text-sm sm:text-base">
            Everything you need — from research topics to assignments, exam prep, presentations, and
            your professional CV.
          </p>
        </div>
      )}

      {/* ─── Dashboard Overview ─── */}
      <div className={`space-y-4 ${isMobile ? "px-4 mt-3" : ""}`}>

        {/* Credits Summary */}
        <div className="border border-ink/10 rounded-lg overflow-hidden bg-card">
          <div className="px-5 py-4 border-b border-ink/5">
            <h2 className="font-bold text-sm uppercase tracking-[0.12em]">Your Credits</h2>
            <p className="text-xs text-ink/40 mt-0.5">Remaining usage across all tools</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <CreditBadge label="Thesis" value={totalThesisCredits} color="bg-emerald-50 text-emerald-700" />
              <CreditBadge label="Proposal" value={limits?.proposal_remaining ?? 0} color="bg-teal-50 text-teal-700" />
              <CreditBadge label="Assignment" value={limits?.assignment_available ?? 0} color="bg-blue-50 text-blue-700" />
              <CreditBadge label="Exam Prep" value={limits?.exam_available ?? 0} color="bg-amber-50 text-amber-700" />
              <CreditBadge label="AI Chat" value={limits?.chat_available ?? 0} color="bg-purple-50 text-purple-700" />
            </div>
          </div>
        </div>

        {/* Recent Items */}
        <div className="border border-ink/10 rounded-lg overflow-hidden bg-card">
          <div className="px-5 py-4 border-b border-ink/5">
            <h2 className="font-bold text-sm uppercase tracking-[0.12em]">Continue Where You Left Off</h2>
            <p className="text-xs text-ink/40 mt-0.5">Your most recent activity</p>
          </div>
          <div className="p-5">
            {(!recentItems || recentItems.length === 0) ? (
              <p className="text-sm text-ink/40 text-center py-4">
                No recent activity yet. Start by creating a topic or drafting a proposal.
              </p>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item) => {
                  const TypeIcon = item.type === "topic" ? Search : item.type === "thesis" ? BookOpen : FileText;
                  return (
                    <Link
                      key={item.id}
                      to={item.route}
                      className="flex items-center gap-3 p-3 rounded-md hover:bg-ink/[0.03] transition-colors group"
                    >
                      <div className="p-1.5 rounded-md bg-ink/5 text-ink/50">
                        <TypeIcon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate group-hover:text-sage transition-colors">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-[10px] text-ink/40">{item.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-ink/30 flex items-center gap-1 flex-shrink-0">
                        <Clock className="size-3" />
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="border border-ink/10 rounded-lg overflow-hidden bg-card">
          <div className="px-5 py-4 border-b border-ink/5">
            <h2 className="font-bold text-sm uppercase tracking-[0.12em]">Quick Stats</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Total Projects" value={stats?.totalProjects ?? 0} />
              <StatCard label="Research" value={(stats?.topics ?? 0) + (stats?.proposals ?? 0) + (stats?.theses ?? 0)} />
              <StatCard label="Tools Used" value={stats?.toolsCount ?? 0} />
            </div>
          </div>
        </div>

        {/* Active Journey */}
        <ActiveJourneyCard />

      </div>
    </div>
  );
}

/* ─── Dashboard Sub-Components ─── */

function CreditBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`p-3 rounded-md text-center ${color}`}>
      <div className="text-2xl font-serif font-bold">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | React.ReactNode }) {
  return (
    <div className="p-4 bg-paper border border-ink/10 rounded-md text-center">
      {typeof value === "number" ? (
        <div className="text-2xl font-serif font-bold text-ink">{value}</div>
      ) : (
        value
      )}
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink/40 mt-1">{label}</div>
    </div>
  );
}
