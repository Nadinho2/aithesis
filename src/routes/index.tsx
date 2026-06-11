import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ThesisPro AI — Verified academic thesis writing" },
      {
        name: "description",
        content:
          "Generate university-grade research topics, proposals, and theses with citations verified against OpenAlex and Crossref.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-bone text-ink font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-ink/5">
        <Link to="/" className="flex items-center gap-2">
          <span className="size-8 bg-ink rounded-sm flex items-center justify-center">
            <span className="w-4 h-0.5 bg-bone" />
          </span>
          <span className="font-serif italic text-xl font-bold tracking-tight">ThesisPro</span>
        </Link>
        <div className="hidden md:flex items-center gap-10 text-sm font-medium uppercase tracking-widest text-ink/60">
          <a href="#methodology" className="hover:text-ink transition-colors">Methodology</a>
          <a href="#features" className="hover:text-ink transition-colors">Features</a>
          <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
        </div>
        <Link
          to="/auth"
          className="px-5 py-2.5 bg-ink text-bone text-sm font-medium rounded-full hover:bg-sage transition-colors"
        >
          Enter Workspace
        </Link>
      </nav>

      {/* Hero */}
      <header className="max-w-6xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-block px-4 py-1.5 border border-sage/40 rounded-full text-[10px] uppercase tracking-[0.2em] text-sage font-bold mb-8">
          Powered by OpenAlex &amp; Crossref
        </div>
        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-8 text-balance">
          Scholarly rigor <br />
          <span className="italic">reimagined</span> by AI.
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-ink/70 leading-relaxed mb-12">
          Generate university-grade theses with verified academic citations. ThesisPro connects to
          global research databases so every claim is backed by peer-reviewed evidence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth"
            className="w-full sm:w-auto px-10 py-4 bg-ink text-bone font-medium rounded-sm hover:-translate-y-0.5 transition-transform"
          >
            Start Your Research
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto px-10 py-4 border border-ink/10 font-medium rounded-sm hover:bg-parchment transition-colors"
          >
            How it works
          </a>
        </div>
      </header>

      {/* Methodology */}
      <section id="methodology" className="max-w-6xl mx-auto px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-12 border-t border-ink/10 pt-16">
          {[
            {
              n: "01",
              t: "Topic Synthesis",
              d: "Generate novel research gaps by analyzing 200M+ academic papers in real time. We find the silence in the literature.",
            },
            {
              n: "02",
              t: "Evidence Mapping",
              d: "Every sentence is anchored to a verified DOI. Never hallucinate a citation with our deep-link verification engine.",
            },
            {
              n: "03",
              t: "Ethical Scaffolding",
              d: "Built to academic standards. Draft, refine, and structure — the final intellectual work remains uniquely yours.",
            },
          ].map((f) => (
            <div key={f.n} className="space-y-4">
              <div className="size-10 rounded-full border border-sage flex items-center justify-center text-sage font-serif italic">
                {f.n}
              </div>
              <h3 className="font-serif text-2xl">{f.t}</h3>
              <p className="text-ink/60 text-sm leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-parchment/40 border-y border-ink/10 py-24">
        <div className="max-w-6xl mx-auto px-8">
          <div className="max-w-2xl mb-16">
            <div className="text-[10px] uppercase tracking-[0.2em] text-sage font-bold mb-4">
              The workflow
            </div>
            <h2 className="font-serif text-4xl md:text-5xl mb-6">
              From a single idea to a defended thesis.
            </h2>
            <p className="text-ink/70 leading-relaxed">
              ThesisPro structures the entire research lifecycle — generate fifty original topics,
              shortlist with novelty and feasibility scores, then turn any chosen topic into a
              formatted proposal or complete thesis.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                t: "Topic Generator",
                d: "Enter your department, area of interest, and country. Receive 50 candidate topics scored on novelty and feasibility.",
              },
              {
                t: "Proposal Drafts",
                d: "Chapter One and Chapter Three structured to your university's expectations, with a verified reference list.",
              },
              {
                t: "Full Thesis",
                d: "Undergraduate or Master's structure, 3,000–8,000 words per chapter, APA / Harvard / MLA / Chicago citations.",
              },
              {
                t: "Research Library",
                d: "Save topics permanently. Resume any project. Track citations across every chapter you produce.",
              },
            ].map((f) => (
              <div
                key={f.t}
                className="p-8 bg-bone border border-ink/10 rounded-sm hover:border-ink/30 transition-colors"
              >
                <h3 className="font-serif text-2xl mb-3">{f.t}</h3>
                <p className="text-sm text-ink/70 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl mb-4">Access the archive</h2>
          <p className="text-ink/60 max-w-md mx-auto">
            Tools for individual researchers and global institutions alike.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              tier: "Student Free",
              price: "$0",
              features: ["2 topic generations / mo", "1 proposal", "Verified citations", "PDF & DOCX export"],
              cta: "Get Started",
              highlight: false,
            },
            {
              tier: "Researcher Pro",
              price: "$19",
              features: [
                "Unlimited topic generations",
                "Unlimited proposals & theses",
                "Full thesis structure AI",
                "Priority research queue",
              ],
              cta: "Subscribe",
              highlight: true,
            },
            {
              tier: "Institution",
              price: "Custom",
              features: ["Multi-user access", "Department dashboard", "SSO & admin controls", "Dedicated support"],
              cta: "Contact Sales",
              highlight: false,
            },
          ].map((p) => (
            <div
              key={p.tier}
              className={`p-10 border rounded-sm flex flex-col ${
                p.highlight
                  ? "bg-parchment border-ink/20 ring-1 ring-ink/5"
                  : "bg-bone border-ink/10"
              }`}
            >
              <div
                className={`text-[10px] uppercase tracking-[0.2em] mb-2 font-bold ${
                  p.highlight ? "text-sage" : "text-ink/40"
                }`}
              >
                {p.tier}
              </div>
              <div className="text-4xl font-serif mb-6">
                {p.price}
                {p.price.startsWith("$") && (
                  <span className="text-sm text-ink/40 font-sans font-normal">/mo</span>
                )}
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-sm flex items-center gap-3">
                    <span className="size-1.5 bg-sage rounded-full shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`w-full py-2.5 text-center rounded-sm text-sm font-medium transition-colors ${
                  p.highlight
                    ? "bg-ink text-bone hover:bg-sage"
                    : "border border-ink/10 hover:bg-parchment"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-bone py-20 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-sm">
            <div className="font-serif italic text-2xl font-bold mb-6">ThesisPro AI</div>
            <p className="text-bone/50 text-sm leading-relaxed">
              Restoring academic excellence through responsible artificial intelligence. For the
              next generation of researchers.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-bone/40 mb-6">
                Resources
              </h4>
              <ul className="space-y-4 text-sm">
                <li>Academic Integrity</li>
                <li>Citation Ethics</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-bone/40 mb-6">
                Connect
              </h4>
              <ul className="space-y-4 text-sm">
                <li>Research Partners</li>
                <li>Institutional Access</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-16 pt-8 border-t border-bone/10 text-[10px] uppercase tracking-widest text-bone/30 flex justify-between">
          <span>© 2026 ThesisPro AI</span>
          <span>Secure &amp; Encrypted</span>
        </div>
      </footer>
    </div>
  );
}
