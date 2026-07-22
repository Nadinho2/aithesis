import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateAssignment } from "@/lib/assignments.functions";
import { checkAccess, markTransactionUsed } from "@/lib/payment.functions";
import { saveFormBeforePay } from "@/lib/usePaymentCallback";
import {
  Loader2, Upload, FileText, Info, Send, FilePen, Calculator,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/assignment")({
  head: () => ({ meta: [{ title: "Assignment Assistant — Mybrainpadi" }] }),
  component: AssignmentPage,
});

function AssignmentPage() {
  const genFn = useServerFn(generateAssignment);
  const [question, setQuestion] = useState("");
  const [includeRefs, setIncludeRefs] = useState(true);
  const [citationStyle, setCitationStyle] = useState<"apa_7" | "harvard">("apa_7");
  const [wordCountTarget, setWordCountTarget] = useState(3000);
  const [academicLevel, setAcademicLevel] = useState<"undergraduate" | "masters" | "phd">("undergraduate");
  const [gradingTarget, setGradingTarget] = useState<"A" | "B" | "C">("B");
  const [docFile, setDocFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [assignmentType, setAssignmentType] = useState<"essay" | "problem_solving">("essay");
  const docRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const checkAccessFn = useServerFn(checkAccess);
  const markUsedFn = useServerFn(markTransactionUsed);

  // If a child route is matched (detail page), render Outlet
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  if (pathname !== "/tools/assignment") return <Outlet />;

  const isEssay = assignmentType === "essay";

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          question,
          include_references: isEssay ? includeRefs : false,
          citation_style: isEssay ? citationStyle : "apa_7",
          word_count_target: wordCountTarget,
          academic_level: academicLevel,
          grading_target: gradingTarget,
          assignment_type: assignmentType,
          ...(docFile ? { file_base64: docFile.base64, file_mime: docFile.mime, file_name: docFile.name } : {}),
        },
      }),
    onSuccess: () => {
      markUsedFn({ data: { product: "assignment" } }).catch(() => {});
      toast.success("Assignment queued! Check your history when it's done.");
      navigate({ to: "/tools/history" });
    },
    onError: (e) => toast.error(String(e)),
  });

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

  const submit = async () => {
    if (!question.trim() && !docFile) { toast.error("Please enter your question or upload a document."); return; }
    try {
      const access = await checkAccessFn({ data: { product: "assignment" } });
      if (!access.allowed) {
        saveFormBeforePay({ question, includeRefs, citationStyle, wordCountTarget, academicLevel, gradingTarget, assignmentType });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        return;
      }
    } catch {
      saveFormBeforePay({ question, includeRefs, citationStyle, wordCountTarget, academicLevel, gradingTarget, assignmentType });
      sessionStorage.setItem("return_path", window.location.pathname);
      navigate({ to: "/billing" });
      return;
    }
    mut.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Student Tools · ₦1,000</div>
        <h1 className="font-serif text-3xl">Assignment Assistant</h1>
        <p className="text-ink/60 text-sm mt-1">
          Paste your question or upload a document. We'll generate a well-structured answer — then email you when it's ready.
        </p>
      </div>

      <div className="space-y-5">
        {/* ─── Assignment Type Toggle ─── */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1.5 block">
            Assignment Type
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setAssignmentType("essay")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                assignmentType === "essay"
                  ? "bg-ink text-bone border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-ink/5"
              }`}
            >
              <FilePen className="size-3.5" />
              Essay / Report
            </button>
            <button
              onClick={() => setAssignmentType("problem_solving")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                assignmentType === "problem_solving"
                  ? "bg-ink text-bone border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-ink/5"
              }`}
            >
              <Calculator className="size-3.5" />
              Problem-Solving
            </button>
          </div>
          <p className="text-[10px] text-ink/40 mt-1">
            {isEssay
              ? "Full academic essay with introduction, literature review, analysis, discussion, and conclusion."
              : "Step-by-step solutions for math, physics, engineering, programming, or calculations."}
          </p>
        </div>

        {/* Question */}
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={isEssay
            ? "Paste your assignment question here…"
            : "Paste your problem or question here… (e.g. 'Solve for x: 2x² + 5x - 3 = 0')"}
          rows={5}
          className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y"
        />

        {/* Document upload */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => docRef.current?.click()} className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5 transition-colors">
            <Upload className="size-3.5" /> {docFile ? docFile.name : "Upload PDF, DOCX or TXT"}
          </button>
          {docFile && <button onClick={() => setDocFile(null)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm">✕</button>}
          <input ref={docRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleDocUpload} className="hidden" />
        </div>

        {/* Config row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">
              {isEssay ? "Word Count Target" : "Max Word Count"}
            </label>
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

        {/* Citation row — only for essay mode */}
        {isEssay && (
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
        )}

        {/* Info banner */}
        <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
          <Info className="size-4 mt-0.5 shrink-0" />
          <p>After submitting, you'll be redirected to your history page. The assignment is generated in the background — you'll receive an email when it's ready.</p>
        </div>

        <button onClick={submit} disabled={mut.isPending} className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60">
          {mut.isPending ? <><Loader2 className="size-4 animate-spin" /> Submitting…</> : <><Send className="size-4" /> Submit Assignment</>}
        </button>
      </div>
    </div>
  );
}
