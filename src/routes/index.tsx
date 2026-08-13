import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Menu, X, BookOpen, FlaskConical, UserSquare2, Sparkles,
  ChevronDown, ArrowRight, Lock, FileText, Library,
  GraduationCap, Presentation, Zap, CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mybrainpadi — Your complete education ecosystem" },
      {
        name: "description",
        content:
          "Topics, proposals, theses, assignments, exam prep, presentations, and CVs — all in one platform powered by 200M+ verified scholarly sources.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.mybrainpadi.com" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Mybrainpadi",
          "url": "https://www.mybrainpadi.com",
          "description": "An all-in-one academic toolkit for students: research topics, proposals, theses, assignments, exam prep, presentations, and CVs backed by verified citations.",
          "applicationCategory": "EducationalApplication",
          "operatingSystem": "All",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "NGN",
          },
        }),
      },
    ],
  }),
  component: LandingPage,
});

/* ─── Stats Counter ─── */
function StatsBar() {
  const stats = [
    { number: "200M+", label: "Papers indexed" },
    { number: "100%", label: "Citations verified" },
    { number: "50+", label: "Universities represented" },
  ];
  return (
    <section className="border-y border-[#E5E2D8] bg-white/60">
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-3 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-serif text-4xl md:text-5xl text-ink mb-1">{s.number}</div>
            <div className="text-sm text-ink-secondary font-sans">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Thesis Mockup Card ─── */
function ThesisMockup() {
  return (
    <div className="max-w-3xl mx-auto mt-12 bg-white border border-[#E5E2D8] rounded-xl p-6 md:p-8 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        <h3 className="font-serif text-xl font-bold text-ink">Chapter 1: Introduction</h3>
        <span className="text-xs text-ink-secondary whitespace-nowrap ml-4 mt-1">Draft · 3,200 words</span>
      </div>
      {/* Body paragraph with citation chips */}
      <p className="font-serif text-[15px] text-ink leading-[1.8] mb-5">
        Despite significant advances in machine translation over the past decade, domain-specific
        terminology remains a persistent challenge for low-resource African languages. Recent
        evaluations of neural models indicate that performance drops by as much as 40% when moving
        from general-domain benchmarks to specialised legal or medical corpora{" "}
        <span className="inline-flex items-center rounded-full bg-verde-light text-verde-dark text-[11px] font-medium px-2.5 py-0.5 mx-0.5">
          (Adesina &amp; Okonkwo, 2024)
        </span>
        . This gap is particularly pronounced for languages such as Yoruba, Hausa, and Igbo, where
        parallel corpora remain scarce and inconsistently annotated. The present study addresses
        this limitation by constructing a curated bilingual corpus of 50,000 domain-labelled
        sentence pairs, annotated through a collaborative framework involving native-speaker
        linguists and domain experts{" "}
        <span className="inline-flex items-center rounded-full bg-verde-light text-verde-dark text-[11px] font-medium px-2.5 py-0.5 mx-0.5">
          (Ogunleye et al., 2023)
        </span>
        .
      </p>
      {/* Footer row */}
      <div className="flex items-center gap-5 text-xs pt-4 border-t border-[#E5E2D8]">
        <div className="flex items-center gap-1.5 text-verde font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          14 citations verified
        </div>
        <div className="flex items-center gap-1.5 text-ink-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          APA 7th edition
        </div>
      </div>
    </div>
  );
}

/* ─── Methodology Pipeline ─── */
function MethodologyPipeline() {
  const steps = [
    {
      step: "01",
      title: "Topic Input",
      desc: "Enter your department, area of interest, and country. Our engine parses your research context.",
    },
    {
      step: "02",
      title: "Search Databases",
      desc: "We search 200M+ papers from Google Scholar, OpenAlex and Crossref in real time, surfacing peer-reviewed sources for your topic.",
    },
    {
      step: "03",
      title: "Match & Verify DOI",
      desc: "Every candidate citation is cross-checked for DOI validity, author accuracy, and publication year.",
    },
    {
      step: "04",
      title: "Cite in Output",
      desc: "Only verified references appear in your thesis — each linked to a real, citable source.",
    },
  ];

  return (
    <section id="methodology" className="max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">How citation verification works</h2>
        <p className="text-ink-secondary max-w-xl mx-auto">
          Every source is traced from discovery to final citation — never a hallucinated reference.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative">
        {steps.map((s, i) => (
          <div key={s.step} className="relative">
            {/* Connector line (desktop) */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-8 left-[calc(50%+1.5rem)] w-[calc(100%-3rem)] h-px bg-[#E5E2D8]" />
            )}
            <div className="bg-white border border-[#E5E2D8] rounded-lg p-6 text-center relative z-10">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-verde-light text-verde-dark font-serif text-lg font-bold flex items-center justify-center">
                {s.step}
              </div>
              <h3 className="font-serif text-lg font-semibold text-ink mb-2">{s.title}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Dashboard-Style Section Block (auth-gated) ─── */
function LandingSectionBlock({
  icon: Icon,
  label,
  desc,
  gradient,
  defaultOpen = true,
  children,
}: {
  icon: any;
  label: string;
  desc: string;
  gradient: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-ink/10 rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          className={`size-5 text-ink/30 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-5 pb-5 pt-1">{children}</div>
      </div>
    </div>
  );
}

function LandingFeatureCard({
  icon: Icon, label, desc, accent, refSearch,
}: {
  icon: any; label: string; desc: string; accent: string; refSearch?: { ref: string };
}) {
  return (
    <Link to="/auth" search={refSearch}
      className="group p-4 bg-paper border border-ink/10 rounded-md hover:border-ink/30 transition-all flex items-start gap-3"
    >
      <Icon className={`size-5 ${accent} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-sm mb-0.5 group-hover:text-sage transition-colors">{label}</h3>
        <p className="text-[11px] text-ink/50 leading-relaxed">{desc}</p>
      </div>
      <Lock className="size-3.5 text-ink/15 shrink-0 mt-0.5" />
    </Link>
  );
}

function LandingPricedCard({
  icon: Icon, label, desc, price, color, refSearch,
}: {
  icon: any; label: string; desc: string; price: string; color: string; refSearch?: { ref: string };
}) {
  return (
    <Link to="/auth" search={refSearch}
      className="group p-4 bg-paper border border-ink/10 rounded-md hover:border-sage/40 transition-all hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className={`p-1.5 rounded-md ${color}`}>
          <Icon className="size-4" />
        </div>
        <div className="flex items-center gap-2">
          {price && <span className="text-[10px] font-medium text-ink/40">{price}</span>}
          <Lock className="size-3 text-ink/15" />
        </div>
      </div>
      <h3 className="font-serif text-sm mb-0.5 group-hover:text-sage transition-colors">{label}</h3>
      <p className="text-[11px] text-ink/50 leading-relaxed">{desc}</p>
    </Link>
  );
}

function AskAIPreview({ refSearch }: { refSearch?: { ref: string } }) {
  return (
    <Link to="/auth" search={refSearch}
      className="group block cursor-pointer transition-all hover:shadow-md mb-4 p-5 rounded-xl"
      style={{ backgroundColor: "#0B3527" }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="rounded-full flex items-center justify-center size-11 flex-shrink-0"
          style={{ backgroundColor: "rgba(74, 222, 128, 0.15)" }}>
          <Sparkles className="size-5" style={{ color: "#4ADE80" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-[15px]">Ask AI anything about your coursework</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Get instant help with concepts, assignments, and exam prep
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <span>Sign up to start chatting</span>
          <ArrowRight className="size-4" style={{ color: "#4ADE80" }} />
        </div>
      </div>
    </Link>
  );
}

/* ─── Pricing ─── */
const tiers = [
  {
    tier: "Topic Discovery",
    price: "Free",
    features: ["Unlimited topic discoveries", "Novelty & feasibility scores", "Save to your research library", "PDF & DOCX export"],
    cta: "Get Started",
    highlight: false,
  },
  {
      tier: "Proposal",
      price: "₦2,000",
      features: [
        "Full research proposal draft",
        "Verified Google Scholar, OpenAlex & Crossref citations",
        "APA 7th / Harvard citation style",
        "Chapter 1 & Chapter 3 structure",
      ],
      cta: "Start your proposal",
      highlight: true,
    },
    {
      tier: "Full Thesis",
      price: "From ₦20,000",
      features: [
        "Undergraduate ₦20,000 / Masters ₦40,000 / PhD ₦50,000",
        "5-chapter thesis draft",
        "Verified citations throughout",
        "Download as DOCX or PDF",
      ],
      cta: "Start your thesis",
      highlight: false,
    },
    {
      tier: "Assignment",
      price: "₦1,000",
      features: [
        "Upload question text or PDF/DOCX",
        "Answer with verified sources",
        "Toggle references on/off",
        "APA 7th or Harvard style",
      ],
      cta: "Get help",
      highlight: false,
    },
    {
      tier: "Exam Prep",
      price: "₦1,000",
      features: [
        "Upload notes, docs, and images",
        "Objectives, theory, or both question types",
        "Custom question count & split",
        "Multiple-choice with answer keys",
      ],
      cta: "Practice now",
      highlight: false,
    },
    {
      tier: "Presentation",
      price: "₦3,000",
      features: [
        "Upload content and images",
        "Speaker notes included",
        "Download PPTX or DOCX",
        "Custom slide count (5–30)",
      ],
      cta: "Create slides",
      highlight: false,
    },
    {
      tier: "CV Maker",
      price: "₦3,000",
      features: [
        "Upload existing CV to auto-fill",
        "Manual form entry available",
        "Add professional headshot",
        "Download formatted DOCX",
      ],
      cta: "Build your CV",
      highlight: false,
    },
  ];

/* ─── Landing Page ─── */
function LandingNav({ refSearch }: { refSearch?: { ref: string } }) {
  const [mobileNav, setMobileNav] = useState(false);
  const isMobile = useIsMobile();

  const navLinkClass = "text-sm font-medium transition-colors";
  const navLinkStyle = { color: "rgba(255,255,255,0.7)" };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-8 border-b border-white/10"
        style={{ backgroundColor: "#0B3527", height: isMobile ? 56 : 64 }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0">
          <span className="bg-white rounded-lg p-1.5 shadow-sm inline-flex">
            <img src="/logo.png" alt="Mybrainpadi" className="h-7 w-auto" />
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#methodology" className={navLinkClass} style={navLinkStyle}>Methodology</a>
          <a href="#features" className={navLinkClass} style={navLinkStyle}>Features</a>
          <a href="#pricing" className={navLinkClass} style={navLinkStyle}>Pricing</a>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/auth"
            search={refSearch}
            className="text-sm font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Log in
          </Link>
          <Link
            to="/auth"
            search={refSearch}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all"
            style={{ backgroundColor: "#4ADE80", color: "#0B3527" }}
          >
            Enter workspace
          </Link>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#4ADE80" }}>
            Free plan available
          </span>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileNav(!mobileNav)}
          className="md:hidden p-2"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          {mobileNav ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div
          className="md:hidden fixed top-[56px] left-0 right-0 z-40 px-6 py-5 space-y-4 border-b border-white/10"
          style={{ backgroundColor: "#0B3527" }}
        >
          <a
            href="#methodology"
            className="block text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.7)" }}
            onClick={() => setMobileNav(false)}
          >
            Methodology
          </a>
          <a
            href="#features"
            className="block text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.7)" }}
            onClick={() => setMobileNav(false)}
          >
            Features
          </a>
          <a
            href="#pricing"
            className="block text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.7)" }}
            onClick={() => setMobileNav(false)}
          >
            Pricing
          </a>
          <div className="pt-2 flex flex-col gap-3 border-t border-white/10">
            <Link
              to="/auth"
              search={refSearch}
              className="w-full py-2.5 text-center text-sm font-medium rounded-md border border-white/20"
              style={{ color: "rgba(255,255,255,0.8)" }}
              onClick={() => setMobileNav(false)}
            >
              Log in
            </Link>
            <Link
              to="/auth"
              search={refSearch}
              className="w-full py-2.5 text-center text-sm font-medium rounded-md"
              style={{ backgroundColor: "#4ADE80", color: "#0B3527" }}
              onClick={() => setMobileNav(false)}
            >
              Enter workspace
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function LandingPage() {
  const urlRef = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;
  const refSearch = urlRef ? { ref: urlRef } : undefined;

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <LandingNav refSearch={refSearch} />

      {/* ─── Hero ─── */}
      <header className="max-w-6xl mx-auto px-6 pt-[88px] md:pt-[104px] pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-bg text-amber-text text-xs font-semibold mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verified against Google Scholar, OpenAlex &amp; Crossref
        </div>

        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.05] text-balance text-ink mb-6">
          Your complete
          <br />
          <span className="italic">education ecosystem</span>.
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-ink-secondary leading-[1.7] mb-10">
          One platform for everything in your academic journey. Research topics, proposals, and
          full theses with verified citations. Assignments with scholarly sources. Exam prep with
          custom question papers. Presentations with speaker notes. A professional CV — all powered
          by <strong className="text-ink font-medium">200M+ peer-reviewed papers</strong> from
          Google Scholar, OpenAlex and Crossref. Every citation carries a{" "}
          <strong className="text-ink font-medium">real DOI</strong> — never a hallucinated source.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth"
            search={refSearch}
            className="w-full sm:w-auto px-10 py-4 bg-ink text-paper font-medium rounded-lg hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
          >
            Start your research
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <a
            href="#methodology"
            className="w-full sm:w-auto px-10 py-4 border border-[#E5E2D8] text-ink font-medium rounded-lg hover:bg-white transition-all"
          >
            How it works
          </a>
        </div>

        {/* ─── Thesis Mockup Card ─── */}
        <ThesisMockup />
      </header>

      {/* ─── Stats Bar ─── */}
      <StatsBar />

      {/* ─── Methodology Pipeline ─── */}
      <MethodologyPipeline />

      {/* ─── Dashboard-Style Sections ─── */}
      <section id="features" className="max-w-6xl mx-auto px-6 pt-16 pb-8 space-y-4">
        <div className="max-w-2xl mb-10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-verde font-bold mb-4">The ecosystem</div>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-5">
            Everything you need to excel, from first assignment to final defence.
          </h2>
          <p className="text-ink-secondary leading-[1.7]">
            Mybrainpadi is an all-in-one education ecosystem — discover research topics, draft
            proposals and theses, tackle assignments, prepare for exams, build presentations,
            and create a professional CV. All backed by verified citations.
          </p>
        </div>

        <AskAIPreview refSearch={refSearch} />

        <LandingSectionBlock icon={BookOpen} label="Research Studio" desc="Discover topics, draft proposals and theses" gradient="from-emerald-600 to-teal-600">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LandingFeatureCard icon={Sparkles} label="Topic Discovery" desc="Enter your department, area of interest, and country. Find up to 50 candidate topics with novelty and feasibility scores to help you decide." accent="text-emerald-600" refSearch={refSearch} />
            <LandingFeatureCard icon={FileText} label="Proposal Drafts" desc="Chapter One and Chapter Three structured to your university's expectations, with a verified reference list you can trust. APA 7th or Harvard citation style." accent="text-teal-600" refSearch={refSearch} />
            <LandingFeatureCard icon={BookOpen} label="Full Thesis" desc="Undergraduate, Master's, or PhD structure with APA 7th or Harvard citations verified against real sources." accent="text-emerald-600" refSearch={refSearch} />
            <LandingFeatureCard icon={Library} label="Research Library" desc="Save topics permanently, resume any project, and track citations across every chapter you write." accent="text-teal-600" refSearch={refSearch} />
          </div>
        </LandingSectionBlock>

        <LandingSectionBlock icon={FlaskConical} label="Student Tools" desc="Assignments, exam prep, presentations" gradient="from-blue-600 to-indigo-600">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LandingPricedCard icon={FileText} label="Assignment Assistant" desc="Upload your assignment question or a document. Get a well-structured answer with verified scholarly sources." price="₦1,000" color="bg-blue-100 text-blue-700" refSearch={refSearch} />
            <LandingPricedCard icon={GraduationCap} label="Exam Preparation" desc="Upload your notes, documents, and images. Generate practice questions — objectives, theory, or both." price="₦1,000" color="bg-emerald-100 text-emerald-700" refSearch={refSearch} />
            <LandingPricedCard icon={Presentation} label="Presentation Assistant" desc="Upload your content and images. Generate slides with speaker notes. Download as PPTX or DOCX." price="₦3,000" color="bg-amber-100 text-amber-700" refSearch={refSearch} />
          </div>
        </LandingSectionBlock>

        <LandingSectionBlock icon={UserSquare2} label="Career Tools" desc="Side hustles, presentations, and CV building" gradient="from-purple-600 to-pink-600">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LandingPricedCard icon={Zap} label="Side Hustle Finder" desc="Answer 5 questions and discover personalised side hustle ideas tailored to you." price="₦1,000" color="bg-yellow-100 text-yellow-700" refSearch={refSearch} />
            <LandingPricedCard icon={UserSquare2} label="CV Maker" desc="Upload your existing CV (PDF/DOCX) to auto-fill all fields, or use the manual form. Get a professionally formatted CV." price="₦3,000" color="bg-purple-100 text-purple-700" refSearch={refSearch} />
          </div>
        </LandingSectionBlock>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">Access the archive</h2>
          <p className="text-ink-secondary max-w-md mx-auto">
            Tools for individual researchers and global institutions alike.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((p) => (
            <div
              key={p.tier}
              className={`p-10 border border-[#E5E2D8] rounded-lg flex flex-col ${
                p.highlight ? "bg-white ring-1 ring-ink/5 shadow-sm" : "bg-white"
              }`}
            >
              <div
                className={`text-[10px] uppercase tracking-[0.2em] mb-2 font-bold ${
                  p.highlight ? "text-verde" : "text-ink-secondary"
                }`}
              >
                {p.tier}
              </div>
              <div className="text-4xl font-serif text-ink mb-6">
                {p.price}
                {p.price.startsWith("₦") && (
                  <span className="text-sm text-ink-secondary font-sans font-normal ml-1">one-time</span>
                )}
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-sm text-ink-secondary flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-verde shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                search={refSearch}
                className={`w-full py-2.5 text-center rounded-lg text-sm font-medium transition-colors ${
                  p.highlight
                    ? "bg-ink text-paper hover:opacity-90"
                    : "border border-[#E5E2D8] hover:bg-ink/5"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-ink text-paper py-20 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-sm">
            <span className="bg-white rounded-lg p-1.5 shadow-sm inline-flex mb-6">
              <img src="/logo.png" alt="Mybrainpadi" className="h-8 w-auto" />
            </span>
            <p className="text-paper/50 text-sm leading-relaxed">
              An all-in-one education ecosystem for the next generation of scholars. Research tools,
              study aids, and career resources — all backed by verified citations.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-paper/40 mb-6">
                Resources
              </h4>
              <ul className="space-y-4 text-sm text-paper/60">
                <li><Link to="/academic-integrity" className="hover:text-paper transition-colors">Academic Integrity</Link></li>
                <li><Link to="/privacy" className="hover:text-paper transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-paper transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-paper/40 mb-6">
                Connect
              </h4>
              <ul className="space-y-4 text-sm text-paper/60">
                <li>Research Partners</li>
                <li>Institutional Access</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-16 pt-8 border-t border-paper/10 text-[10px] uppercase tracking-widest text-paper/30 flex flex-col sm:flex-row justify-between gap-2">
          <span>&copy; 2026 Mybrainpadi</span>
          <span>Secure &amp; Encrypted</span>
        </div>
      </footer>
    </div>
  );
}
