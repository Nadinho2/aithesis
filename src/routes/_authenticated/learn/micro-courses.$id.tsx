import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getMicroCourse,
  submitMicroCourseCheck,
  type MicroCourseBlock,
} from "@/lib/micro-courses.functions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Clock,
  Loader2,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/learn/micro-courses/$id")({
  head: () => ({ meta: [{ title: "Lesson — Mybrainpadi" }] }),
  component: MicroCourseDetailPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  research: "Research",
  career: "Career",
  "study-skills": "Study skills",
  wellbeing: "Wellbeing",
};

interface CheckResult {
  question: string;
  selected: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
}

type Phase = "lesson" | "results";

function MicroCourseDetailPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const courseFn = useServerFn(getMicroCourse);
  const submitFn = useServerFn(submitMicroCourseCheck);

  const { data: course, isLoading, error } = useQuery({
    queryKey: ["micro-course", id],
    queryFn: () => courseFn({ data: { id } }),
  });

  const [phase, setPhase] = useState<Phase>("lesson");
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [summary, setSummary] = useState<{ correct: number; total: number; passed: boolean } | null>(null);

  const submitMutation = useMutation({
    mutationFn: () => submitFn({ data: { course_id: id, answers } }),
    onSuccess: (res) => {
      setResults(res.results);
      setSummary({ correct: res.correct, total: res.total, passed: res.passed });
      setPhase("results");
    },
    onError: (e) => toast.error(String(e)),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-ink/50">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-ink/60 mb-3">This lesson couldn't be loaded.</p>
        <button
          onClick={() => navigate({ to: "/learn/micro-courses" })}
          className="text-sm font-medium text-sage hover:text-verde transition-colors"
        >
          ← Back to Micro Courses
        </button>
      </div>
    );
  }

  const questions = course.check_questions ?? [];

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/learn/micro-courses" })}
            aria-label="Back to Micro Courses"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-ink truncate">{course.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[course.category] ?? course.category} · {course.duration_minutes} min
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          {phase === "lesson" && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
                  Micro Course
                </div>
                <h1 className="font-serif text-3xl text-ink">{course.title}</h1>
                {course.description && (
                  <p className="text-ink/60 text-sm mt-2">{course.description}</p>
                )}
              </div>

              {/* Lesson content */}
              <div className="space-y-4">
                {course.content.map((block: MicroCourseBlock, i: number) => (
                  <BlockView key={i} block={block} />
                ))}
              </div>

              {/* Post-lesson check */}
              {questions.length > 0 && (
                <div className="border-t border-ink/10 pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-sage" />
                    <h2 className="text-sm font-semibold text-ink">Quick check</h2>
                  </div>
                  {questions.map((q: any, qi: number) => {
                    const selected = answers[qi];
                    return (
                      <div key={qi} className="bg-card border border-ink/10 rounded-sm p-4">
                        <p className="font-medium text-sm mb-3">
                          {qi + 1}. {q.question}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {q.options.map((o: string, oi: number) => {
                            const letter = String.fromCharCode(65 + oi);
                            const isSel = selected === o;
                            return (
                              <button
                                key={oi}
                                onClick={() =>
                                  setAnswers((prev) => {
                                    const next = [...prev];
                                    next[qi] = o;
                                    return next;
                                  })
                                }
                                className={`px-3 py-2 rounded-sm border text-xs text-left transition-all ${
                                  isSel
                                    ? "border-ink bg-ink/5 text-ink ring-1 ring-ink/20"
                                    : "border-ink/10 hover:border-sage/40 hover:bg-sage/5"
                                }`}
                              >
                                <span className="font-semibold">{letter}.</span> {o}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => {
                      if (questions.some((_: any, qi: number) => !answers[qi]?.trim())) {
                        toast.error("Answer every question before submitting.");
                        return;
                      }
                      submitMutation.mutate();
                    }}
                    disabled={submitMutation.isPending}
                    className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Checking…
                      </>
                    ) : (
                      <>
                        <Check className="size-4" /> Submit answers
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "results" && summary && (
            <div className="space-y-6">
              <div className="bg-card border border-ink/10 rounded-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {summary.passed ? (
                    <Check className="size-5 text-green-600" />
                  ) : (
                    <X className="size-5 text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {summary.correct} / {summary.total} correct
                    </p>
                    <p className="text-xs text-ink/40">
                      {summary.passed ? "Nice — you've completed this lesson." : "Review and try again."}
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-serif text-ink/20">
                  {summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0}%
                </div>
              </div>

              {results.map((r, i) => (
                <div
                  key={i}
                  className={`border rounded-sm p-4 ${
                    r.is_correct
                      ? "bg-green-50/50 border-green-300"
                      : "bg-red-50/50 border-red-200"
                  }`}
                >
                  <p className="font-medium text-sm mb-2">
                    {i + 1}. {r.question}
                  </p>
                  <div
                    className={`flex items-start gap-2 text-xs p-2.5 rounded-sm ${
                      r.is_correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {r.is_correct ? (
                      <Check className="size-4 shrink-0 mt-0.5" />
                    ) : (
                      <X className="size-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong>{r.is_correct ? "Correct!" : "Incorrect."}</strong>{" "}
                      {!r.is_correct && (
                        <>
                          The correct answer is <strong>{r.correct_answer}</strong>.{" "}
                        </>
                      )}
                      {r.explanation || ""}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setPhase("lesson");
                    setAnswers([]);
                  }}
                  className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5 flex items-center gap-2"
                >
                  <RefreshCw className="size-4" /> Retry
                </button>
                <button
                  onClick={() => navigate({ to: "/learn/micro-courses" })}
                  className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2"
                >
                  More lessons <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: MicroCourseBlock }) {
  if (block.type === "heading") {
    return <h3 className="font-serif text-lg font-semibold text-ink pt-2">{block.body}</h3>;
  }
  if (block.type === "bullet") {
    return (
      <div className="flex items-start gap-2 pl-1">
        <span className="text-sage mt-2">•</span>
        <p className="text-sm text-ink/80 leading-relaxed">{block.body}</p>
      </div>
    );
  }
  if (block.type === "tip") {
    return (
      <div className="bg-sage/5 border border-sage/20 rounded-sm p-3 flex items-start gap-2">
        <Lightbulb className="size-4 text-sage shrink-0 mt-0.5" />
        <p className="text-xs text-ink/80 leading-relaxed">{block.body}</p>
      </div>
    );
  }
  return <p className="text-sm text-ink/80 leading-relaxed">{block.body}</p>;
}
