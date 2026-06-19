import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExam } from "@/lib/tool-history.functions";
import { Loader2, ArrowLeft, Check, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/exam/$id")({
  head: () => ({ meta: [{ title: "Exam — ThesisPro" }] }),
  component: ExamDetailPage,
});

function ExamDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getExam);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-ink/40 text-sm">Exam not found.</p>
        <Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  const questions = typeof data.questions === "string" ? JSON.parse(data.questions) : data.questions;
  const objectives = questions?.objectives ?? [];
  const theory = questions?.theory ?? [];

  const correct = Object.entries(submitted).filter(
    ([i, s]) => s && answers[Number(i)] === objectives[Number(i)]?.answer,
  ).length;
  const pct = objectives.length > 0 ? Math.round((correct / objectives.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/history"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Exam</div>
        <h1 className="font-serif text-2xl mb-2">
          {data.total_questions} {data.question_type} questions
        </h1>
        <p className="text-xs text-ink/40">{new Date(data.created_at).toLocaleString()}</p>
      </div>

      {/* Score Summary */}
      {objectives.length > 0 && (
        <div className="bg-card border border-ink/10 rounded-sm p-4 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Check className="size-5 text-green-600" />
            <div>
              <p className="text-sm font-medium">{correct} / {objectives.length} correct</p>
              <p className="text-xs text-ink/40">{Object.keys(submitted).length} of {objectives.length} answered</p>
            </div>
          </div>
          <div className="text-2xl font-serif text-ink/20">{pct}%</div>
        </div>
      )}

      {/* Objectives */}
      {objectives.length > 0 && (
        <div className="mb-6">
          <h2 className="font-serif text-lg mb-3">Objectives ({objectives.length})</h2>
          <div className="space-y-3">
            {objectives.map((q: any, i: number) => {
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
                  className={`bg-card border rounded-sm p-4 transition-colors ${
                    isSubmitted
                      ? matchResult ? "border-green-300 bg-green-50/50" : "border-red-200 bg-red-50/50"
                      : "border-ink/10"
                  }`}
                >
                  <p className="font-medium text-sm mb-3">{i + 1}. {q.question}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {q.options?.map((o: string, j: number) => {
                      const letter = String.fromCharCode(65 + j);
                      const isAns = letter === correctLetter;
                      const isSel = letter === selectedLetter;
                      let btnClass = "border-ink/10 hover:border-sage/40 hover:bg-sage/5 cursor-pointer";

                      if (isSubmitted) {
                        if (isAns && isSel) btnClass = "border-green-500 bg-green-100 text-green-800 ring-1 ring-green-500";
                        else if (isAns) btnClass = "border-green-400 bg-green-50 text-green-700";
                        else if (isSel && !isAns) btnClass = "border-red-400 bg-red-50 text-red-700 line-through";
                        else btnClass = "border-ink/10 opacity-50";
                      } else if (isSel) {
                        btnClass = "border-ink bg-ink/5 text-ink ring-1 ring-ink/20 cursor-pointer";
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
                  {isSubmitted && (
                    <div className={`mt-3 flex items-start gap-2 text-xs p-2.5 rounded-sm ${
                      matchResult ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {matchResult ? (
                        <><Check className="size-4 shrink-0 mt-0.5" /><div><strong>✓ Correct!</strong> {q.explanation || "Well done!"}</div></>
                      ) : (
                        <><BookOpen className="size-4 shrink-0 mt-0.5" /><div><strong>✗ Correct answer: {correctLetter}.</strong> {q.explanation || ""}</div></>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Theory */}
      {theory.length > 0 && (
        <div>
          <h2 className="font-serif text-lg mb-3">Theory ({theory.length})</h2>
          <div className="space-y-3">
            {theory.map((q: any, i: number) => (
              <div key={i} className="bg-card border border-ink/10 rounded-sm p-4">
                <p className="font-medium text-sm">{i + 1}. {q.question}</p>
                {q.marks && <p className="text-xs text-ink/40 mt-1">[{q.marks} marks]</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
