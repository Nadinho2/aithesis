import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { getThesis, exportThesisDocx } from "@/lib/theses.functions";
import { updateThesisChapters, reviseThesisWithFeedback } from "@/lib/revision.functions";
import {
  ArrowLeft, Loader2, BookOpen, Download,
  Edit3, Save, X, Upload, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex", crossref: "Crossref",
  google_scholar: "Google Scholar", arxiv: "arXiv",
};

export const Route = createFileRoute("/_authenticated/thesis/$id")({
  head: () => ({ meta: [{ title: "Thesis — Mybrainpadi" }] }),
  component: ThesisPage,
});

const CHAPTERS: Array<[string, string]> = [
  ["Chapter 1 — Introduction", "chapter_1_introduction"],
  ["Chapter 2 — Literature Review", "chapter_2_literature_review"],
  ["Chapter 3 — Methodology", "chapter_3_methodology"],
  ["Chapter 4 — Results and Findings", "chapter_4_results_findings"],
  ["Chapter 5 — Discussion, Conclusion and Recommendations", "chapter_5_discussion_conclusion"],
];

const CHAPTER_KEYS = CHAPTERS.map(([, k]) => k);

function ThesisPage() {
  const { id } = useParams({ from: "/_authenticated/thesis/$id" });
  const fn = useServerFn(getThesis);
  const dlFn = useServerFn(exportThesisDocx);
  const updFn = useServerFn(updateThesisChapters);
  const revFn = useServerFn(reviseThesisWithFeedback);
  const qc = useQueryClient();
  const [dlBusy, setDlBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [revFeedback, setRevFeedback] = useState("");
  const [revFile, setRevFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const revFileRef = useRef<HTMLInputElement>(null);
  const [editChapters, setEditChapters] = useState<Record<string, string>>({});
  const [editAbstract, setEditAbstract] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["thesis", id],
    queryFn: () => fn({ data: { id } }),
  });

  const updMut = useMutation({
    mutationFn: () => updFn({ data: { id, abstract: editAbstract, chapters: editChapters } }),
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["thesis", id] });
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
      toast.success("Thesis revised with your corrections!");
      qc.invalidateQueries({ queryKey: ["thesis", id] });
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
    const e: Record<string, string> = {};
    for (const k of CHAPTER_KEYS) e[k] = ((data.thesis.chapters ?? {}) as Record<string, string>)[k] ?? "";
    setEditChapters(e);
    setEditAbstract(data.thesis.abstract ?? "");
    setEditMode(true);
  };

  const handleDownload = async () => {
    setDlBusy(true);
    try {
      const r = await dlFn({ data: { id } });
      const bin = atob(r.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally { setDlBusy(false); }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-ink/50 p-10"><Loader2 className="size-4 animate-spin" /> Loading thesis…</div>;
  if (error || !data) return <div className="p-10 text-ink/60">Thesis not found.</div>;

  const thesis = data.thesis;
  const c = (editMode ? editChapters : (thesis.chapters ?? {})) as Record<string, string>;
  const refs = ((thesis.references_list ?? []) as Array<{ apa: string; url: string | null; source: string }>);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <Link to="/theses" className="inline-flex items-center gap-1 text-xs text-ink/60 hover:text-ink mb-6">
        <ArrowLeft className="size-3.5" /> Back to theses
      </Link>

      <div className="mb-8 pb-6 border-b border-ink/10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            {thesis.level ?? "Undergraduate"} Thesis · {(thesis.word_count ?? 0).toLocaleString()} words ·{" "}
            {(thesis as any).citation_style === "harvard" ? "Harvard" : "APA 7th"}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight mb-3">{thesis.title}</h1>
          <div className="text-xs text-ink/50">{(thesis.department ?? "") + (thesis.department && thesis.area_of_interest ? " · " : "") + (thesis.area_of_interest ?? "")}</div>
          <div className="text-[11px] text-ink/40 mt-2">
            Generated {thesis.created_at ? new Date(thesis.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="px-3 py-2 border border-ink/15 rounded-sm text-sm flex items-center gap-2 hover:bg-ink/5"><X className="size-4" /> Cancel</button>
              <button onClick={() => updMut.mutate()} disabled={updMut.isPending} className="px-3 py-2 bg-sage text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60">
                {updMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
              </button>
            </>
          ) : (
            <>
              <button onClick={enterEdit} className="px-3 py-2 border border-ink/15 rounded-sm text-sm flex items-center gap-2 hover:bg-ink/5"><Edit3 className="size-4" /> Edit</button>
              <button onClick={() => setShowRevise(true)} className="px-3 py-2 border border-amber-400 text-amber-700 rounded-sm text-sm flex items-center gap-2 hover:bg-amber-50"><RefreshCw className="size-4" /> Revise with Feedback</button>
              <button onClick={handleDownload} disabled={dlBusy} className="px-3 py-2 bg-ink text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60 hover:bg-sage">
                {dlBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} .docx
              </button>
            </>
          )}
        </div>
      </div>

      {/* Abstract */}
      {editMode ? (
        <EditableSection title="Abstract" value={editAbstract} onChange={setEditAbstract} />
      ) : thesis?.abstract ? (
        <Section title="Abstract" body={thesis.abstract} />
      ) : null}

      {/* Chapters */}
      {CHAPTERS.map(([title, key]) =>
        editMode ? (
          <EditableSection key={key} title={title} value={editChapters[key] ?? ""} onChange={(v) => setEditChapters({ ...editChapters, [key]: v })} />
        ) : (
          <Section key={key} title={title} body={c[key]} />
        ),
      )}

      {/* References */}
      <div className="mt-12 pt-6 border-t border-ink/10">
        <h2 className="font-serif text-2xl mb-4 flex items-center gap-2"><BookOpen className="size-5 text-sage" /> References</h2>
        <ol className="space-y-3 text-sm text-ink/80">
          {refs.map((r, i) => (
            <li key={i} className="leading-relaxed">
              <span className="font-mono text-[10px] text-ink/40 mr-2">[{i + 1}]</span>
              {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-sage underline-offset-2 hover:underline">{r.apa}</a> : r.apa}
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
            <p className="text-sm text-ink/60 mb-4">Paste your supervisor's corrections or upload a document with their feedback. The AI will rewrite the relevant chapters while preserving everything else.</p>
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
                {revMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Revise
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
  const blocks = parseRichBlocks(body);
  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      {blocks.map((block, i) => {
        if (block.type === "text") return <p key={i} className="text-[15px] leading-[1.8] text-ink/85 mb-4 break-words">{block.content}</p>;
        if (block.type === "table") return (
          <div key={i} className="mb-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr>{block.headers.map((h, ci) => <th key={ci} className="border border-ink/20 bg-ink/5 px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>{block.rows.map((row, ri) => <tr key={ri} className="even:bg-ink/[0.02]">{row.map((cell, ci) => <td key={ci} className="border border-ink/20 px-3 py-2">{cell}</td>)}</tr>)}</tbody>
            </table>
            {block.caption && <p className="text-xs text-ink/60 mt-1 italic">{block.caption}</p>}
          </div>
        );
        if (block.type === "figure") return (
          <div key={i} className="mb-6 p-4 border border-dashed border-ink/30 rounded-sm bg-ink/[0.02]">
            <div className="text-sm text-ink/60 italic mb-2">[{block.caption}]</div>
            {block.description && <p className="text-xs text-ink/50">{block.description}</p>}
          </div>
        );
        return null;
      })}
    </section>
  );
}

function EditableSection({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }) {
  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={8} className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-sage resize-y font-mono text-sm" />
    </section>
  );
}

function parseRichBlocks(text: string): Array<
  | { type: "text"; content: string }
  | { type: "table"; caption: string; headers: string[]; rows: string[][] }
  | { type: "figure"; caption: string; description: string }
> {
  const blocks: Array<any> = [];
  const parts = text.split(/\n{2,}/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tableMatch = trimmed.match(/^\[TABLE:\s*(.+?)\]([\s\S]*)/i);
    if (tableMatch) {
      const caption = tableMatch[1];
      const rows = tableMatch[2].trim().split(/\n/).map((r) => r.trim()).filter(Boolean);
      if (rows.length >= 2) {
        const parsedRows = rows.map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        blocks.push({ type: "table", caption, headers: parsedRows[0], rows: parsedRows.slice(1) });
        continue;
      }
    }
    const figureMatch = trimmed.match(/^\[FIGURE:\s*(.+?)\]([\s\S]*)/i);
    if (figureMatch) { blocks.push({ type: "figure", caption: figureMatch[1], description: figureMatch[2].trim() }); continue; }
    const subParts = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (const sp of subParts) { if (sp) blocks.push({ type: "text", content: sp }); }
  }
  return blocks;
}
