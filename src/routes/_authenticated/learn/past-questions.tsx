import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  searchPastQuestions,
  pastQuestionFacets,
  submitPastQuestionQuiz,
  getLearningSignals,
  type PastQuestion,
  type QuizResult,
  type QuestionCategory,
} from "@/lib/past-questions.functions";
import { getMyProfile, type ExamTrack } from "@/lib/profile.functions";
import { adminCheck } from "@/lib/admin.functions";
import {
  ArrowLeft,
  Search,
  Loader2,
  Check,
  X,
  Brain,
  RefreshCw,
  GraduationCap,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/learn/past-questions")({
  head: () => ({ meta: [{ title: "Past Questions — Mybrainpadi" }] }),
  component: PastQuestionsPage,
});

type Phase = "browse" | "quiz" | "results";
type QuestionType = "objectives" | "theory";

interface Filters {
  query: string;
  category: QuestionCategory;
  university: string;
  course: string;
  level: string;
  subject: string;
  question_type: QuestionType;
}

const INITIAL_FILTERS: Filters = {
  query: "",
  category: "university",
  university: "",
  course: "",
  level: "",
  subject: "",
  question_type: "objectives",
};

function PastQuestionsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const facetsFn = useServerFn(pastQuestionFacets);
  const searchFn = useServerFn(searchPastQuestions);
  const submitFn = useServerFn(submitPastQuestionQuiz);
  const signalsFn = useServerFn(getLearningSignals);
  const getProfileFn = useServerFn(getMyProfile);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
  });

  const adminFn = useServerFn(adminCheck);
  const { data: roleData } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => adminFn(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = !!roleData?.isAdmin;

  const learnerType = profile?.learner_type ?? null;

  // Which categories this learner may browse, driven by their profile.
  const availableCategories: QuestionCategory[] = useMemo(() => {
    if (isAdmin) return ["university", "waec", "neco", "jamb"];
    if (learnerType === "university") return ["university"];
    if (learnerType === "pre_university") {
      const tracks = (profile?.exam_tracks ?? []).filter((t): t is ExamTrack =>
        ["waec", "neco", "jamb"].includes(t),
      );
      return tracks.length ? (tracks as QuestionCategory[]) : ["waec", "neco", "jamb"];
    }
    return ["university", "waec", "neco", "jamb"];
  }, [isAdmin, learnerType, profile?.exam_tracks]);

  const { data: facets } = useQuery({
    queryKey: ["past-question-facets"],
    queryFn: () => facetsFn(),
    staleTime: 5 * 60_000,
  });

  const { data: signals, refetch: refetchSignals } = useQuery({
    queryKey: ["past-question-signals"],
    queryFn: () => signalsFn(),
  });

  const [phase, setPhase] = useState<Phase>("browse");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [scopeInitialized, setScopeInitialized] = useState(false);

  // Pre-fill filters once the learner profile loads.
  useEffect(() => {
    if (scopeInitialized || !profile) return;
    if (!isAdmin) {
      if (learnerType === "university") {
        setFilters((f) => ({
          ...f,
          category: "university",
          university: profile.university ?? "",
          course: "",
          subject: "",
        }));
      } else if (learnerType === "pre_university") {
        const tracks = profile.exam_tracks ?? [];
        setFilters((f) => ({
          ...f,
          category: (tracks[0] as QuestionCategory | undefined) ?? "waec",
          university: "",
          course: "",
          subject: "",
        }));
      }
    }
    setScopeInitialized(true);
  }, [scopeInitialized, profile, learnerType, isAdmin]);

  const [questions, setQuestions] = useState<PastQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizResult[]>([]);

  const searchMutation = useMutation({
    mutationFn: () =>
      searchFn({
        data: {
          query: filters.query,
          category: filters.category,
          university: filters.category === "university" ? filters.university || undefined : undefined,
          course: filters.category === "university" ? filters.course || undefined : undefined,
          level: filters.category === "university" ? filters.level || undefined : undefined,
          subject: filters.category !== "university" ? filters.subject || undefined : undefined,
          question_type: filters.question_type,
          limit: 10,
        },
      }),
    onSuccess: (qs) => {
      if (!qs.length) {
        toast.info("No questions match those filters yet. Try a different course or type.");
        return;
      }
      setQuestions(qs);
      setAnswers({});
      setResults([]);
      setPhase("quiz");
    },
    onError: (e) => toast.error(String(e)),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          answers: questions.map((q) => ({
            question_id: q.id,
            selected_answer: answers[q.id] ?? "",
          })),
        },
      }),
    onSuccess: (res) => {
      setResults(res);
      setPhase("results");
      refetchSignals();
    },
    onError: (e) => toast.error(String(e)),
  });

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const objectives = useMemo(() => questions.filter((q) => q.question_type === "objectives"), [questions]);
  const theory = useMemo(() => questions.filter((q) => q.question_type === "theory"), [questions]);

  const answeredObjectives = objectives.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const correctObjectives = useMemo(() => {
    const byId = new Map(results.map((r) => [r.question_id, r]));
    return objectives.filter((q) => byId.get(q.id)?.is_correct === true).length;
  }, [results, objectives]);

  const resultById = useMemo(() => new Map(results.map((r) => [r.question_id, r])), [results]);

  function handleSubmit() {
    if (objectives.length > 0 && answeredObjectives === 0) {
      toast.error("Answer at least one objective question before submitting.");
      return;
    }
    submitMutation.mutate();
  }

  function reset() {
    setPhase("browse");
    setQuestions([]);
    setAnswers({});
    setResults([]);
  }

  if (learnerType === "professional" && !isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
            <div className="bg-card border border-ink/10 rounded-sm p-6 text-center">
              <FileText className="size-8 text-sage mx-auto mb-3" />
              <h1 className="font-serif text-2xl text-ink mb-2">Past questions are for students</h1>
              <p className="text-sm text-ink/60 mb-6">
                Your account is set up for thesis and proposal writing. Use the tools below instead.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => navigate({ to: "/theses" })}
                  className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors"
                >
                  Write a Thesis
                </button>
                <button
                  onClick={() => navigate({ to: "/proposals" })}
                  className="px-5 py-2.5 border border-ink/15 rounded-sm text-sm hover:bg-ink/5 transition-colors"
                >
                  Write a Proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/learn" })}
            aria-label="Back to Learn"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Past Questions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Practice with real past papers</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Practice Quiz
            </div>
            <h1 className="font-serif text-3xl text-ink">Past Questions Bank</h1>
            <p className="text-ink/60 text-sm mt-1">
              Practise with past questions by course and level. Answers are graded instantly.
            </p>
          </div>

          {phase === "browse" && (
            <div className="space-y-6">
              {/* Weak areas summary */}
              {signals && signals.length > 0 && (
                <div className="bg-card border border-ink/10 rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="size-4 text-sage" />
                    <h2 className="text-sm font-semibold text-ink">Your weak areas</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {signals.map((s: any) => {
                      const pct = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0;
                      return (
                        <div
                          key={s.subject}
                          className="text-xs px-3 py-1.5 rounded-sm border border-ink/10 bg-paper"
                        >
                          <span className="font-medium">{s.subject}</span>{" "}
                          <span className="text-ink/50">
                            · {s.correct}/{s.attempts} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category selector */}
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const active = filters.category === cat;
                  const label = cat === "university" ? "University" : cat.toUpperCase();
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilter("category", cat)}
                      className={`px-3 py-1.5 rounded-sm border text-xs transition-colors ${
                        active
                          ? "bg-ink text-bone border-ink"
                          : "border-ink/15 text-ink/60 hover:bg-ink/5"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="bg-card border border-ink/10 rounded-sm p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="size-4 text-ink/40" />
                  <input
                    value={filters.query}
                    onChange={(e) => setFilter("query", e.target.value)}
                    placeholder="Search by keyword (e.g. photosynthesis)…"
                    className="flex-1 bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {filters.category === "university" ? (
                    <>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                          University
                        </span>
                        <select
                          value={filters.university}
                          onChange={(e) => setFilter("university", e.target.value)}
                          className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                        >
                          <option value="">All universities</option>
                          {(facets?.universities ?? []).map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                          Course
                        </span>
                        <select
                          value={filters.course}
                          onChange={(e) => setFilter("course", e.target.value)}
                          className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                        >
                          <option value="">All courses</option>
                          {(facets?.courses ?? []).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                          Level
                        </span>
                        <select
                          value={filters.level}
                          onChange={(e) => setFilter("level", e.target.value)}
                          className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                        >
                          <option value="">All levels</option>
                          {(facets?.levels ?? []).map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                        Subject
                      </span>
                      <select
                        value={filters.subject}
                        onChange={(e) => setFilter("subject", e.target.value)}
                        className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                      >
                        <option value="">All subjects</option>
                        {(facets?.subjects ?? []).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                      Type
                    </span>
                    <select
                      value={filters.question_type}
                      onChange={(e) => setFilter("question_type", e.target.value as QuestionType)}
                      className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                    >
                      <option value="objectives">Objectives</option>
                      <option value="theory">Theory</option>
                    </select>
                  </label>
                </div>

                <button
                  onClick={() => searchMutation.mutate()}
                  disabled={searchMutation.isPending}
                  className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {searchMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Loading…
                    </>
                  ) : (
                    <>
                      <GraduationCap className="size-4" /> Start Practice Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {phase === "quiz" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink/60">
                  {questions.length} questions · {objectives.length} objectives · {theory.length} theory
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-ink/50 hover:text-ink transition-colors"
                >
                  ← Change filters
                </button>
              </div>

              {objectives.map((q, i) => {
                const selected = answers[q.id];
                return (
                  <div key={q.id} className="bg-card border border-ink/10 rounded-sm p-4">
                    <p className="font-medium text-sm mb-3">
                      {i + 1}. {q.question}
                      <span className="text-xs text-ink/40 ml-2">[{q.course ?? q.subject ?? q.university ?? ""}]</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {q.options.map((o, j) => {
                        const letter = String.fromCharCode(65 + j);
                        const isSel = selected === o;
                        return (
                          <button
                            key={j}
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [q.id]: o }))
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

              {theory.map((q, i) => (
                <div key={q.id} className="bg-card border border-ink/10 rounded-sm p-4">
                  <p className="font-medium text-sm mb-2">
                    {objectives.length + i + 1}. {q.question}
                    <span className="text-xs text-ink/40 ml-2">[{q.course ?? q.subject ?? q.university ?? ""}]</span>
                  </p>
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Write your answer, then submit to reveal the model answer…"
                    rows={3}
                    className="w-full bg-paper border border-ink/10 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-sage resize-y"
                  />
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Submit Answers
                  </>
                )}
              </button>
            </div>
          )}

          {phase === "results" && (
            <div className="space-y-6">
              {/* Score summary */}
              {objectives.length > 0 && (
                <div className="bg-card border border-ink/10 rounded-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Check className="size-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {correctObjectives} / {objectives.length} correct
                      </p>
                      <p className="text-xs text-ink/40">
                        {answeredObjectives} of {objectives.length} objectives answered
                      </p>
                    </div>
                  </div>
                  <div className="text-2xl font-serif text-ink/20">
                    {objectives.length > 0
                      ? Math.round((correctObjectives / objectives.length) * 100)
                      : 0}
                    %
                  </div>
                </div>
              )}

              {questions.map((q, i) => {
                const res = resultById.get(q.id);
                const isTheory = q.question_type === "theory";
                const correct = res?.is_correct === true;
                const selected = answers[q.id] ?? "";

                return (
                  <div
                    key={q.id}
                    className={`bg-card border rounded-sm p-4 ${
                      isTheory
                        ? "border-ink/10"
                        : correct
                          ? "border-green-300 bg-green-50/50"
                          : "border-red-200 bg-red-50/50"
                    }`}
                  >
                    <p className="font-medium text-sm mb-3">
                      {i + 1}. {q.question}
                    </p>

                    {!isTheory && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                        {q.options.map((o, j) => {
                          const letter = String.fromCharCode(65 + j);
                          const isAnswer = normalizeEq(o, res?.correct_answer ?? "");
                          const isSelected = normalizeEq(o, selected);
                          let cls = "border-ink/10 opacity-50";
                          if (isAnswer && isSelected)
                            cls = "border-green-500 bg-green-100 text-green-800 ring-1 ring-green-500";
                          else if (isAnswer)
                            cls = "border-green-400 bg-green-50 text-green-700";
                          else if (isSelected && !isAnswer)
                            cls = "border-red-400 bg-red-50 text-red-700 line-through";

                          return (
                            <div
                              key={j}
                              className={`px-3 py-2 rounded-sm border text-xs ${cls}`}
                            >
                              <span className="font-semibold">{letter}.</span> {o}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isTheory ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-800">
                        <strong>Model Answer:</strong>{" "}
                        {res?.correct_answer || "No model answer provided."}
                      </div>
                    ) : (
                      <div
                        className={`flex items-start gap-2 text-xs p-2.5 rounded-sm ${
                          correct
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {correct ? (
                          <Check className="size-4 shrink-0 mt-0.5" />
                        ) : (
                          <X className="size-4 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <strong>{correct ? "Correct!" : "Incorrect."}</strong>{" "}
                          {!correct && (
                            <>
                              The correct answer is{" "}
                              <strong>{res?.correct_answer}</strong>.{" "}
                            </>
                          )}
                          {res?.explanation || ""}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={reset}
                className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5 flex items-center gap-2"
              >
                <RefreshCw className="size-4" /> New Quiz
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeEq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
