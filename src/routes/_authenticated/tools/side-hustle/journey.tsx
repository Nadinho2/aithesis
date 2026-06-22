import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivePlan, updateMilestone, completePlan } from "@/lib/side-hustle.functions";
import {
  Loader2, Zap, ArrowLeft, CheckCircle2, Circle,
  Trophy, Target, Clock, DollarSign, Flag,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/side-hustle/journey")({
  head: () => ({ meta: [{ title: "My Side Hustle Journey — Mybrainpadi" }] }),
  component: JourneyPage,
});

function JourneyPage() {
  const queryClient = useQueryClient();
  const activeFn = useServerFn(getActivePlan);
  const updateFn = useServerFn(updateMilestone);
  const completeFn = useServerFn(completePlan);

  // Check for plan data passed via sessionStorage (from wizard)
  const stored = typeof window !== "undefined" ? sessionStorage.getItem("sh-plan") : null;
  const statePlan = stored ? JSON.parse(stored) : null;
  if (stored) sessionStorage.removeItem("sh-plan");

  const { data: dbPlan, isLoading } = useQuery({
    queryKey: ["side-hustle-active-plan"],
    queryFn: () => activeFn({}),
    refetchOnWindowFocus: true,
    enabled: !statePlan,
  });

  // Use the state plan if available, otherwise fall back to DB
  const plan = statePlan ?? dbPlan;

  const updateStep = useMutation({
    mutationFn: (step: number) => updateFn({ data: { planId: plan!.id, step } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["side-hustle-active-plan"] });
      toast.success("Progress saved!");
    },
    onError: (e) => {
      if (plan?._local) {
        // Local-only plan — just update locally, DB save not expected
        queryClient.invalidateQueries({ queryKey: ["side-hustle-active-plan"] });
      } else {
        toast.error(String(e));
      }
    },
  });

  const finishPlan = useMutation({
    mutationFn: () => completeFn({ data: { planId: plan!.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["side-hustle-active-plan"] });
      toast.success("Congratulations! You completed your journey! 🎉");
    },
    onError: (e) => {
      if (plan?._local) {
        toast.success("Congratulations! 🎉");
      } else {
        toast.error(String(e));
      }
    },
  });

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink/30" />
      </div>
    );
  }

  // No active plan — show onboarding CTA
  if (!plan) {
    return <NoActivePlan />;
  }

  const milestones = typeof plan.milestones === "string" ? JSON.parse(plan.milestones) : plan.milestones;
  const currentStep = plan.current_step ?? 0;
  const totalSteps = milestones?.length ?? 7;
  const progressPct = Math.round((currentStep / totalSteps) * 100);

  const difficultyColor =
    plan.difficulty === "Beginner"
      ? "text-green-600 bg-green-100"
      : plan.difficulty === "Intermediate"
        ? "text-amber-600 bg-amber-100"
        : "text-red-600 bg-red-100";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link
        to="/tools/history"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      {/* ─── Header ─── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          <Zap className="size-3.5" />
          Your Side Hustle Journey
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl mb-2">{plan.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded-sm font-semibold ${difficultyColor}`}>
            {plan.difficulty}
          </span>
          {plan.estimated_earnings && (
            <span className="text-ink/50 flex items-center gap-1">
              <DollarSign className="size-3" /> {plan.estimated_earnings}
            </span>
          )}
          {plan.time_required && (
            <span className="text-ink/50 flex items-center gap-1">
              <Clock className="size-3" /> {plan.time_required}
            </span>
          )}
        </div>
        {plan.description && (
          <p className="text-sm text-ink/60 mt-3 max-w-2xl leading-relaxed">{plan.description}</p>
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
        {/* Progress bar */}
        <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-ink/40 mt-2">
          {progressPct < 100
            ? `You're ${progressPct}% of the way there. Keep going!`
            : "All phases complete! Mark your journey as done."}
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
              {/* Phase header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <button
                    onClick={() => {
                      if (isCompleted) {
                        // unmark
                        updateStep.mutate(Math.max(0, i - 1));
                      } else if (isCurrent || isLocked) {
                        // mark current as done (or skip forward)
                        updateStep.mutate(i + 1);
                      }
                    }}
                    disabled={updateStep.isPending}
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
                        <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-sm">
                          Done
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-sm">
                          In Progress
                        </span>
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

              {/* Tasks */}
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

      {/* ─── Complete / CTA ─── */}
      {progressPct === 100 && (
        <div className="text-center py-8 border-t border-ink/10">
          <Trophy className="size-10 text-amber-500 mx-auto mb-3" />
          <h2 className="font-serif text-xl mb-2">You've done it all!</h2>
          <p className="text-sm text-ink/50 mb-4 max-w-md mx-auto">
            You've worked through every phase. Now it's time to celebrate — and start
            looking for that first client with confidence.
          </p>
          <button
            onClick={() => finishPlan.mutate()}
            disabled={finishPlan.isPending}
            className="inline-flex items-center gap-2 text-xs px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-sm hover:opacity-90 transition-opacity font-semibold disabled:opacity-30"
          >
            {finishPlan.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Flag className="size-4" />
            )}
            Mark Journey as Complete
          </button>
        </div>
      )}

      {/* View plans history link */}
      <div className="text-center mt-4">
        <Link
          to="/tools/side-hustle/plans"
          className="text-xs text-ink/30 hover:text-sage transition-colors"
        >
          View all past journeys
        </Link>
      </div>
    </div>
  );
}

/* ─── No Active Plan ─── */

function NoActivePlan() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
      <Target className="size-12 text-ink/10 mx-auto mb-4" />
      <h2 className="font-serif text-2xl mb-2">No active journey</h2>
      <p className="text-sm text-ink/50 mb-6 max-w-md mx-auto">
        You haven't started a side hustle journey yet. Use the Side Hustle Finder to
        discover your ideal side hustle, then pick one and we'll build a roadmap to
        get you your first client.
      </p>
      <Link
        to="/tools/side-hustle"
        className="inline-flex items-center gap-2 text-xs px-5 py-2.5 bg-purple-600 text-white rounded-sm hover:bg-purple-700 transition-colors"
      >
        <Zap className="size-3.5" />
        Find Your Side Hustle
      </Link>
    </div>
  );
}
