import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment } from "@/lib/payment.functions";
import { getActivePlan } from "@/lib/side-hustle.functions";
import {
  Sparkles, Bookmark, CheckCircle, Loader2, XCircle,
  FileText, GraduationCap, Presentation, UserSquare2, BookOpen,
  Library, History, Settings, ChevronDown, FlaskConical, Zap, Target,
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

type Section = "research" | "student" | "career" | "account";

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
  const [open, setOpen] = useState<Section>("research");

  const toggle = (s: Section) => setOpen(open === s ? open : s);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <PaymentVerifier />

      {/* ─── Hero ─── */}
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

      {/* ─── Sections ─── */}
      <div className="space-y-4">
        {/* ===== RESEARCH STUDIO ===== */}
        <SectionBlock
          id="research"
          isOpen={open === "research"}
          onToggle={() => toggle("research")}
          icon={BookOpen}
          label="Research Studio"
          desc="Discover topics, draft proposals and theses"
          gradient="from-emerald-600 to-teal-600"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <FeatureCard to="/topic-generator" icon={Sparkles} label="Discover Topics" desc="Up to seven original research topics, scored on novelty and feasibility." accent="text-emerald-600" />
            <FeatureCard to="/my-topics" icon={Bookmark} label="My Topics" desc="Review and manage every topic in your research library." accent="text-teal-600" />
            <FeatureCard to="/quick-proposal" icon={FileText} label="Draft Proposal" desc="Turn a topic into a structured proposal with verified references." accent="text-emerald-600" />
            <FeatureCard to="/new-thesis" icon={BookOpen} label="Draft Thesis" desc="Full 5-chapter thesis with verified APA 7 references." accent="text-emerald-600" />
            <FeatureCard to="/proposals" icon={Library} label="My Proposals" desc="Browse, review, and continue your saved proposals." accent="text-teal-600" />
            <FeatureCard to="/theses" icon={Library} label="My Theses" desc="Browse, review, and continue your saved theses." accent="text-teal-600" />
          </div>
        </SectionBlock>

        {/* ===== STUDENT TOOLS ===== */}
        <SectionBlock
          id="student"
          isOpen={open === "student"}
          onToggle={() => toggle("student")}
          icon={FlaskConical}
          label="Student Tools"
          desc="Assignments, exam prep, presentations"
          gradient="from-blue-600 to-indigo-600"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <PricedCard to="/tools/assignment" icon={FileText} label="Assignment Assistant" desc="Upload a question and get a well-researched answer with verified sources." price="₦1,000" color="bg-blue-100 text-blue-700" />
            <PricedCard to="/tools/exam" icon={GraduationCap} label="Exam Preparation" desc="Generate practice questions from your notes — objectives, theory, or both." price="₦1,000" color="bg-emerald-100 text-emerald-700" />
            <PricedCard to="/tools/presentation" icon={Presentation} label="Presentation Assistant" desc="Create slides with speaker notes. Download as PDF, DOCX, or PPTX." price="₦3,000" color="bg-amber-100 text-amber-700" />
            <PricedCard to="/tools/history" icon={History} label="Tools History" desc="View your past assignments, exams, presentations, and CVs." price="" color="bg-gray-100 text-gray-700" />
          </div>
        </SectionBlock>

        {/* ===== CAREER TOOLS ===== */}
        <SectionBlock
          id="career"
          isOpen={open === "career"}
          onToggle={() => toggle("career")}
          icon={UserSquare2}
          label="Career Tools"
          desc="Side hustles, presentations, and CV building"
          gradient="from-purple-600 to-pink-600"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <PricedCard to="/tools/side-hustle" icon={Zap} label="Side Hustle Finder" desc="Answer 5 questions and discover personalised side hustle ideas tailored to you." price="₦1,000" color="bg-yellow-100 text-yellow-700" />
            <PricedCard to="/tools/presentation" icon={Presentation} label="Presentation Assistant" desc="Create professional slide decks with speaker notes for your career talks." price="₦3,000" color="bg-amber-100 text-amber-700" />
            <PricedCard to="/tools/cv" icon={UserSquare2} label="CV Maker" desc="Upload or fill in your details. Get a professionally formatted CV." price="₦3,000" color="bg-purple-100 text-purple-700" />
          </div>
          <ActiveJourneyCard />
        </SectionBlock>

        {/* ===== ACCOUNT ===== */}
        <SectionBlock
          id="account"
          isOpen={open === "account"}
          onToggle={() => toggle("account")}
          icon={Settings}
          label="Account"
          desc="Billing, credits, and settings"
          gradient="from-gray-600 to-slate-600"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AccountCard to="/billing" icon={Settings} label="Billing & Credits" desc="Manage your subscription and view your credit balance." />
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}

/* ─── Accordion Section ─── */

function SectionBlock({
  id,
  isOpen,
  onToggle,
  icon: Icon,
  label,
  desc,
  gradient,
  children,
}: {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: any;
  label: string;
  desc: string;
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-ink/10 rounded-lg overflow-hidden bg-card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-ink/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-sm`}>
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm uppercase tracking-[0.12em]">{label}</h2>
            <p className="text-xs text-ink/40 mt-0.5">{desc}</p>
          </div>
        </div>
        <ChevronDown
          className={`size-5 text-ink/30 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 pt-1">{children}</div>
      </div>
    </div>
  );
}

/* ─── Card Components ─── */

function FeatureCard({ to, icon: Icon, label, desc, accent }: { to: string; icon: any; label: string; desc: string; accent: string }) {
  return (
    <Link to={to} className="group p-4 bg-paper border border-ink/10 rounded-md hover:border-ink/30 transition-all">
      <Icon className={`size-5 ${accent} mb-2.5`} />
      <h3 className="font-serif text-sm mb-0.5 group-hover:text-sage transition-colors">{label}</h3>
      <p className="text-[11px] text-ink/50 leading-relaxed">{desc}</p>
    </Link>
  );
}

function PricedCard({ to, icon: Icon, label, desc, price, color }: { to: string; icon: any; label: string; desc: string; price: string; color: string }) {
  return (
    <Link to={to} className="group p-4 bg-paper border border-ink/10 rounded-md hover:border-sage/40 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between mb-2.5">
        <div className={`p-1.5 rounded-md ${color}`}>
          <Icon className="size-4" />
        </div>
        {price && <span className="text-[10px] font-medium text-ink/40">{price}</span>}
      </div>
      <h3 className="font-serif text-sm mb-0.5 group-hover:text-sage transition-colors">{label}</h3>
      <p className="text-[11px] text-ink/50 leading-relaxed">{desc}</p>
    </Link>
  );
}

function AccountCard({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) {
  return (
    <Link to={to} className="group p-4 bg-paper border border-ink/10 rounded-md hover:border-ink/30 transition-all flex items-start gap-3.5">
      <div className="p-1.5 rounded-md bg-gray-100 text-gray-600">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="font-serif text-sm mb-0.5 group-hover:text-sage transition-colors">{label}</h3>
        <p className="text-[11px] text-ink/50">{desc}</p>
      </div>
    </Link>
  );
}
