import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateExam } from "@/lib/exam.functions";
import { checkAccess } from "@/lib/payment.functions";
import { PaymentModal } from "@/components/PaymentModal";
import { Loader2, Upload, GraduationCap, X, Sparkles, FileQuestion } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/exam")({
  head: () => ({ meta: [{ title: "Exam Preparation — ThesisPro" }] }),
  component: ExamPage,
});

function ExamPage() {
  const genFn = useServerFn(generateExam);
  const checkAccessFn = useServerFn(checkAccess);
  const [notes, setNotes] = useState("");
  const [totalQ, setTotalQ] = useState(20);
  const [qType, setQType] = useState<"objectives" | "theory" | "both">("both");
  const [theoryCount, setTheoryCount] = useState(10);
  const [objectivesCount, setObjectivesCount] = useState(10);
  const [file, setFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ objectives: any[]; theory: any[] } | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          subject_notes: notes,
          total_questions: totalQ,
          question_type: qType,
          theory_count: qType === "both" ? theoryCount : undefined,
          objectives_count: qType === "both" ? objectivesCount : undefined,
          ...(file
            ? { file_base64: file.base64, file_mime: file.mime, file_name: file.name }
            : {}),
          ...(image ? { image_base64: image } : {}),
        },
      }),
    onSuccess: (data) => setResult(data as any),
    onError: (e) => toast.error(String(e)),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    if (isImage) {
      setImage(`data:${f.type};base64,${b64}`);
    } else {
      setFile({ base64: b64, mime: f.type, name: f.name });
    }
  };

  const submit = async () => {
    if (notes.trim().length < 10) {
      toast.error("Enter your subject notes.");
      return;
    }
    if (qType === "both" && theoryCount + objectivesCount !== totalQ) {
      toast.error(`Theory (${theoryCount}) + Objectives (${objectivesCount}) must equal ${totalQ}.`);
      return;
    }
    try {
      const access = await checkAccessFn({ data: { product: "exam" } });
      if (!access.allowed) {
        setShowPayment(true);
        return;
      }
    } catch {}
    mut.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools · ₦1,000
        </div>
        <h1 className="font-serif text-3xl">Exam Preparation</h1>
        <p className="text-ink/60 text-sm mt-1">
          Generate practice questions from your notes. Upload documents or images for context.
        </p>
      </div>

      {!result ? (
        <div className="space-y-5">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your subject notes here…"
            rows={5}
            className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y"
          />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
            >
              <Upload className="size-3.5" />
              {file ? file.name : "Upload notes (PDF/DOCX)"}
            </button>
            <button
              onClick={() => imgRef.current?.click()}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
            >
              <FileQuestion className="size-3.5" />
              {image ? "Image added" : "Upload image"}
            </button>
            {(file || image) && (
              <button
                onClick={() => {
                  setFile(null);
                  setImage(null);
                }}
                className="p-1.5 text-red-500"
              >
                <X className="size-4" />
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => handleFile(e, false)}
              className="hidden"
            />
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e, true)}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Total Questions
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={totalQ}
                onChange={(e) => setTotalQ(Number(e.target.value))}
                className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Type
              </label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as any)}
                className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm"
              >
                <option value="objectives">Objectives</option>
                <option value="theory">Theory</option>
                <option value="both">Both</option>
              </select>
            </div>
            {qType === "both" && (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Theory Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={theoryCount}
                    onChange={(e) => setTheoryCount(Number(e.target.value))}
                    className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Objectives Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={objectivesCount}
                    onChange={(e) => setObjectivesCount(Number(e.target.value))}
                    className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
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
                <Sparkles className="size-4" /> Generate Questions
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {result.objectives?.length > 0 && (
            <div>
              <h2 className="font-serif text-xl mb-4">
                Objectives ({result.objectives.length})
              </h2>
              {result.objectives.map((q: any, i: number) => (
                <div key={i} className="bg-card border border-ink/10 rounded-sm p-4 mb-3">
                  <p className="font-medium text-sm mb-2">
                    {i + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {q.options?.map((o: string, j: number) => (
                      <div
                        key={j}
                        className={`px-3 py-1.5 rounded-sm border text-xs ${
                          o === q.answer
                            ? "border-green-400 bg-green-50 text-green-700"
                            : "border-ink/10"
                        }`}
                      >
                        {String.fromCharCode(65 + j)}. {o}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.theory?.length > 0 && (
            <div>
              <h2 className="font-serif text-xl mb-4">
                Theory ({result.theory.length})
              </h2>
              {result.theory.map((q: any, i: number) => (
                <div key={i} className="bg-card border border-ink/10 rounded-sm p-4 mb-3">
                  <p className="font-medium text-sm">
                    {i + 1}. {q.question}
                  </p>
                  {q.marks && (
                    <p className="text-xs text-ink/40 mt-1">[{q.marks} marks]</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              setResult(null);
              setNotes("");
            }}
            className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5"
          >
            New Exam Paper
          </button>
        </div>
      )}

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        product="exam"
        onPaid={() => {
          setShowPayment(false);
          mut.mutate();
        }}
      />
    </div>
  );
}
