import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { listLearningPaths, type LearningPathListItem } from "@/lib/learning-paths.functions";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/learning-paths")({
  head: () => ({ meta: [{ title: "Learning Paths — Mybrainpadi" }] }),
  component: LearningPathsPage,
});

function LearningPathsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const listFn = useServerFn(listLearningPaths);
  const { data: paths, isLoading } = useQuery({
    queryKey: ["learning-paths"],
    queryFn: () => listFn(),
  });

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
            <h2 className="font-serif text-lg font-bold text-ink">Learning Paths</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Guided lesson sequences</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Self learning
            </div>
            <h1 className="font-serif text-3xl text-ink">Learning Paths</h1>
            <p className="text-ink/60 text-sm mt-1">
              Related lessons sequenced into a guided journey. Complete one step to unlock the next.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-16 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : !paths || paths.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-10 text-center">
              <BookOpenCheck className="size-6 text-ink/20 mx-auto mb-2" />
              <p className="text-sm text-ink/60">No learning paths yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paths.map((p: LearningPathListItem) => {
                const pct = p.step_count > 0 ? Math.round((p.completed_count / p.step_count) * 100) : 0;
                return (
                  <Link
                    key={p.id}
                    to="/learn/learning-paths/$id"
                    params={{ id: p.id }}
                    className="border border-ink/10 rounded-sm bg-card p-4 flex items-center gap-3 hover:border-sage/40 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink group-hover:text-sage">{p.title}</p>
                      {p.description && (
                        <div className="text-xs text-ink/50 truncate mt-0.5">{p.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 max-w-[160px] h-1.5 bg-ink/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sage transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink/50">
                          {p.completed_count}/{p.step_count}
                        </span>
                        {pct === 100 && <Check className="size-4 text-green-600" />}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-ink/30 group-hover:text-sage shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
