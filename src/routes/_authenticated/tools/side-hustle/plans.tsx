import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans } from "@/lib/side-hustle.functions";
import { Loader2, Zap, ArrowLeft, Target, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/side-hustle/plans")({
  head: () => ({ meta: [{ title: "My Journeys — ThesisPro" }] }),
  component: PlansHistoryPage,
});

function PlansHistoryPage() {
  const listFn = useServerFn(listPlans);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["side-hustle-plans"],
    queryFn: () => listFn({}),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink/30" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/side-hustle/journey"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to current journey
      </Link>

      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Side Hustle Journeys
        </div>
        <h1 className="font-serif text-2xl mb-2">All Your Journeys</h1>
        <p className="text-sm text-ink/50">
          Every side hustle roadmap you've started.
        </p>
      </div>

      {(!plans || plans.length === 0) ? (
        <div className="text-center py-16">
          <Target className="size-10 text-ink/10 mx-auto mb-3" />
          <p className="text-sm text-ink/40">No journeys yet.</p>
          <Link
            to="/tools/side-hustle"
            className="text-sm text-sage hover:underline mt-2 inline-block"
          >
            Find a side hustle to start
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan: any) => {
            const milestones = typeof plan.milestones === "string"
              ? JSON.parse(plan.milestones)
              : plan.milestones;
            const totalSteps = milestones?.length ?? 7;
            const progressPct = Math.round(((plan.current_step ?? 0) / totalSteps) * 100);

            return (
              <Link
                key={plan.id}
                to="/tools/side-hustle/journey"
                className="block bg-card border border-ink/10 rounded-sm p-4 hover:border-ink/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-base">{plan.title}</h3>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sm ${
                      plan.status === "active"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink/40">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    {plan.current_step ?? 0}/{totalSteps} phases
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                  <span>{progressPct}% complete</span>
                </div>
                {/* Mini progress bar */}
                <div className="h-1 bg-ink/5 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      plan.status === "completed" ? "bg-green-400" : "bg-purple-400"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
