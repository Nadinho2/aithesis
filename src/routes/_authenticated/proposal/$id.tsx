import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getProposal, exportProposalDocx } from "@/lib/proposals.functions";
import { ArrowLeft, Loader2, BookOpen, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  crossref: "Crossref",
  google_scholar: "Google Scholar",
  arxiv: "arXiv",
};

export const Route = createFileRoute("/_authenticated/proposal/$id")({
  head: () => ({ meta: [{ title: "Proposal — ThesisPro" }] }),
  component: ProposalPage,
});

function ProposalPage() {
  const { id } = useParams({ from: "/_authenticated/proposal/$id" });
  const fn = useServerFn(getProposal);
  const dlFn = useServerFn(exportProposalDocx);
  const navigate = useNavigate();
  const [dlBusy, setDlBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => fn({ data: { id } }),
  });

  const handleGenerateThesis = () => {
    if (!data) return;
    const s = data.sections as Record<string, any>;
    const objectives: string[] = Array.isArray(s.objectives) && s.objectives.length
      ? s.objectives
      : ["Investigate the central problem identified in the proposal."];
    const prefill = {
      title: data.title ?? "",
      problem_statement: (s.statement_of_the_problem as string) ?? (s.problem_statement as string) ?? "",
      research_gap: (s.gap_in_literature as string)?.slice(0, 800) ?? (s.literature_review as string)?.slice(0, 800) ?? "",
      objectives,
      department: data.department ?? "",
      area_of_interest: data.area_of_interest ?? "",
      country: data.country ?? "",
      research_type: data.research_type ?? "",
      level: (data.level as "undergraduate" | "masters" | "phd") ?? "undergraduate",
    };
    try {
      sessionStorage.setItem("thesis_prefill", JSON.stringify(prefill));
    } catch {
      /* ignore */
    }
    navigate({ to: "/new-thesis" });
  };

  const handleDownload = async () => {
    setDlBusy(true);
    try {
      const r = await dlFn({ data: { id } });
      const bin = atob(r.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: r.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-ink/50 p-10">
        <Loader2 className="size-4 animate-spin" /> Loading proposal…
      </div>
    );
  }
  if (error || !data) {
    return <div className="p-10 text-ink/60">Proposal not found.</div>;
  }

  const s = data.sections as Record<string, any>;
  const refs = (data.references_list as Array<{ apa: string; url: string | null; source: string }>) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <Link
        to="/my-topics"
        className="inline-flex items-center gap-1 text-xs text-ink/60 hover:text-ink mb-6"
      >
        <ArrowLeft className="size-3.5" /> Back to library
      </Link>

      <div className="mb-8 pb-6 border-b border-ink/10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            {data.level} Research Proposal · {data.word_count.toLocaleString()} words · APA 7
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight mb-3">
            {data.title}
          </h1>
          <div className="text-xs text-ink/50">
            {data.department} · {data.area_of_interest}
          </div>
          <div className="text-[11px] text-ink/40 mt-2">
            Generated{" "}
            {new Date(data.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            at{" "}
            {new Date(data.created_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateThesis}
            className="px-4 py-2 border border-sage text-sage rounded-sm text-sm font-medium hover:bg-sage hover:text-bone transition-colors flex items-center gap-2"
          >
            <Sparkles className="size-4" /> Draft Full Thesis
          </button>
          <button
            onClick={handleDownload}
            disabled={dlBusy}
            className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {dlBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download .docx
          </button>
        </div>
      </div>

      <Section title="Abstract" body={data.abstract ?? undefined} />
      <Section title="1.1 Background to the Study" body={s.background_to_the_study} />
      <Section title="1.2 Statement of Problem" body={s.statement_of_the_problem} />
      <ListSection title="1.3 Objective of the Study" items={s.objectives} ordered />
      <ListSection title="1.4 Research Questions" items={s.research_questions} ordered />
      <ListSection title="1.5 Research Hypothesis" items={s.research_hypotheses} ordered />
      <Section title="1.6 Significant of the Study" body={s.significance} />
      <Section title="1.7 Scope of the Study" body={s.scope_of_the_study} />
      <Section title="1.8 Definition of Terms" body={s.definition_of_terms} />
      <Section title="2.1 Conceptual Review" body={s.conceptual_review} />
      <Section title="2.2 Empirical Review" body={s.empirical_review} />
      <Section title="2.3 Theoretical Review" body={s.theoretical_review} />
      <Section title="2.4 Theoretical Framework" body={s.theoretical_framework} />
      <Section title="2.5 Summary of Reviews" body={s.summary_of_reviews} />
      <Section title="2.6 Gap in Literature" body={s.gap_in_literature} />
      <Section title="3.1 Research Design" body={s.research_design} />
      <Section title="3.2 Area of the Study" body={s.area_of_the_study} />
      <Section title="3.3 Population of the Study" body={s.population_of_the_study} />
      <Section title="3.4 Sample Size" body={s.sample_size} />
      <Section title="3.5 Sampling Techniques" body={s.sampling_technique} />
      <Section title="3.6 Instrument for Data Collection" body={s.instrumentation} />
      <Section title="3.7 Validity of Instrument" body={s.validity_of_instrument} />
      <Section title="3.8 Reliability of Instrument" body={s.reliability_of_instrument} />
      <Section title="3.9 Method of Administering Data" body={s.method_of_collecting_data} />
      <Section title="3.10 Method of Presentation and Data Analysis" body={s.method_of_data_analysis} />

      <div className="mt-12 pt-6 border-t border-ink/10">
        <h2 className="font-serif text-2xl mb-4 flex items-center gap-2">
          <BookOpen className="size-5 text-sage" /> References
        </h2>
        <p className="text-xs text-ink/50 mb-4">
          All citations were retrieved from OpenAlex, Crossref, Semantic Scholar, and arXiv. Every
          entry is real and verifiable via DOI or source URL.
        </p>
        <ol className="space-y-3 text-sm text-ink/80">
          {refs.map((r, i) => (
            <li key={i} className="leading-relaxed">
              <span className="font-mono text-[10px] text-ink/40 mr-2">[{i + 1}]</span>
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sage underline-offset-2 hover:underline"
                >
                  {r.apa}
                </a>
              ) : (
                r.apa
              )}
              <span className="ml-2 text-[10px] uppercase tracking-wider text-ink/40">
                {SOURCE_LABELS[r.source] ?? r.source}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <div className="text-[15px] leading-[1.8] text-ink/85 whitespace-pre-wrap">{body}</div>
    </section>
  );
}

function ListSection({
  title,
  items,
  ordered,
}: {
  title: string;
  items?: string[];
  ordered?: boolean;
}) {
  if (!items || items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <Tag
        className={`${ordered ? "list-decimal" : "list-disc"} list-inside space-y-2 text-[15px] text-ink/85 marker:text-sage`}
      >
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </Tag>
    </section>
  );
}
