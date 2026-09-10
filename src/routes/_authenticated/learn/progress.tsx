import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProgressOverview } from "@/lib/progress.functions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Brain,
  Flame,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/progress")({
  head: () => ({ meta: [{ title: "My Progress — Mybrainpadi" }] }),
  component: ProgressPage,
});

const WEAK_THRESHOLD = 70;

const chartConfig = {
  done: { label: "Completed", color: "oklch(0.45 0.12 170)" },
  total: { label: "Planned", color: "oklch(0.15 0.003 270 / 0.10)" },
} satisfies ChartConfig;

function ProgressPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const fn = useServerFn(getProgressOverview);

  const { data, isLoading } = useQuery({
    queryKey: ["progress-overview"],
    queryFn: () => fn(),
  });

  const planner = data?.planner;
  const quiz = data?.quiz;

  const dayShort = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });

  const chartData = (planner?.last7Days ?? []).map((d) => ({
    day: dayShort(d.date),
    done: d.done,
    total: d.total,
  }));

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
            <h2 className="font-serif text-lg font-bold text-ink">My Progress</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track your learning</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Practice
            </div>
            <h1 className="font-serif text-3xl text-ink">My Progress</h1>
            <p className="text-ink/60 text-sm mt-1">
              Your study-plan completion and quiz accuracy at a glance.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-16 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading your progress…
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <StatCard
                  icon={CheckCircle2}
                  label="Plan completion"
                  value={`${planner?.completionRate ?? 0}%`}
                  sub={`${planner?.done ?? 0}/${planner?.total ?? 0} tasks done`}
                />
                <StatCard
                  icon={Brain}
                  label="Quiz accuracy"
                  value={`${quiz?.accuracy ?? 0}%`}
                  sub={`${quiz?.correct ?? 0}/${quiz?.attempts ?? 0} correct`}
                />
                <StatCard
                  icon={Flame}
                  label="Day streak"
                  value={`${planner?.streak ?? 0}`}
                  sub={planner?.streak ? "days with a completed task" : "complete a task to start"}
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Overdue"
                  value={`${planner?.overdue ?? 0}`}
                  sub="pending tasks past due"
                  tone="warn"
                />
              </div>

              {/* Study plan panel */}
              <div className="border border-ink/10 rounded-lg bg-card mb-6">
                <div className="px-5 py-4 border-b border-ink/5 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-sm uppercase tracking-[0.12em]">Study plan</h2>
                    <p className="text-xs text-ink/40 mt-0.5">Completed tasks, last 7 days</p>
                  </div>
                  <Link
                    to="/learn/study-planner"
                    className="text-sm font-medium text-sage hover:text-verde transition-colors inline-flex items-center gap-1.5"
                  >
                    Open planner <ArrowRight className="size-4" />
                  </Link>
                </div>

                <div className="p-5">
                  {planner && planner.total > 0 ? (
                    <>
                      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={11}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            width={28}
                            fontSize={11}
                          />
                          <ChartTooltip
                            cursor={{ fill: "oklch(0.15 0.003 270 / 0.04)" }}
                            content={<ChartTooltipContent />}
                          />
                          <Bar
                            dataKey="total"
                            fill="var(--color-total)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={24}
                          />
                          <Bar
                            dataKey="done"
                            fill="var(--color-done)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={24}
                          />
                        </BarChart>
                      </ChartContainer>

                      {planner.bySubject.length > 0 && (
                        <div className="mt-6 space-y-3">
                          <div className="text-xs font-semibold text-ink/50 uppercase tracking-wide">
                            By subject
                          </div>
                          {planner.bySubject.map((s) => {
                            const pct = s.total === 0 ? 0 : Math.round((s.done / s.total) * 100);
                            return (
                              <div key={s.subject} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-ink">{s.subject}</span>
                                  <span className="text-xs text-ink/50">
                                    {s.done}/{s.total}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-ink/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-sage"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={BarChart3}
                      text="No study plan yet. Create tasks or let AI build a week for you."
                      to="/learn/study-planner"
                      cta="Go to study planner"
                    />
                  )}
                </div>
              </div>

              {/* Weak areas panel */}
              <div className="border border-ink/10 rounded-lg bg-card">
                <div className="px-5 py-4 border-b border-ink/5 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-sm uppercase tracking-[0.12em]">Weak areas</h2>
                    <p className="text-xs text-ink/40 mt-0.5">Subjects ranked by quiz accuracy</p>
                  </div>
                  <Link
                    to="/learn/past-questions"
                    search={{ category: undefined, university: undefined, course: undefined, subject: undefined }}
                    className="text-sm font-medium text-sage hover:text-verde transition-colors inline-flex items-center gap-1.5"
                  >
                    Practise <ArrowRight className="size-4" />
                  </Link>
                </div>

                <div className="p-5">
                  {quiz && quiz.subjects.length > 0 ? (
                    <div className="space-y-3">
                      {quiz.subjects.slice(0, 6).map((s) => (
                        <div key={s.subject} className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-ink flex items-center gap-2">
                              {s.subject}
                              {s.accuracy < WEAK_THRESHOLD && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm">
                                  Needs work
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-ink/50">
                              {s.correct}/{s.attempts} · {s.accuracy}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-ink/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.accuracy < 40
                                  ? "bg-red-400"
                                  : s.accuracy < 60
                                    ? "bg-amber-400"
                                    : "bg-sage"
                              }`}
                              style={{ width: `${Math.max(4, s.accuracy)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Brain}
                      text="No quiz data yet. Take a quiz and we'll track your weak areas here."
                      to="/learn/past-questions"
                      cta="Practise past questions"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  sub: string;
  tone?: "warn";
}) {
  return (
    <div className="border border-ink/10 rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 text-ink/40 mb-2">
        <Icon className={`size-4 ${tone === "warn" ? "text-amber-600" : "text-sage"}`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="font-serif text-2xl text-ink">{value}</div>
      <div className="text-xs text-ink/50 mt-1">{sub}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  to,
  cta,
}: {
  icon: typeof CheckCircle2;
  text: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="text-center py-8">
      <Icon className="size-6 text-ink/20 mx-auto mb-2" />
      <p className="text-sm text-ink/60">{text}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-sage hover:text-verde transition-colors"
      >
        {cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
