import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { getProposal, exportProposalDocx } from "@/lib/proposals.functions";
import { updateProposalSections, reviseProposalWithFeedback } from "@/lib/revision.functions";
import {
  ArrowLeft, Loader2, BookOpen, Download, Sparkles,
  Edit3, Save, X, Upload, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  crossref: "Crossref",
  google_scholar: "Google Scholar",
  arxiv: "arXiv",
};

export const Route = createFileRoute("/_authenticated/proposal/$id")({
  head: () => ({ meta: [{ title: "Proposal — Mybrainpadi" }] }),
  component: ProposalPage,
});

const SECTION_KEYS: { label: string; key: string }[] = [
  { label: "1.1 Background to the Study", key: "background_to_the_study" },
  { label: "1.2 Statement of Problem", key: "statement_of_the_problem" },
  { label: "1.3 Objective of the Study", key: "objectives" },
  { label: "1.4 Research Questions", key: "research_questions" },
  { label: "1.5 Research Hypothesis", key: "research_hypotheses" },
  { label: "1.6 Significant of the Study", key: "significance" },
  { label: "1.7 Scope of the Study", key: "scope_of_the_study" },
  { label: "1.8 Definition of Terms", key: "definition_of_terms" },
  { label: "2.1 Conceptual Review", key: "conceptual_review" },
  { label: "2.2 Empirical Review", key: "empirical_review" },
  { label: "2.3 Theoretical Review", key: "theoretical_review" },
  { label: "2.4 Theoretical Framework", key: "theoretical_framework" },
  { label: "2.5 Summary of Reviews", key: "summary_of_reviews" },
  { label: "2.6 Gap in Literature", key: "gap_in_literature" },
  { label: "3.1 Research Design", key: "research_design" },
  { label: "3.2 Area of the Study", key: "area_of_the_study" },
  { label: "3.3 Population of the Study", key: "population_of_the_study" },
  { label: "3.4 Sample Size", key: "sample_size" },
  { label: "3.5 Sampling Techniques", key: "sampling_technique" },
  { label: "3.6 Instrument for Data Collection", key: "instrumentation" },
  { label: "3.7 Validity of Instrument", key: "validity_of_instrument" },
  { label: "3.8 Reliability of Instrument", key: "reliability_of_instrument" },
  { label: "3.9 Method of Administering Data", key: "method_of_collecting_data" },
  { label: "3.10 Method of Presentation and Data Analysis", key: "method_of_data_analysis" },
];

const LIST_KEYS = new Set(["objectives", "research_questions", "research_hypotheses"]);

