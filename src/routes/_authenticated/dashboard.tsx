import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment } from "@/lib/payment.functions";
import {
  Sparkles,
  Bookmark,
  ArrowRight,
  CheckCircle,
  Loader2,
  XCircle,
  FileText,
  GraduationCap,
  Presentation,
  UserSquare2,
  BookOpen,
  Library,
  History,
  Settings,
} from "lucide-react";
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

function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <PaymentVerifier />

      {/* ─── Hero ─── */}
      <div className="mb-8 md:mb-12">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Education Ecosystem
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Welcome back.</h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          Everything you need — from research topics to assignments, exam prep, presentations, and
          your professional CV.
        </p>
      </div>

      {/* ─── Research Studio ─── */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="size-4 text-ink/40" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink/40">
            Research Studio
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureCard
            to="/topic-generator"
            icon={Sparkles}
            label="Discover Topics"
            desc="Up to seven original research topics, scored on novelty and feasibility."
            accent="text-verde"
          />
          <FeatureCard
            to="/my-topics"
            icon={Bookmark}
            label="My Topics"
            desc="Review and manage every topic in your research library."
            accent="text-sage"
          />
          <FeatureCard
            to="/quick-proposal"
            icon={FileText}
            label="Draft Proposal"
            desc="Turn a topic into a structured proposal with verified references."
            accent="text-verde"
          />
          <FeatureCard
            to="/new-thesis"
            icon={BookOpen}
            label="Draft Thesis"
            desc="Full 5-chapter thesis with verified APA 7 references."
            accent="text-verde"
          />
          <FeatureCard
            to="/proposals"
            icon={Library}
            label="My Proposals"
            desc="Browse, review, and continue your saved proposals."
            accent="text-sage"
          />
          <FeatureCard
            to="/theses"
            icon={Library}
            label="My Theses"
            desc="Browse, review, and continue your saved theses."
            accent="text-sage"
          />
        </div>
      </div>

      {/* ─── Student Tools ─── */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="size-4 text-ink/40" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink/40">
            Student Tools
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ToolCard
            to="/tools/assignment"
            icon={FileText}
            label="Assignment Assistant"
            desc="Upload a question and get a well-researched answer with verified sources."
            price="₦1,000"
            color="bg-blue-50 text-blue-700"
          />
          <ToolCard
            to="/tools/exam"
            icon={GraduationCap}
            label="Exam Preparation"
            desc="Generate practice questions from your notes — objectives, theory, or both."
            price="₦1,000"
            color="bg-emerald-50 text-emerald-700"
          />
          <ToolCard
            to="/tools/presentation"
            icon={Presentation}
            label="Presentation Assistant"
            desc="Create slides with speaker notes. Download as PDF, DOCX, or PPTX."
            price="₦3,000"
            color="bg-amber-50 text-amber-700"
          />
          <ToolCard
            to="/tools/cv"
            icon={UserSquare2}
            label="CV Maker"
            desc="Upload or fill in your details. Get a professionally formatted CV."
            price="₦3,000"
            color="bg-purple-50 text-purple-700"
          />
          <ToolCard
            to="/tools/history"
            icon={History}
            label="Tools History"
            desc="View your past assignments, exams, presentations, and CVs."
            price=""
            color="bg-gray-50 text-gray-700"
          />
        </div>
      </div>

      {/* ─── Account ─── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="size-4 text-ink/40" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink/40">
            Account
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AccountCard
            to="/billing"
            icon={Settings}
            label="Billing & Credits"
            desc="Manage your subscription and view your credit balance."
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function FeatureCard({
  to,
  icon: Icon,
  label,
  desc,
  accent,
}: {
  to: string;
  icon: any;
  label: string;
  desc: string;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="group p-5 bg-card border border-ink/10 rounded-sm hover:border-ink/30 transition-all"
    >
      <Icon className={`size-5 ${accent} mb-3`} />
      <h3 className="font-serif text-base mb-1 group-hover:text-sage transition-colors">{label}</h3>
      <p className="text-xs text-ink/60 leading-relaxed mb-3">{desc}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/40 group-hover:text-sage transition-colors">
        Open <ArrowRight className="size-3" />
      </span>
    </Link>
  );
}

function ToolCard({
  to,
  icon: Icon,
  label,
  desc,
  price,
  color,
}: {
  to: string;
  icon: any;
  label: string;
  desc: string;
  price: string;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="group p-5 bg-card border border-ink/10 rounded-sm hover:border-sage/40 transition-all hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-sm ${color}`}>
          <Icon className="size-4" />
        </div>
        {price && <span className="text-[10px] font-medium text-ink/40">{price}</span>}
      </div>
      <h3 className="font-serif text-base mb-1 group-hover:text-sage transition-colors">{label}</h3>
      <p className="text-xs text-ink/60 leading-relaxed">{desc}</p>
    </Link>
  );
}

function AccountCard({
  to,
  icon: Icon,
  label,
  desc,
}: {
  to: string;
  icon: any;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group p-5 bg-card border border-ink/10 rounded-sm hover:border-ink/30 transition-all flex items-start gap-4"
    >
      <div className="p-2 rounded-sm bg-gray-50 text-gray-600">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="font-serif text-base mb-0.5 group-hover:text-sage transition-colors">
          {label}
        </h3>
        <p className="text-xs text-ink/60">{desc}</p>
      </div>
    </Link>
  );
}
