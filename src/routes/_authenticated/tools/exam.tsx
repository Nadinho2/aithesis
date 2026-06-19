import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateExam } from "@/lib/exam.functions";
import { checkAccess } from "@/lib/payment.functions";
import { PaymentModal } from "@/components/PaymentModal";
import { Loader2, Upload, GraduationCap, X, Sparkles, FileQuestion, FileText, ImageIcon, Info, Check, BookOpen } from "lucide-react";
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
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const [docFile, setDocFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [imageFile, setImageFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ objectives: any[]; theory: any[] } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [revealedTheory, setRevealedTheory] = useState<Record<number, boolean>>({});

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          subject_notes: inputMode === "text" ? notes : "",
          total_questions: totalQ,
          question_type: qType,
          theory_count: qType === "both" ? theoryCount : undefined,
          objectives_count: qType === "both" ? objectivesCount : undefined,
          ...(docFile
            ? { file_base64: docFile.base64, file_mime: docFile.mime, file_name: docFile.name }
            : {}),
          ...(imageFile ? { image_base64: `data:${imageFile.mime};base64,${imageFile.base64}` } : {}),
        },
      }),
    onSuccess: (data) => setResult(data as any),
    onError: (e) => toast.error(String(e)),
  });

  const switchMode = (mode: "text" | "image") => {
    setInputMode(mode);
    if (mode === "image") {
      setNotes("");
      setDocFile(null);
    } else {
      setImageFile(null);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (!allowed.includes(f.type)) {
      toast.error("Only PDF, DOCX, and TXT files are supported.");
      return;
    }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setDocFile({ base64: b64, mime: f.type, name: f.name });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setImageFile({ base64: b64, mime: f.type, name: f.name });
  };

  const submit = async () => {
    if (inputMode === "text") {
      if (!notes.trim() && !docFile) {
        toast.error("Please enter your notes or upload a document.");
        return;
      }
    } else {
      if (!imageFile) {
        toast.error("Please upload an image of your notes.");
        return;
      }
    }
    if (totalQ < 5 || totalQ > 100) {
      toast.error("Total questions must be between 5 and 100.");
      return;
    }
    if (qType === "both") {
      if (theoryCount < 1 || theoryCount > 100 || objectivesCount < 1 || objectivesCount > 100) {
        toast.error("Theory and Objectives counts must be between 1 and 100.");
        return;
      }
      if (theoryCount + objectivesCount !== totalQ) {
        toast.error(`Theory (${theoryCount}) + Objectives (${objectivesCount}) must equal ${totalQ}.`);
        return;
      }
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

  const matchAnswer = (q: any, selected: string | undefined) => {
    if (!q || !selected) return false;
    if (q.answer === selected) return true;
    if (typeof q.answer === "string" && q.answer.length === 1 && /^[A-D]$/i.test(q.answer)) {
      const idx = q.answer.toUpperCase().charCodeAt(0) - 65;
      return q.options?.[idx] === selected;
    }
    return false;
  };

  const correctCount = result
    ? Object.entries(submitted).filter(([i, s]) => s && matchAnswer(result.objectives[Number(i)], answers[Number(i)])).length
    : 0;

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

      {/* ─── Input Mode Announcement ─── */}
      <div className="mb-5 flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
        <Info className="size-4 mt-0.5 shrink-0" />
        <p>
          Choose <strong>one input method at a time</strong> — either type / upload a document
          <em>or</em> upload an image. This keeps processing focused and delivers faster results.
        </p>
      </div>

      {!result ? (
        <div className="space-y-5">
          {/* ─── Mode Toggle ─── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchMode("text")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                inputMode === "text"
                  ? "bg-ink text-bone border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-ink/5"
              }`}
            >
              <FileText className="size-3.5" />
              Text / Document
            </button>
            <button
              onClick={() => switchMode("image")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                inputMode === "image"
                  ? "bg-ink text-bone border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-ink/5"
              }`}
            >
              <ImageIcon className="size-3.5" />
              Upload Image
            </button>
          </div>

          {/* ─── Text Mode ─── */}
          {inputMode === "text" && (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your subject notes here…"
                rows={5}
                className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => docRef.current?.click()}
                  className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
                >
                  <Upload className="size-3.5" />
                  {docFile ? docFile.name : "Upload notes (PDF/DOCX/TXT)"}
                </button>
                {docFile && (
                  <button
                    onClick={() => setDocFile(null)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <input
                  ref={docRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleDocUpload}
                  className="hidden"
                />
              </div>
            </>
          )}

          {/* ─── Image Mode ─── */}
          {inputMode === "image" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => imgRef.current?.click()}
                  className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
                >
                  <Upload className="size-3.5" />
                  {imageFile ? "Change image" : "Upload image of your notes"}
                </button>
                {imageFile && (
                  <button
                    onClick={() => setImageFile(null)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              {imageFile && (
                <div className="border border-ink/10 rounded-sm overflow-hidden max-w-md">
                  <img
                    src={`data:${imageFile.mime};base64,${imageFile.base64}`}
                    alt="Uploaded preview"
                    className="w-full h-auto max-h-64 object-contain bg-white"
                  />
                  <p className="text-[10px] text-ink/40 px-2 py-1 border-t border-ink/5 truncate">
                    {imageFile.name}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Total Questions
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={totalQ}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 100) toast.error("Maximum of 100 questions allowed.");
                  setTotalQ(v);
                }}
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
                    max={100}
                    value={theoryCount}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v > 100) toast.error("Maximum of 100 theory questions allowed.");
                      setTheoryCount(v);
                    }}
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
                    max={100}
                    value={objectivesCount}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v > 100) toast.error("Maximum of 100 objective questions allowed.");
                      setObjectivesCount(v);
                    }}
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
          {/* ─── Score Summary ─── */}
          {result.objectives?.length > 0 && (
            <div className="bg-card border border-ink/10 rounded-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check className="size-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">
                    {correctCount} / {result.objectives.length} correct
                  </p>
                  <p className="text-xs text-ink/40">
                    {Object.keys(submitted).length} of {result.objectives.length} answered
                  </p>
                </div>
              </div>
              <div className="text-2xl font-serif text-ink/20">
                {result.objectives.length > 0 ? Math.round((correctCount / result.objectives.length) * 100) : 0}
                %
              </div>
            </div>
          )}

          {/* ─── Objectives (Interactive Quiz) ─── */}
          {result.objectives?.length > 0 && (
            <div>
              <h2 className="font-serif text-xl mb-4">
                Objectives ({result.objectives.length})
              </h2>
              {result.objectives.map((q: any, i: number) => {
                const isSubmitted = submitted[i];
                const selected = answers[i];
                const answerIsLetter = typeof q.answer === "string" && q.answer.length === 1 && /^[A-D]$/i.test(q.answer);
                const correctIndex = answerIsLetter
                  ? q.answer.toUpperCase().charCodeAt(0) - 65
                  : q.options?.findIndex((o: string) => o === q.answer) ?? -1;
                const correctLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : "";
                const matchResult = q.answer === selected || (answerIsLetter && q.options?.indexOf(selected) === correctIndex);
                const ansLetterIndex = q.options?.findIndex((o: string) => o === selected);
                const selectedLetter = ansLetterIndex >= 0 ? String.fromCharCode(65 + ansLetterIndex) : "";

                return (
                  <div
                    key={i}
                    className={`bg-card border rounded-sm p-4 mb-3 transition-colors ${
                      isSubmitted
                        ? matchResult
                          ? "border-green-300 bg-green-50/50"
                          : "border-red-200 bg-red-50/50"
                        : "border-ink/10"
                    }`}
                  >
                    <p className="font-medium text-sm mb-3">
                      {i + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {q.options?.map((o: string, j: number) => {
                        const letter = String.fromCharCode(65 + j);
                        const isAns = letter === correctLetter;
                        const isSel = letter === selectedLetter;
                        let btnClass =
                          "border-ink/10 hover:border-sage/40 hover:bg-sage/5 cursor-pointer";

                        if (isSubmitted) {
                          if (isAns && isSel) {
                            btnClass =
                              "border-green-500 bg-green-100 text-green-800 ring-1 ring-green-500";
                          } else if (isAns) {
                            btnClass =
                              "border-green-400 bg-green-50 text-green-700";
                          } else if (isSel && !isAns) {
                            btnClass =
                              "border-red-400 bg-red-50 text-red-700 line-through";
                          } else {
                            btnClass = "border-ink/10 opacity-50";
                          }
                        } else if (isSel) {
                          btnClass =
                            "border-ink bg-ink/5 text-ink ring-1 ring-ink/20 cursor-pointer";
                        }

                        return (
                          <button
                            key={j}
                            onClick={() => {
                              if (!isSubmitted) {
                                setAnswers((prev) => ({ ...prev, [i]: o }));
                                setSubmitted((prev) => ({ ...prev, [i]: true }));
                              }
                            }}
                            disabled={isSubmitted}
                            className={`px-3 py-2 rounded-sm border text-xs text-left transition-all ${btnClass}`}
                          >
                            <span className="font-semibold">{letter}.</span> {o}
                          </button>
                        );
                      })}
                    </div>

                    {/* ─── Feedback Note ─── */}
                    {isSubmitted && (
                      <div
                        className={`mt-3 flex items-start gap-2 text-xs p-2.5 rounded-sm ${
                          matchResult
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {matchResult ? (
                          <>
                            <Check className="size-4 shrink-0 mt-0.5" />
                            <div>
                              <strong>✓ Correct!</strong>{" "}
                              {q.explanation || "Well done! You selected the right answer."}
                            </div>
                          </>
                        ) : (
                          <>
                            <BookOpen className="size-4 shrink-0 mt-0.5" />
                            <div>
                              <strong>✗ The correct answer is {correctLetter}.</strong>{" "}
                              {q.explanation || ""}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Theory (Study Mode with Reveal) ─── */}
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

                  {/* ─── Model Answer Reveal ─── */}
                  {q.model_answer && (
                    <div className="mt-3">
                      {revealedTheory[i] ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-800">
                          <strong>Model Answer:</strong> {q.model_answer}
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setRevealedTheory((prev) => ({ ...prev, [i]: true }))
                          }
                          className="text-xs text-sage hover:text-sage/70 transition-colors"
                        >
                          + Reveal model answer
                        </button>
                      )}
                    </div>
                  )}

                  {/* ─── Student's Notes Textarea ─── */}
                  <div className="mt-3">
                    <textarea
                      placeholder="Jot down your answer ideas here…"
                      rows={2}
                      className="w-full bg-paper border border-ink/10 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-sage resize-y"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setNotes("");
              setAnswers({});
              setSubmitted({});
              setRevealedTheory({});
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