function ProposalPage() {
  const { id } = useParams({ from: "/_authenticated/proposal/$id" });
  const fn = useServerFn(getProposal);
  const dlFn = useServerFn(exportProposalDocx);
  const updFn = useServerFn(updateProposalSections);
  const revFn = useServerFn(reviseProposalWithFeedback);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dlBusy, setDlBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [revFeedback, setRevFeedback] = useState("");
  const [revFile, setRevFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const revFileRef = useRef<HTMLInputElement>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [editAbstract, setEditAbstract] = useState("");
  const [goThesisBusy, setGoThesisBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => fn({ data: { id } }),
  });

  const updMut = useMutation({
    mutationFn: () => updFn({
      data: { id, abstract: editAbstract, sections: editData },
    }),
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["proposal", id] });
      setEditMode(false);
    },
    onError: (e) => toast.error(String(e)),
  });

  const revMut = useMutation({
    mutationFn: () => revFn({
      data: {
        id,
        feedback: revFeedback,
        ...(revFile ? { file_base64: revFile.base64, file_mime: revFile.mime, file_name: revFile.name } : {}),
      },
    }),
    onSuccess: () => {
      toast.success("Proposal revised with your corrections!");
      qc.invalidateQueries({ queryKey: ["proposal", id] });
      setShowRevise(false);
      setRevFeedback("");
      setRevFile(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const handleRevFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setRevFile({ base64: b64, mime: f.type, name: f.name });
  };

  const enterEdit = () => {
    if (!data) return;
    const s = data.sections as Record<string, any>;
    setEditData({ ...s });
    setEditAbstract(data.abstract ?? "");
    setEditMode(true);
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

  const goToThesis = async () => {
    if (!data) return;
    setGoThesisBusy(true);
    try {
      const s = (typeof data.sections === "string" ? JSON.parse(data.sections) : data.sections ?? {}) as Record<string, any>;
      const objectives: string[] = Array.isArray(s.objectives) && s.objectives.length
        ? s.objectives
        : ["Investigate the central problem identified in the proposal."];
      sessionStorage.setItem(
        "thesis_prefill",
        JSON.stringify({
          title: data.title ?? "",
          problem_statement: (s.statement_of_the_problem as string) ?? "",
          research_gap: (s.gap_in_literature as string)?.slice(0, 800) ?? "",
          objectives,
          department: data.department ?? "",
          area_of_interest: data.area_of_interest ?? "",
          country: data.country ?? "",
          research_type: data.research_type ?? "",
          level: data.level ?? "undergraduate",
          citation_style: (data as any).citation_style ?? "apa_7",
        }),
      );
      navigate({ to: "/new-thesis" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open thesis draft");
    } finally {
      setGoThesisBusy(false);
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

  const s = (editMode ? editData : data.sections) as Record<string, any>;
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
            {data.level} Research Proposal · {data.word_count.toLocaleString()} words ·{" "}
            {(data as any).citation_style === "harvard" ? "Harvard" : "APA 7th"}
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
              year: "numeric", month: "long", day: "numeric",
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); }} className="px-3 py-2 border border-ink/15 rounded-sm text-sm flex items-center gap-2 hover:bg-ink/5">
                <X className="size-4" /> Cancel
              </button>
              <button onClick={() => updMut.mutate()} disabled={updMut.isPending} className="px-3 py-2 bg-sage text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60">
                {updMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </button>
            </>
          ) : (
            <>
              <button onClick={enterEdit} className="px-3 py-2 border border-ink/15 rounded-sm text-sm flex items-center gap-2 hover:bg-ink/5">
                <Edit3 className="size-4" /> Edit
              </button>
              <button onClick={() => setShowRevise(true)} className="px-3 py-2 border border-amber-400 text-amber-700 rounded-sm text-sm flex items-center gap-2 hover:bg-amber-50">
                <RefreshCw className="size-4" /> Revise with Feedback
              </button>
              <button onClick={goToThesis} disabled={goThesisBusy} className="px-3 py-2 bg-ink text-bone rounded-sm text-sm hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-50">
                {goThesisBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft Thesis
              </button>
              <button onClick={handleDownload} disabled={dlBusy} className="px-3 py-2 bg-ink text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60 hover:bg-sage transition-colors">
                {dlBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                .docx
              </button>
            </>
          )}
        </div>
      </div>

      {/* Abstract */}
      {editMode ? (
        <EditableSection title="Abstract" value={editAbstract} onChange={(v) => setEditAbstract(v)} />
      ) : (
        <Section title="Abstract" body={data.abstract ?? undefined} />
      )}

      {/* Sections */}
      {SECTION_KEYS.map(({ label, key }) => {
        if (editMode) {
          if (LIST_KEYS.has(key)) {
            return <EditableListSection key={key} title={label} values={editData[key] ?? []} onChange={(vals) => setEditData({ ...editData, [key]: vals })} />;
          }
          return <EditableSection key={key} title={label} value={editData[key] ?? ""} onChange={(v) => setEditData({ ...editData, [key]: v })} />;
        }
        if (LIST_KEYS.has(key)) {
          return <ListSection key={key} title={label} items={s[key]} ordered />;
        }
        return <Section key={key} title={label} body={s[key]} />;
      })}

      {/* References */}
      <div className="mt-12 pt-6 border-t border-ink/10">
        <h2 className="font-serif text-2xl mb-4 flex items-center gap-2">
          <BookOpen className="size-5 text-sage" /> References
        </h2>
        <ol className="space-y-3 text-sm text-ink/80">
          {refs.map((r, i) => (
            <li key={i} className="leading-relaxed">
              <span className="font-mono text-[10px] text-ink/40 mr-2">[{i + 1}]</span>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-sage underline-offset-2 hover:underline">{r.apa}</a>
              ) : r.apa}
              <span className="ml-2 text-[10px] uppercase tracking-wider text-ink/40">{SOURCE_LABELS[r.source] ?? r.source}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Revise Modal */}
      {showRevise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-bone rounded-sm max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl">Revise with Feedback</h2>
              <button onClick={() => setShowRevise(false)} className="p-1 text-ink/40 hover:text-ink"><X className="size-5" /></button>
            </div>
            <p className="text-sm text-ink/60 mb-4">Paste your supervisor's corrections or upload a document with their feedback. The AI will rewrite the relevant sections while preserving everything else.</p>
            <textarea value={revFeedback} onChange={(e) => setRevFeedback(e.target.value)} rows={6} placeholder="Paste lecturer's corrections / feedback here…" className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y" />
            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => revFileRef.current?.click()} className="flex items-center gap-2 text-xs px-3 py-1.5 border border-ink/15 rounded-sm hover:bg-ink/5">
                <Upload className="size-3.5" />{revFile ? revFile.name : "Upload correction document"}
              </button>
              {revFile && <button onClick={() => setRevFile(null)} className="text-xs text-red-500"><X className="size-3.5" /></button>}
              <input ref={revFileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleRevFile} className="hidden" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRevise(false)} className="px-4 py-2 border border-ink/15 rounded-sm text-sm">Cancel</button>
              <button onClick={() => revMut.mutate()} disabled={revMut.isPending || revFeedback.trim().length < 10} className="px-4 py-2 bg-ink text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60">
                {revMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Revise
              </button>
            </div>
          </div>
        </div>
      )}
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

function ListSection({ title, items, ordered }: { title: string; items?: string[]; ordered?: boolean }) {
  if (!items || items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <Tag className={`${ordered ? "list-decimal" : "list-disc"} list-inside space-y-2 text-[15px] text-ink/85 marker:text-sage`}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </Tag>
    </section>
  );
}

function EditableSection({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }) {
  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-sage resize-y" />
    </section>
  );
}

function EditableListSection({ title, values, onChange }: { title: string; values: string[]; onChange: (v: string[]) => void }) {
  const add = () => onChange([...values, ""]);
  const upd = (i: number, v: string) => { const n = [...values]; n[i] = v; onChange(n); };
  const del = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <div className="space-y-2">
        {values.map((val, i) => (
          <div key={i} className="flex gap-2">
            <input value={val} onChange={(e) => upd(i, e.target.value)} className="flex-1 bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage" />
            <button onClick={() => del(i)} className="p-1 text-red-400 hover:text-red-600"><X className="size-4" /></button>
          </div>
        ))}
        <button onClick={add} className="text-xs text-sage hover:underline">+ Add item</button>
      </div>
    </section>
  );
}
