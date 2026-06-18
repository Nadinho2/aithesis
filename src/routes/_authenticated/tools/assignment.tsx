import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateAssignment, exportAssignmentDocx } from "@/lib/assignments.functions";
import { checkAccess } from "@/lib/payment.functions";
import { PaymentModal } from "@/components/PaymentModal";
import {
  Loader2, Upload, Download, BookOpen, X, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/assignment")({
  head: () => ({ meta: [{ title: "Assignment Assistant — ThesisPro" }] }),
  component: AssignmentPage,
});

function AssignmentPage() {
  const genFn = useServerFn(generateAssignment);
  const exportFn = useServerFn(exportAssignmentDocx);
  const [question, setQuestion] = useState("");
  const [includeRefs, setIncludeRefs] = useState(true);
  const [citationStyle, setCitationStyle] = useState<"apa_7" | "harvard">("apa_7");
  const [file, setFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ answer: string; references: any[] } | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const checkAccessFn = useServerFn(checkAccess);

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          question,
          include_references: includeRefs,
          citation_style: citationStyle,
          ...(file ? { file_base64: file.base64, file_mime: file.mime, file_name: file.name } : {}),
        },
      }),
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(String(e)),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (!allowed.includes(f.type) && !f.type.startsWith("image/")) {
      toast.error("Only PDF, DOCX, TXT, and image files are supported.");
      return;
    }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setFile({ base64: b64, mime: f.type, name: f.name });
  };

  const submit = async () => {
    if (question.trim().length < 10) {
      toast.error("Please enter your assignment question (at least 10 characters).");
      return;
    }
    try {
      const access = await checkAccessFn({ data: { product: "assignment" } });
      if (!access.allowed) {
        setShowPayment(true);
        return;
      }
    } catch {}
    mut.mutate();
  };

  const download = async () => {
    if (!result) return;
    setDlBusy(true);
    try {
      const base64 = await exportFn({
        data: { title: "Assignment", answer: result.answer, references: result.references },
      });
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "assignment.docx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDlBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools · ₦1,000
        </div>
        <h1 className="font-serif text-3xl">Assignment Assistant</h1>
        <p className="text-ink/60 text-sm mt-1">
          Paste your question or upload a document. Get a well-researched answer with verified sources
          — or without references if you choose.
        </p>
      </div>

      {!result ? (
        <div className="space-y-5">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Paste your assignment question here…"
            rows={5}
            className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5 transition-colors"
            >
              <Upload className="size-3.5" />
              {file ? file.name : "Upload PDF, DOCX or image"}
            </button>
            {file && (
              <button
                onClick={() => setFile(null)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"
              >
                <X className="size-4" />
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,image/*"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeRefs}
                onChange={(e) => setIncludeRefs(e.target.checked)}
                className="rounded-sm border-ink/30"
              />
              Include references
            </label>
            <select
              value={citationStyle}
              onChange={(e) => setCitationStyle(e.target.value as any)}
              className="text-xs bg-card border border-ink/15 rounded-sm px-2 py-1"
            >
              <option value="apa_7">APA 7th</option>
              <option value="harvard">Harvard</option>
            </select>
          </div>

          <button
            onClick={submit}
            disabled={mut.isPending}
            className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Generate Answer
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {result.answer}
          </div>

          {result.references.length > 0 && (
            <div className="border-t border-ink/10 pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="size-4 text-sage" /> References
              </h3>
              <ol className="space-y-2 text-sm text-ink/70">
                {result.references.map((r: any, i: number) => (
                  <li key={i}>{r.apa ?? r.title}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={download}
              disabled={dlBusy}
              className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {dlBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download .docx
            </button>
            <button
              onClick={() => {
                setResult(null);
                setQuestion("");
              }}
              className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5 transition-colors"
            >
              New Assignment
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        product="assignment"
        onPaid={() => {
          setShowPayment(false);
          mut.mutate();
        }}
      />
    </div>
  );
}
