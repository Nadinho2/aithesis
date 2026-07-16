import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { getAssignment } from "@/lib/tool-history.functions";
import { exportAssignmentDocx } from "@/lib/assignments.functions";
import { updateAssignmentSections, reviseAssignmentWithFeedback } from "@/lib/revision.functions";
import {
  ArrowLeft, Loader2, BookOpen, Download,
  Edit3, Save, X, Upload, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const SECTION_LABELS: Record<string, string> = {
  introduction: "Introduction & Background",
  literature_review: "Literature Review & Conceptual Framework",
  analysis_1: "Analysis — Part 1",
  analysis_2: "Analysis — Part 2",
  discussion: "Discussion",
  conclusion: "Conclusion & Recommendations",
};

const SECTION_KEYS = Object.keys(SECTION_LABELS);

export const Route = createFileRoute("/_authenticated/tools/assignment/$id")({
  head: () => ({ meta: [{ title: "Assignment — Mybrainpadi" }] }),
  component: AssignmentDetailPage,
});

function AssignmentDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getAssignment);
  const dlFn = useServerFn(exportAssignmentDocx);
  const updFn = useServerFn(updateAssignmentSections);
  const revFn = useServerFn(reviseAssignmentWithFeedback);
  const qc = useQueryClient();
  const [dlBusy, setDlBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [revFeedback, setRevFeedback] = useState("");
  const [revFile, setRevFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const revFileRef = useRef<HTMLInputElement>(null);
  const [editSections, setEditSections] = useState<Record<string, string>>({});
  const [editAbstract, setEditAbstract] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const updMut = useMutation({
    mutationFn: () => updFn({ data: { id, abstract: editAbstract, sections: editSections } }),
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["assignment", id] });
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
      toast.success("Assignment revised with your corrections!");
      qc.invalidateQueries({ queryKey: ["assignment", id] });
      setShowRevise(false);
      setRevFeedback("");
      setRevFile(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const handleRevFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setRevFile({ base64: b64, mime: f.type, name: f.name });
  };

  const enterEdit = () => {
    if (!data) return;
    const sections = typeof data.sections === "string" ? JSON.parse(data.sections) : (data.sections ?? {});
    const e: Record<string, string> = {};
    for (const k of SECTION_KEYS) e[k] = sections[k] ?? "";
    setEditSections(e);
    setEditAbstract(data.abstract ?? "");
    setEditMode(true);
  };

  const handleDownload = async () => {
    setDlBusy(true);
    try {
      const sections = typeof data.sections === "string" ? JSON.parse(data.sections) : (data.sections ?? {});
      const refs = typeof data.references_list === "string" ? JSON.parse(data.references_list) : (data.references_list ?? []);
      const base64 = await dlFn({
        data: {
          title: data.title ?? data.question?.slice(0, 80) ?? "Assignment",
          sections,
          abstract: data.abstract ?? "",
          references: refs,
        },
      });
      const bin = atob(base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "assignment.docx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally { setDlBusy(false); }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-ink/50 p-10"><Loader2 className="size-4 animate-spin" /> Loading…</div>;
  if (!data) return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-ink/40">Assignment not found.</p><Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">← Back to history</Link></div>;

  const sections = typeof data.sections === "string" ? JSON.parse(data.sections) : (data.sections ?? {});
  const refs = typeof data.references_list === "string" ? JSON.parse(data.references_list) : (data.references_list ?? []);
  const displaySections = editMode ? editSections : sections;
  const level = data.academic_level ?? "undergraduate";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <Link to="/tools/history" className="inline-flex items-center gap-1 text-xs text-ink/60 hover:text-ink mb-6">
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      {/* Header */}
      <div className="mb-8 pb-6 border-b border-ink/10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            {level === "masters" ? "Master's" : level === "phd" ? "PhD" : "Undergraduate"} Assignment · {(data.word_count ?? 0).toLocaleString()} words ·{" "}
            {(data.citation_style ?? "apa_7") === "harvard" ? "Harvard" : "APA 7th"}
            {data.grading_target ? ` · Target: ${data.grading_target}` : ""}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl leading-tight mb-2">{data.title ?? data.question}</h1>
          <div className="text-[11px] text-ink/40">
            Generated {data.created_at ? new Date(data.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
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
              <button onClick={() => setShowRevise(true)} className="px-3 py-2 border border-amber-400 text-amber-700 rounded-sm text-sm flex items-center gap-2 hover:bg-amber-50"><RefreshCw className="size-4" /> Revise</button>
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
      ) : data.abstract ? (
        <Section title="Abstract" body={data.abstract} />
      ) : null}

      {/* Sections */}
      {SECTION_KEYS.map((key) =>
        editMode ? (
          <EditableSection key={key} title={SECTION_LABELS[key]} value={editSections[key] ?? ""} onChange={(v) => setEditSections({ ...editSections, [key]: v })} />
        ) : (
          <Section key={key} title={SECTION_LABELS[key]} body={displaySections[key]} />
        ),
      )}

      {/* References */}
      {Array.isArray(refs) && refs.length > 0 && (
        <div className="mt-12 pt-6 border-t border-ink/10 max-w-full">
          <h2 className="font-serif text-2xl mb-4 flex items-center gap-2"><BookOpen className="size-5 text-sage" /> References</h2>
          <ol className="space-y-3 text-sm text-ink/80 break-words [overflow-wrap:anywhere]">
            {refs.map((r: any, i: number) => (
              <li key={i} className="leading-relaxed break-words">
                <span className="font-mono text-[10px] text-ink/40 mr-2">[{i + 1}]</span>
                {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-sage underline-offset-2 hover:underline break-words">{r.apa ?? r.title}</a> : <span className="break-words">{r.apa ?? r.title}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Revise Modal */}
      {showRevise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-bone rounded-sm max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl">Revise with Feedback</h2>
              <button onClick={() => setShowRevise(false)} className="p-1 text-ink/40 hover:text-ink"><X className="size-5" /></button>
            </div>
            <p className="text-sm text-ink/60 mb-4">Paste your lecturer's corrections or upload a document with their feedback. The AI will rewrite sections while preserving consistency.</p>
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
    <section className="mb-10 max-w-full">
      <h2 className="font-serif text-2xl mb-3 text-ink">{title}</h2>
      {blocks.map((block, i) => {
        if (block.type === "text") return <p key={i} className="text-[15px] leading-[1.8] text-ink/85 mb-4 break-words" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(block.content) }} />;
        if (block.type === "table") return (
          <div key={i} className="mb-6 w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead><tr>{block.headers.map((h, ci) => <th key={ci} className="border border-ink/20 bg-ink/5 px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>{block.rows.map((row, ri) => <tr key={ri} className="even:bg-ink/[0.02]">{row.map((cell, ci) => <td key={ci} className="border border-ink/20 px-3 py-2 break-words [overflow-wrap:anywhere]">{cell}</td>)}</tr>)}</tbody>
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

function formatInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-ink/5 px-1 py-0.5 rounded text-[13px] font-mono'>$1</code>");
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
