import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateAssignment, exportAssignmentDocx } from "@/lib/assignments.functions";
import { checkAccess, markTransactionUsed } from "@/lib/payment.functions";
import { saveFormBeforePay } from "@/lib/usePaymentCallback";
import {
  Loader2, Upload, Download, BookOpen, X, Sparkles, ImageIcon, FileText, Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/assignment")({
  head: () => ({ meta: [{ title: "Assignment Assistant — Mybrainpadi" }] }),
  component: AssignmentPage,
});

const SECTION_KEYS = ["introduction", "literature_review", "analysis_1", "analysis_2", "discussion", "conclusion"];
const SECTION_LABELS: Record<string, string> = {
  introduction: "Introduction & Background",
  literature_review: "Literature Review",
  analysis_1: "Analysis — Part 1",
  analysis_2: "Analysis — Part 2",
  discussion: "Discussion",
  conclusion: "Conclusion & Recommendations",
};

function AssignmentPage() {
  const genFn = useServerFn(generateAssignment);
  const exportFn = useServerFn(exportAssignmentDocx);
  const [question, setQuestion] = useState("");
  const [includeRefs, setIncludeRefs] = useState(true);
  const [citationStyle, setCitationStyle] = useState<"apa_7" | "harvard">("apa_7");
  const [wordCountTarget, setWordCountTarget] = useState(3000);
  const [academicLevel, setAcademicLevel] = useState<"undergraduate" | "masters" | "phd">("undergraduate");
  const [gradingTarget, setGradingTarget] = useState<"A" | "B" | "C">("B");
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const [docFile, setDocFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [imageFile, setImageFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{
    sections: Record<string, string>;
    abstract: string;
    references: any[];
    word_count: number;
  } | null>(null);
  const [activeSection, setActiveSection] = useState("introduction");
  const [dlBusy, setDlBusy] = useState(false);
  const navigate = useNavigate();
  const checkAccessFn = useServerFn(checkAccess);

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          question: inputMode === "text" ? question : "",
          include_references: includeRefs,
          citation_style: citationStyle,
          word_count_target: wordCountTarget,
          academic_level: academicLevel,
          grading_target: gradingTarget,
          ...(docFile ? { file_base64: docFile.base64, file_mime: docFile.mime, file_name: docFile.name } : {}),
          ...(imageFile ? { file_base64: imageFile.base64, file_mime: imageFile.mime, file_name: imageFile.name } : {}),
        },
      }),
    onSuccess: (data: any) => {
      setResult(data);
      if (data?.saved) {
        toast.success("Assignment saved to history!");
      } else {
        toast.warning("Generated but could not save to history — check Vercel logs");
      }
      markUsedFn({ data: { product: "assignment" } }).catch(() => {});
    },
    onError: (e) => toast.error(String(e)),
  });

  const markUsedFn = useServerFn(markTransactionUsed);

  const switchMode = (mode: "text" | "image") => {
    setInputMode(mode);
    if (mode === "image") { setQuestion(""); setDocFile(null); }
    else { setImageFile(null); }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain"];
    if (!allowed.includes(f.type)) { toast.error("Only PDF, DOCX, and TXT files are supported."); return; }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setDocFile({ base64: b64, mime: f.type, name: f.name });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Only image files are supported."); return; }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setImageFile({ base64: b64, mime: f.type, name: f.name });
  };

  const submit = async () => {
    if (inputMode === "text") {
      if (!question.trim() && !docFile) { toast.error("Please enter your question or upload a document."); return; }
    } else {
      if (!imageFile) { toast.error("Please upload an image of your assignment question."); return; }
    }
    try {
      const access = await checkAccessFn({ data: { product: "assignment" } });
      if (!access.allowed) {
        saveFormBeforePay({ question, includeRefs, citationStyle, wordCountTarget, academicLevel, gradingTarget });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
    } catch {
      saveFormBeforePay({ question, includeRefs, citationStyle, wordCountTarget, academicLevel, gradingTarget });
      sessionStorage.setItem("return_path", window.location.pathname);
      navigate({ to: "/billing" });
      setTimeout(() => { window.location.href = "/billing"; }, 300);
      return;
    }
    mut.mutate();
  };

  const download = async () => {
    if (!result) return;
    setDlBusy(true);
    try {
      const base64 = await exportFn({
        data: {
          title: question.slice(0, 80) || "Assignment",
          sections: result.sections,
          abstract: result.abstract,
          references: result.references,
        },
      });
      const bin = atob(base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const a = document.createElement("a"); a.href = url; a.download = "assignment.docx"; a.click();
      URL.revokeObjectURL(url);
    } finally { setDlBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Student Tools · ₦1,000</div>
        <h1 className="font-serif text-3xl">Assignment Assistant</h1>
        <p className="text-ink/60 text-sm mt-1">
          Paste your question or upload a document. Get a well-structured academic answer with multiple sections and verified sources.
        </p>
      </div>

      {!result ? (
        <div className="space-y-5">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => switchMode("text")} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${inputMode === "text" ? "bg-ink text-bone border-ink" : "border-ink/15 text-ink/60 hover:bg-ink/5"}`}>
              <FileText className="size-3.5" /> Text / Document
            </button>
            <button onClick={() => switchMode("image")} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${inputMode === "image" ? "bg-ink text-bone border-ink" : "border-ink/15 text-ink/60 hover:bg-ink/5"}`}>
              <ImageIcon className="size-3.5" /> Upload Image
            </button>
          </div>

          {/* Input mode banner */}
          <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
            <Info className="size-4 mt-0.5 shrink-0" />
            <p>Choose <strong>one input method</strong> — type/upload a document <em>or</em> upload an image. The AI generates a structured multi-section answer.</p>
          </div>

          {/* Text Mode */}
          {inputMode === "text" && (
            <>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Paste your assignment question here…" rows={5} className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y" />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => docRef.current?.click()} className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5 transition-colors">
                  <Upload className="size-3.5" /> {docFile ? docFile.name : "Upload PDF, DOCX or TXT"}
                </button>
                {docFile && <button onClick={() => setDocFile(null)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"><X className="size-4" /></button>}
                <input ref={docRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleDocUpload} className="hidden" />
              </div>
            </>
          )}

          {/* Image Mode */}
          {inputMode === "image" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => imageRef.current?.click()} className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5 transition-colors">
                  <Upload className="size-3.5" /> {imageFile ? "Change image" : "Upload image (screenshot of question)"}
                </button>
                {imageFile && <button onClick={() => setImageFile(null)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"><X className="size-4" /></button>}
                <input ref={imageRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
              {imageFile && (
                <div className="border border-ink/10 rounded-sm overflow-hidden max-w-md">
                  <img src={`data:${imageFile.mime};base64,${imageFile.base64}`} alt="Uploaded preview" className="w-full h-auto max-h-64 object-contain bg-white" />
                  <p className="text-[10px] text-ink/40 px-2 py-1 border-t border-ink/5 truncate">{imageFile.name}</p>
                </div>
              )}
            </div>
          )}

          {/* Config row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">Word Count Target</label>
              <select value={wordCountTarget} onChange={(e) => setWordCountTarget(Number(e.target.value))} className="w-full text-xs bg-card border border-ink/15 rounded-sm px-2 py-1.5">
                <option value={1500}>1,500 words</option>
                <option value={3000}>3,000 words</option>
                <option value={5000}>5,000 words</option>
                <option value={8000}>8,000 words</option>
                <option value={12000}>12,000 words</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">Academic Level</label>
              <select value={academicLevel} onChange={(e) => setAcademicLevel(e.target.value as any)} className="w-full text-xs bg-card border border-ink/15 rounded-sm px-2 py-1.5">
                <option value="undergraduate">Undergraduate</option>
                <option value="masters">Master's</option>
                <option value="phd">PhD</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">Target Grade</label>
              <select value={gradingTarget} onChange={(e) => setGradingTarget(e.target.value as any)} className="w-full text-xs bg-card border border-ink/15 rounded-sm px-2 py-1.5">
                <option value="A">A (Distinction)</option>
                <option value="B">B (Strong Pass)</option>
                <option value="C">C (Pass)</option>
              </select>
            </div>
          </div>

          {/* Checkbox row */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeRefs} onChange={(e) => setIncludeRefs(e.target.checked)} className="rounded-sm border-ink/30" />
              Include references
            </label>
            <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value as any)} className="text-xs bg-card border border-ink/15 rounded-sm px-2 py-1">
              <option value="apa_7">APA 7th</option>
              <option value="harvard">Harvard</option>
            </select>
          </div>

          <button onClick={submit} disabled={mut.isPending} className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60">
            {mut.isPending ? <><Loader2 className="size-4 animate-spin" /> Generating…</> : <><Sparkles className="size-4" /> Generate Assignment</>}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-ink/10">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-1">
                {academicLevel === "undergraduate" ? "Undergraduate" : academicLevel === "masters" ? "Master's" : "PhD"} · Target: {gradingTarget}-grade · {(result.word_count ?? 0).toLocaleString()} words
              </div>
              <h2 className="font-serif text-xl">{question.slice(0, 80)}{question.length > 80 ? "…" : ""}</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={download} disabled={dlBusy} className="px-3 py-2 bg-ink text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60 hover:bg-sage transition-colors">
                {dlBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} .docx
              </button>
              <button onClick={() => { setResult(null); setQuestion(""); }} className="px-3 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5 transition-colors">New</button>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 border-b border-ink/10 overflow-x-auto">
            {SECTION_KEYS.map((key) => (
              <button key={key} onClick={() => setActiveSection(key)} className={`shrink-0 px-3 py-2 text-xs border-b-2 transition-colors ${activeSection === key ? "border-ink text-ink font-medium" : "border-transparent text-ink/40 hover:text-ink/70"}`}>
                {SECTION_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Active section content */}
          <div className="prose prose-sm max-w-none text-sm leading-relaxed">
            {result.sections[activeSection]?.split(/\n\n+/).map((para, i) => {
              if (!para.trim()) return null;
              if (para.match(/^\[TABLE:/)) {
                const titleMatch = para.match(/^\[TABLE:\s*(.+?)\]/);
                const rows = para.split(/\n/).slice(1).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())).filter((r) => r.length > 1 && r.some((c) => c));
                if (rows.length > 0) {
                  return (
                    <div key={i} className="mb-4 w-full overflow-x-auto">
                      <table className="w-full table-fixed text-sm border-collapse">
                        {titleMatch && <caption className="text-xs text-ink/60 mb-1 italic text-left">{titleMatch[1]}</caption>}
                        <thead><tr>{rows[0].map((h: string, ci: number) => <th key={ci} className="border border-ink/20 bg-ink/5 px-2 py-1 text-left font-semibold whitespace-nowrap text-xs">{h}</th>)}</tr></thead>
                        <tbody>{rows.slice(1).map((row: string[], ri: number) => <tr key={ri} className="even:bg-ink/[0.02]">{row.map((cell: string, ci: number) => <td key={ci} className="border border-ink/20 px-2 py-1 break-words text-xs">{cell}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  );
                }
              }
              return <p key={i} className="mb-3 break-words" dangerouslySetInnerHTML={{ __html: formatInline(para) }} />;
            })}
          </div>

          {/* References */}
          {result.references.length > 0 && (
            <div className="border-t border-ink/10 pt-4 mt-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="size-4 text-sage" /> References</h3>
              <ol className="space-y-2 text-sm text-ink/70">
                {result.references.map((r: any, i: number) => (
                  <li key={i}>{r.apa ?? r.title}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-ink/5 px-1 py-0.5 rounded text-[13px] font-mono'>$1</code>");
}
