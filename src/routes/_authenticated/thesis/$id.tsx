import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getThesis, exportThesisDocx } from "@/lib/theses.functions";
import { ArrowLeft, Loader2, BookOpen, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/thesis/$id")({
  head: () => ({ meta: [{ title: "Thesis — ThesisPro AI" }] }),
  component: ThesisPage,
});

function ThesisPage() {
  const { id } = useParams({ from: "/_authenticated/thesis/$id" });
  const fn = useServerFn(getThesis);
  const dlFn = useServerFn(exportThesisDocx);
  const [dlBusy, setDlBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["thesis", id],
    queryFn: () => fn({ data: { id } }),
  });

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
        <Loader2 className="size-4 animate-spin" /> Loading thesis…
      </div>
    );
  }
  if (error || !data) return <div className="p-10 text-ink/60">Thesis not found.</div>;

  const c = data.chapters as Record<string, string>;
  const refs = (data.references_list as Array<{ apa: string; url: string | null; source: string }>) ?? [];

  const chapters: Array<[string, string]> = [
    ["Chapter 1 — Introduction", "chapter_1_introduction"],
    ["Chapter 2 — Literature Review", "chapter_2_literature_review"],
    ["Chapter 3 — Methodology", "chapter_3_methodology"],
    ["Chapter 4 — Results and Findings", "chapter_4_results_findings"],
    ["Chapter 5 — Discussion, Conclusion and Recommendations", "chapter_5_discussion_conclusion"],
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <Link to="/theses" className="inline-flex items-center gap-1 text-xs text-ink/60 hover:text-ink mb-6">
        <ArrowLeft className="size-3.5" /> Back to theses
      </Link>

      <div className="mb-8 pb-6 border-b border-ink/10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            {data.level} Thesis · {data.word_count.toLocaleString()} / {data.target_words.toLocaleString()} words · APA 7
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight mb-3">
            {data.title}
          </h1>
          <div className="text-xs text-ink/50">
            {data.department} · {data.area_of_interest}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={dlBusy}
          className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          {dlBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download .docx
        </button>
      </div>

      {data.abstract && <Section title="Abstract" body={data.abstract} />}
      {chapters.map(([title, key]) => (
        <Section key={key} title={title} body={c[key]} />
      ))}

      <div className="mt-12 pt-6 border-t border-ink/10">
        <h2 className="font-serif text-2xl mb-4 flex items-center gap-2">
          <BookOpen className="size-5 text-sage" /> References
        </h2>
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
                {r.source.replace("_", " ")}
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
    <section className="mb-10">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <div className="text-[15px] leading-[1.8] text-ink/85 whitespace-pre-wrap">{body}</div>
    </section>
  );
}
