import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getLearningSignals } from "@/lib/past-questions.functions";
import { Brain, ArrowRight, Loader2 } from "lucide-react";

interface Signal {
  subject: string;
  attempts: number;
  correct: number;
  weak_concepts: string[];
}

const WEAK_THRESHOLD = 70;

export function LearningSignalsCard() {
  const fn = useServerFn(getLearningSignals);
  const { data, isLoading } = useQuery({
    queryKey: ["learning-signals"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const ranked = ((data ?? []) as Signal[])
    .filter((s) => s.attempts > 0)
    .map((s) => ({
      ...s,
      accuracy: Math.round((s.correct / s.attempts) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

  const weak = ranked.filter((s) => s.accuracy < WEAK_THRESHOLD);

  return (
    <div className="border border-ink/10 rounded-lg overflow-hidden bg-card">
      <div className="px-5 py-4 border-b border-ink/5">
        <h2 className="font-bold text-sm uppercase tracking-[0.12em]">Study Recommendations</h2>
        <p className="text-xs text-ink/40 mt-0.5">Your weakest areas, ranked by accuracy</p>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink/50 py-2">
            <Loader2 className="size-4 animate-spin" /> Loading your study signals…
          </div>
        ) : weak.length === 0 ? (
          <div className="text-center py-4">
            <Brain className="size-6 text-ink/20 mx-auto mb-2" />
            <p className="text-sm text-ink/60">
              {ranked.length === 0
                ? "No practice data yet. Take a quiz and we'll track your weak areas here."
                : "Looking strong — no weak areas below 70% right now."}
            </p>
            <Link
              to="/learn/past-questions"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-sage hover:text-verde transition-colors"
            >
              Practise past questions <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {weak.slice(0, 5).map((s) => (
              <div key={s.subject} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{s.subject}</span>
                  <span className="text-xs text-ink/50">
                    {s.correct}/{s.attempts} · {s.accuracy}%
                  </span>
                </div>
                <div className="h-1.5 bg-ink/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      s.accuracy < 40 ? "bg-red-400" : s.accuracy < 60 ? "bg-amber-400" : "bg-sage"
                    }`}
                    style={{ width: `${Math.max(4, s.accuracy)}%` }}
                  />
                </div>
              </div>
            ))}

            <Link
              to="/learn/past-questions"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-sage hover:text-verde transition-colors"
            >
              Practise your weak areas <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
