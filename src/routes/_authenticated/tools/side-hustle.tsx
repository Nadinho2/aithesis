import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateSideHustle, startSideHustlePlan, getActivePlan } from "@/lib/side-hustle.functions";
import {
  Loader2, Sparkles, ChevronLeft, ChevronRight, Zap, Briefcase,
  Target, Clock, Heart, Star, TrendingUp, Rocket, ExternalLink,
  CheckCircle2, Circle, Trophy, DollarSign, Flag,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/side-hustle")({
  head: () => ({ meta: [{ title: "Side Hustle Finder — ThesisPro" }] }),
  component: SideHustlePage,
});

const QUESTIONS = [
  {
    id: "skills",
    icon: Briefcase,
    label: "Your Skills",
    question: "What are your current skills and areas of expertise?",
    placeholder: "e.g. I'm studying computer science, I know Python and JavaScript, and I'm good at graphic design…",
    hint: "Include technical skills, soft skills, or anything you're good at.",
  },
  {
    id: "interests",
    icon: Heart,
    label: "Your Interests",
    question: "What are you passionate about? What excites you?",
    placeholder: "e.g. I love teaching, writing, building things, video editing, fitness, AI…",
    hint: "Think about what you'd actually enjoy doing in your free time.",
  },
  {
    id: "time",
    icon: Clock,
    label: "Your Time",
    question: "How much time can you realistically dedicate per week?",
    placeholder: "e.g. 5-8 hours on weekends, a couple of hours each evening…",
    hint: "Be honest — a realistic time estimate leads to better suggestions.",
  },
  {
    id: "goal",
    icon: Target,
    label: "Your Goal",
    question: "What's your primary goal with a side hustle?",
    placeholder: "e.g. Extra income to support my studies, build a portfolio, gain experience in my field…",
    hint: "Different goals lead to different kinds of opportunities.",
  },
  {
    id: "experience",
    icon: Star,
    label: "Your Experience",
    question: "What level of experience do you have in your field?",
    placeholder: "e.g. I'm a final-year student, I've done two internships, I've built a few projects…",
    hint: "This helps match suggestions to your current level.",
  },
];

