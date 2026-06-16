import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ThesisPro — Your research, structured and sourced" },
      {
        name: "description",
        content:
          "Find your research topic, map your sources, and draft well-structured proposals and theses with citations verified against OpenAlex and Crossref. 200M+ peer-reviewed papers indexed.",
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
      desc: "We search 200M+ papers from OpenAlex and Crossref in real time, surfacing peer-reviewed sources for your topic.",
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

/* ─── Features ─── */
const features = [
  {
    title: "Topic Discovery",
    desc: "Enter your department, area of interest, and country. Find up to 50 candidate topics with novelty and feasibility scores to help you decide.",
  },
  {
    title: "Proposal Drafts",
    desc: "Chapter One and Chapter Three structured to your university's expectations, with a verified reference list you can trust.",
  },
  {
    title: "Full Thesis",
    desc: "Undergraduate, Master's, or PhD structure — 3,000-8,000 words per chapter with APA / Harvard / MLA citations verified against real sources.",
  },
  {
    title: "Research Library",
    desc: "Save topics permanently, resume any project, and track citations across every chapter you write.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="border-y border-[#E5E2D8] bg-white/40 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-[10px] uppercase tracking-[0.2em] text-verde font-bold mb-4">The workflow</div>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-5">
            From a single idea to a defended thesis.
          </h2>
          <p className="text-ink-secondary leading-[1.7]">
            ThesisPro structures the entire research lifecycle — discover original topics, shortlist
            with novelty and feasibility scores, then turn any chosen topic into a formatted proposal
            or complete thesis.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-8 bg-white border border-[#E5E2D8] rounded-lg hover:border-ink/20 transition-colors"
            >
              <h3 className="font-serif text-2xl text-ink mb-3">{f.title}</h3>
              <p className="text-sm text-ink-secondary leading-[1.7]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
    price: "₦3,000",
    features: [
      "Full research proposal draft",
      "Verified OpenAlex & Crossref citations",
      "APA 7th edition formatting",
      "Chapter 1 & Chapter 3 structure",
    ],
    cta: "Start your proposal",
    highlight: true,
  },
  {
    tier: "Full Thesis",
    price: "₦25,000",
    features: ["5-chapter thesis draft", "Undergraduate / Masters / PhD levels", "Verified citations throughout", "Download as DOCX or PDF"],
    cta: "Start your thesis",
    highlight: false,
  },
];

/* ─── Landing Page ─── */
function LandingPage() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      {/* ─── Header ─── */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-[#E5E2D8] bg-white/80">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="w-9 h-9 bg-ink rounded-lg flex items-center justify-center">
            <span className="w-4 h-0.5 bg-paper" />
          </span>
          <span className="font-serif italic text-xl font-bold tracking-tight text-ink">ThesisPro</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 text-sm text-ink-secondary">
          <a href="#methodology" className="hover:text-ink transition-colors">Methodology</a>
          <a href="#features" className="hover:text-ink transition-colors">Features</a>
          <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/auth" className="text-sm text-ink-secondary hover:text-ink transition-colors">
            Log in
          </Link>
          <Link
            to="/auth"
            className="px-5 py-2.5 bg-ink text-paper text-sm font-medium rounded-lg hover:opacity-90 transition-all"
          >
            Enter workspace
          </Link>
          <span className="text-[10px] uppercase tracking-wider text-verde font-semibold">Free plan available</span>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden p-2">
          <svg className="w-6 h-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {mobileNav ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="md:hidden border-b border-[#E5E2D8] bg-white px-6 py-4 space-y-4">
          <a href="#methodology" className="block text-sm text-ink-secondary hover:text-ink" onClick={() => setMobileNav(false)}>Methodology</a>
          <a href="#features" className="block text-sm text-ink-secondary hover:text-ink" onClick={() => setMobileNav(false)}>Features</a>
          <a href="#pricing" className="block text-sm text-ink-secondary hover:text-ink" onClick={() => setMobileNav(false)}>Pricing</a>
          <div className="pt-2 flex flex-col gap-3">
            <Link to="/auth" className="w-full py-2.5 text-center text-sm border border-[#E5E2D8] rounded-lg">Log in</Link>
            <Link to="/auth" className="w-full py-2.5 text-center text-sm bg-ink text-paper rounded-lg">Enter workspace</Link>
          </div>
        </div>
      )}

      {/* ─── Hero ─── */}
      <header className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-bg text-amber-text text-xs font-semibold mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verified against OpenAlex &amp; Crossref
        </div>

        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.05] text-balance text-ink mb-6">
          Your research,
          <br />
          <span className="italic">structured and sourced</span>.
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-ink-secondary leading-[1.7] mb-10">
          A writing partner that helps you build well-sourced academic work. Tap into{" "}
          <strong className="text-ink font-medium">200M+ peer-reviewed papers</strong> from
          OpenAlex and Crossref. Every citation carries a{" "}
          <strong className="text-ink font-medium">real DOI</strong> — never a hallucinated source.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth"
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

      {/* ─── Features ─── */}
      <FeaturesSection />

      {/* ─── Pricing ─── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
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
            <div className="font-serif italic text-2xl font-bold text-paper mb-6">ThesisPro</div>
            <p className="text-paper/50 text-sm leading-relaxed">
              A research writing partner for the next generation of scholars. Helping you structure,
              source, and refine your own academic work.
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
          <span>&copy; 2026 ThesisPro</span>
          <span>Secure &amp; Encrypted</span>
        </div>
      </footer>
    </div>
  );
}
