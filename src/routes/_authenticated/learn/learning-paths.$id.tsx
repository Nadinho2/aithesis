import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { getLearningPath, type LearningPathStep } from "@/lib/learning-paths.functions";
import { ArrowLeft, Check, Clock, Loader2, Lock, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/learning-paths/$id")({
  head: () => ({ meta: [{ title: "Learning Path — Mybrainpadi" }] }),
  component: LearningPathDetailPage,
});

function LearningPathDetailPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const pathFn = useServerFn(getLearningPath);
  const { data: path, isLoading, error } = useQuery({
    queryKey: ["learning-path", id],
    queryFn: () => pathFn({ data: { id } }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-ink/50">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-ink/60 mb-3">This path couldn't be loaded.</p>
        <button
          onClick={() => navigate({ to: "/learn/learning-paths" })}
          className="text-sm font-medium text-sage hover:text-verde transition-colors"
        >
          ← Back to Learning Paths
        </button>
      </div>
    );
  }

  const total = path.steps.length;
  const completed = path.steps.filter((s) => s.completed).length;

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/learn/learning-paths" })}
            aria-label="Back to Learning Paths"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-ink truncate">{path.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completed}/{total} complete
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learning Path
            </div>
            <h1 className="font-serif text-3xl text-ink">{path.title}</h1>
            {path.description && <p className="text-ink/60 text-sm mt-2">{path.description}</p>}
          </div>

          {path.steps.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-10 text-center">
              <p className="text-sm text-ink/60">This path has no lessons yet.</p>
            </div>
          ) : (
            <ol className="space-y-0">
              {path.steps.map((step: LearningPathStep, i: number) => {
                const isLast = i === path.steps.length - 1;
                const clickable = step.unlocked || step.completed;
                return (
                  <li key={step.id} className="relative flex gap-4">
                    {/* Rail */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`size-9 rounded-full flex items-center justify-center shrink-0 border-2 ${
                          step.completed
                            ? "bg-sage border-sage text-white"
                            : step.unlocked
                              ? "border-sage text-sage"
                              : "border-ink/15 text-ink/30"
                        }`}
                      >
                        {step.completed ? (
                          <Check className="size-4" />
                        ) : step.unlocked ? (
                          <Play className="size-3.5 ml-0.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={`w-0.5 flex-1 min-h-8 ${step.completed ? "bg-sage" : "bg-ink/10"}`}
                        />
                      )}
                    </div>

                    {/* Step content */}
                    <div className={`flex-1 pb-6 ${!isLast ? "" : ""}`}>
                      <button
                        onClick={() =>
                          clickable &&
                          navigate({ to: "/learn/micro-courses/$id", params: { id: step.course_id } })
                        }
                        disabled={!clickable}
                        className={`w-full text-left border rounded-sm p-4 transition-colors ${
                          clickable
                            ? "border-ink/10 bg-card hover:border-sage/40"
                            : "border-ink/5 bg-ink/[0.02] opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                            Step {i + 1}
                          </span>
                          <span className="text-xs text-ink/40 flex items-center gap-1">
                            <Clock className="size-3" /> {step.duration_minutes} min
                          </span>
                        </div>
                        <p className="text-sm font-medium text-ink mt-1">{step.title}</p>
                        {step.description && (
                          <div className="text-xs text-ink/50 truncate mt-0.5">{step.description}</div>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