function SideHustlePage() {
  const genFn = useServerFn(generateSideHustle);
  const startPlanFn = useServerFn(startSideHustlePlan);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    skills: "",
    interests: "",
    time: "",
    goal: "",
    experience: "",
  });
  const [result, setResult] = useState<any>(null);
  const [startingIndex, setStartingIndex] = useState<number | null>(null);
  const [journeyPlan, setJourneyPlan] = useState<any>(null);
  const [journeyStep, setJourneyStep] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  // ─── Reload active plan from DB (survives refresh/logout) ───
  const activeFn = useServerFn(getActivePlan);
  useQuery({
    queryKey: ["side-hustle-active-plan"],
    queryFn: async () => {
      try {
        const p = await activeFn({});
        if (p) {
          setJourneyPlan(p);
          setJourneyStep(p.current_step ?? 0);
        }
      } finally {
        setInitialLoading(false);
      }
      return null;
    },
    retry: false,
    staleTime: 0,
  });

  const startPlan = useMutation({
    mutationFn: ({ suggestion }: { suggestion: any }) =>
      startPlanFn({
        data: {
          sideHustleId: result?.recordId,
          title: suggestion.title,
          difficulty: suggestion.difficulty,
          estimatedEarnings: suggestion.estimated_earnings,
          timeRequired: suggestion.time_required,
          description: suggestion.description,
          firstSteps: suggestion.first_steps,
          userAnswers: result?.userAnswers,
        },
      }),
    onSuccess: (plan) => {
      setStartingIndex(null);
      setJourneyPlan(plan);
      setJourneyStep(plan.current_step ?? 0);
      toast.success("Journey started! Let's get you to your first client.");
    },
    onError: (e) => {
      setStartingIndex(null);
      toast.error(String(e));
    },
  });

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          skills: answers.skills,
          interests: answers.interests,
          time: answers.time,
          goal: answers.goal,
          experience: answers.experience,
        },
      }),
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(String(e)),
  });

  const updateAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const canProceed = answers[QUESTIONS[step].id].trim().length >= 10;

  const next = () => {
    if (step < QUESTIONS.length - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const submit = async () => {
    const allFilled = Object.values(answers).every((v) => v.trim().length >= 10);
    if (!allFilled) {
      toast.error("Please answer all questions (at least 10 characters each).");
      return;
    }
    mut.mutate();
  };

  // ─── Journey view (shown after starting a plan) ───
  if (journeyPlan) {
    const milestones = typeof journeyPlan.milestones === "string"
      ? JSON.parse(journeyPlan.milestones)
      : journeyPlan.milestones;
    const totalSteps = milestones?.length ?? 7;
    const currentStep = journeyStep;
    const progressPct = Math.round((currentStep / totalSteps) * 100);

    const difficultyColor =
      journeyPlan.difficulty === "Beginner"
        ? "text-green-600 bg-green-100"
        : journeyPlan.difficulty === "Intermediate"
          ? "text-amber-600 bg-amber-100"
          : "text-red-600 bg-red-100";

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* ─── Header ─── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
            <Zap className="size-3.5" />
            Your Side Hustle Journey
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl mb-2">{journeyPlan.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className={`px-2 py-0.5 rounded-sm font-semibold ${difficultyColor}`}>
              {journeyPlan.difficulty}
            </span>
            {journeyPlan.estimated_earnings && (
              <span className="text-ink/50 flex items-center gap-1">
                <DollarSign className="size-3" /> {journeyPlan.estimated_earnings}
              </span>
            )}
            {journeyPlan.time_required && (
              <span className="text-ink/50 flex items-center gap-1">
                <Clock className="size-3" /> {journeyPlan.time_required}
              </span>
            )}
          </div>
          {journeyPlan.description && (
            <p className="text-sm text-ink/60 mt-3 max-w-2xl leading-relaxed">{journeyPlan.description}</p>
          )}
        </div>

        {/* ─── Progress ─── */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-purple-600" />
              <span className="text-sm font-semibold text-ink">Goal: First Paying Client</span>
            </div>
            <span className="text-xs text-ink/40">
              {currentStep} of {totalSteps} phases
            </span>
          </div>
          <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-ink/40 mt-2">
            {progressPct < 100
              ? `You're ${progressPct}% of the way there. Keep going!`
              : "All phases complete! You're ready for your first client."}
          </p>
        </div>

        {/* ─── Milestones ─── */}
        <div className="space-y-3 mb-8">
          {milestones?.map((m: any, i: number) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;
            const isLocked = i > currentStep;

            return (
              <div
                key={i}
                className={`border rounded-sm p-5 transition-all ${
                  isCurrent
                    ? "border-purple-300 bg-purple-50/30 shadow-sm"
                    : isCompleted
                      ? "border-green-200 bg-green-50/20"
                      : "border-ink/10 bg-card opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (isCompleted) {
                          setJourneyStep(Math.max(0, i - 1));
                        } else if (isCurrent || isLocked) {
                          setJourneyStep(i + 1);
                        }
                      }}
                      className={`shrink-0 transition-colors ${
                        isCompleted
                          ? "text-green-500 hover:text-green-600"
                          : isCurrent
                            ? "text-purple-400 hover:text-purple-600"
                            : "text-ink/20 cursor-not-allowed"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="size-6" />
                      ) : isCurrent ? (
                        <Circle className="size-6 fill-purple-100" />
                      ) : (
                        <Circle className="size-6" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/30">
                          Phase {m.phase}
                        </span>
                        {isCompleted && (
                          <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-sm">Done</span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-sm">In Progress</span>
                        )}
                      </div>
                      <h3 className="font-serif text-lg">{m.title}</h3>
                    </div>
                  </div>
                  <span className="text-[10px] text-ink/30 flex items-center gap-1 shrink-0">
                    <Clock className="size-3" /> ~{m.estimated_days} days
                  </span>
                </div>

                <p className="text-sm text-ink/60 leading-relaxed mb-3 ml-9">{m.description}</p>

                {m.tasks?.length > 0 && (
                  <div className="ml-9 space-y-1.5">
                    {m.tasks.map((task: string, j: number) => (
                      <div key={j} className="flex items-start gap-2 text-xs text-ink/50">
                        <span className="size-1.5 rounded-full bg-ink/20 mt-1.5 shrink-0" />
                        {task}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Complete ─── */}
        {progressPct === 100 && (
          <div className="text-center py-8 border-t border-ink/10">
            <Trophy className="size-10 text-amber-500 mx-auto mb-3" />
            <h2 className="font-serif text-xl mb-2">You've done it all!</h2>
            <p className="text-sm text-ink/50 mb-4 max-w-md mx-auto">
              You've worked through every phase. Now go land that first client!
            </p>
            <button
              onClick={() => toast.success("Congratulations! 🎉")}
              className="inline-flex items-center gap-2 text-xs px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-sm hover:opacity-90 transition-opacity font-semibold"
            >
              <Flag className="size-4" />
              Mark Journey as Complete
            </button>
          </div>
        )}

        {/* ─── Actions ─── */}
        <div className="flex flex-wrap gap-3 items-center justify-between pt-4 border-t border-ink/10">
          <button
            onClick={() => {
              setJourneyPlan(null);
              setJourneyStep(0);
            }}
            className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5"
          >
            Back to Results
          </button>
          {result?.recordId && (
            <Link
              to="/tools/side-hustle/$id"
              params={{ id: result.recordId }}
              className="flex items-center gap-1.5 text-xs px-4 py-2 border border-purple-200 text-purple-700 rounded-sm hover:bg-purple-50 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              View in History
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ─── Results ───
  if (result) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Side Hustle Finder</div>
          <h1 className="font-serif text-2xl mb-2">Your Side Hustle Ideas</h1>
        </div>

        {result.summary && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-sm p-5 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-purple-100">
                <TrendingUp className="size-5 text-purple-600" />
              </div>
              <h2 className="font-serif text-lg">Your Profile Summary</h2>
            </div>
            <p className="text-sm text-ink/70 leading-relaxed">{result.summary}</p>
          </div>
        )}

        <div className="space-y-4">
          {result.suggestions?.map((item: any, i: number) => (
            <div
              key={i}
              className="bg-card border border-ink/10 rounded-sm p-5 hover:border-ink/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${item.difficulty === "Beginner" ? "bg-green-100" : item.difficulty === "Intermediate" ? "bg-amber-100" : "bg-red-100"}`}>
                    <Zap className={`size-5 ${item.difficulty === "Beginner" ? "text-green-600" : item.difficulty === "Intermediate" ? "text-amber-600" : "text-red-600"}`} />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg">{item.title}</h3>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${item.difficulty === "Beginner" ? "text-green-600" : item.difficulty === "Intermediate" ? "text-amber-600" : "text-red-600"}`}>
                      {item.difficulty}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-ink/70 leading-relaxed mb-3">{item.description}</p>

              <div className="flex flex-wrap gap-3 mb-3 text-xs">
                <div className="px-2.5 py-1 bg-green-50 border border-green-100 rounded-sm text-green-700 font-medium">💰 {item.estimated_earnings}</div>
                <div className="px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-sm text-blue-700 font-medium">⏱ {item.time_required}</div>
              </div>

              {item.why_fit && (
                <p className="text-xs text-ink/50 italic mb-3"><strong>Why it fits you:</strong> {item.why_fit}</p>
              )}

              {item.first_steps?.length > 0 && (
                <div className="bg-paper border border-ink/5 rounded-sm p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">First Steps</p>
                  <ol className="space-y-1.5">
                    {item.first_steps.map((step: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-ink/60">
                        <span className="size-5 rounded-full bg-ink/5 text-ink/40 flex items-center justify-center shrink-0 text-[10px] font-bold">{j + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <button
                onClick={() => {
                  setStartingIndex(i);
                  startPlan.mutate({ suggestion: item });
                }}
                disabled={startingIndex !== null}
                className="w-full flex items-center justify-center gap-2 text-xs px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-sm hover:opacity-90 transition-opacity disabled:opacity-30 font-medium"
              >
                {startingIndex === i ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
                {startingIndex === i ? "Creating your roadmap…" : "Start This Side Hustle — Get Roadmap"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 items-center justify-between">
          <button
            onClick={() => {
              setResult(null);
              setAnswers({ skills: "", interests: "", time: "", goal: "", experience: "" });
              setStep(0);
            }}
            className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5"
          >
            Start Over
          </button>
          {result.recordId && (
            <Link
              to="/tools/side-hustle/$id"
              params={{ id: result.recordId }}
              className="flex items-center gap-1.5 text-xs px-4 py-2 border border-purple-200 text-purple-700 rounded-sm hover:bg-purple-50 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              View Full Details
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ─── Wizard ───
  const q = QUESTIONS[step];

  // Show loading while checking for existing plan from DB
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink/30" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold mb-4">
          <Zap className="size-4" />
          Side Hustle Finder
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl mb-3">Discover your ideal side hustle</h1>
        <p className="text-ink/50 max-w-lg mx-auto text-sm">
          Answer 5 quick questions about yourself, and we'll suggest personalized side hustle ideas
          tailored to your skills, interests, and goals.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-8">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? "bg-purple-500" : "bg-ink/10"} ${i === step ? "w-10" : "w-6"}`} />
        ))}
      </div>

      <div className="bg-card border border-ink/10 rounded-lg p-6 sm:p-8 mb-6">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/30 mb-6">
          <span className="text-purple-500">Step {step + 1}</span>
          <span className="text-ink/15">/ {QUESTIONS.length}</span>
          <span className="ml-auto">{q.label}</span>
        </div>

        <div className="flex items-start gap-4 mb-4">
          <div className="p-2.5 rounded-lg bg-purple-100 shrink-0">
            <q.icon className="size-6 text-purple-600" />
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl mb-1">{q.question}</h2>
            <p className="text-xs text-ink/40">{q.hint}</p>
          </div>
        </div>

        <textarea
          value={answers[q.id]}
          onChange={(e) => updateAnswer(q.id, e.target.value)}
          placeholder={q.placeholder}
          rows={4}
          className="w-full bg-paper border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-purple-400 resize-y mt-2"
        />

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-ink/30">{answers[q.id].trim().length} characters</span>
          {!canProceed && answers[q.id].trim().length > 0 && (
            <span className="text-xs text-amber-600">At least 10 characters needed</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="size-3.5" /> Previous
        </button>

        {step < QUESTIONS.length - 1 ? (
          <button
            onClick={next}
            disabled={!canProceed}
            className="flex items-center gap-1.5 text-xs px-5 py-2 bg-ink text-bone rounded-sm hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={mut.isPending || !canProceed}
            className="flex items-center gap-2 text-xs px-5 py-2 bg-purple-600 text-white rounded-sm hover:bg-purple-700 transition-colors disabled:opacity-30"
          >
            {mut.isPending ? (
              <><Loader2 className="size-3.5 animate-spin" /> Finding your side hustles…</>
            ) : (
              <><Sparkles className="size-3.5" /> Find My Side Hustles</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
