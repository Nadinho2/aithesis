import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Bookmark, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ThesisPro AI" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8 md:mb-12">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Research Studio
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Welcome back.</h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          Begin by generating original research topics, then turn any saved topic into a structured
          proposal or full thesis.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <Link
          to="/topic-generator"
          className="group p-6 sm:p-10 bg-card border border-ink/10 rounded-sm hover:border-ink/30 transition-all"
        >
          <Sparkles className="size-6 text-sage mb-4 sm:mb-6" />
          <h3 className="font-serif text-xl sm:text-2xl mb-2">Generate Topics</h3>
          <p className="text-sm text-ink/60 mb-4 sm:mb-6">
            Up to seven original research topics, scored on novelty and feasibility.
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-ink group-hover:text-sage transition-colors">
            Open generator <ArrowRight className="size-4" />
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
          Proposal &amp; Full Thesis Generation
        </h3>
        <p className="text-sm text-ink/60">
          Once you've shortlisted topics, the proposal and full-thesis generators with verified
          OpenAlex / Crossref citations will appear here.
        </p>
      </div>
    </div>
  );
}
