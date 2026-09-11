import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listMicroCourses,
  getMicroCourseSuggestions,
  type MicroCourseListItem,
  type MicroCourseSuggestion,
} from "@/lib/micro-courses.functions";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/micro-courses")({
  head: () => ({ meta: [{ title: "Micro Courses — Mybrainpadi" }] }),
  component: MicroCoursesPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  research: "Research",
  career: "Career",
  "study-skills": "Study skills",
  wellbeing: "Wellbeing",
};

function MicroCoursesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const listFn = useServerFn(listMicroCourses);
  const suggestFn = useServerFn(getMicroCourseSuggestions);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["micro-courses"],
    queryFn: () => listFn(),
  });

  const { data: suggestions } = useQuery({
    queryKey: ["micro-course-suggestions"],
    queryFn: () => suggestFn(),
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
            <h2 className="font-serif text-lg font-bold text-ink">Micro Courses</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Short, practical lessons</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Self learning
            </div>
            <h1 className="font-serif text-3xl text-ink">Micro Courses</h1>
            <p className="text-ink/60 text-sm mt-1">
              Quick, focused lessons (5–10 minutes) on the practical skills that get you through
              university and early career.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-16 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-8">
              {suggestions && suggestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="size-4 text-sage" />
                    <h2 className="text-sm font-semibold text-ink">Recommended for you</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.map((s: MicroCourseSuggestion) => (
                      <Link
                        key={s.id}
                        to="/learn/micro-courses/$id"
                        params={{ id: s.id }}
                        className="border border-sage/30 bg-sage/5 rounded-sm p-4 hover:border-sage/60 transition-colors group"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wide text-sage mb-1">
                          {CATEGORY_LABELS[s.category] ?? s.category}
                        </div>
                        <p className="text-sm font-medium text-ink group-hover:text-sage">
                          {s.title}
                        </p>
                        <p className="text-xs text-ink/50 mt-1 line-clamp-2">{s.description}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-ink/50">
                          <Clock className="size-3.5" /> {s.duration_minutes} min
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-sm font-semibold text-ink mb-3">All lessons</h2>
                {!courses || courses.length === 0 ? (
                  <div className="bg-card border border-ink/10 rounded-sm p-10 text-center">
                    <Sparkles className="size-6 text-ink/20 mx-auto mb-2" />
                    <p className="text-sm text-ink/60">Lessons are on the way.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {courses.map((c: MicroCourseListItem) => (
                      <Link
                        key={c.id}
                        to="/learn/micro-courses/$id"
                        params={{ id: c.id }}
                        className="border border-ink/10 rounded-sm bg-card p-4 flex items-center gap-3 hover:border-sage/40 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/40 bg-ink/5 px-1.5 py-0.5 rounded-sm shrink-0">
                              {CATEGORY_LABELS[c.category] ?? c.category}
                            </span>
                            <span className="text-xs text-ink/40 flex items-center gap-1">
                              <Clock className="size-3" /> {c.duration_minutes} min
                            </span>
                          </div>
                          <p className="text-sm font-medium text-ink truncate mt-1 group-hover:text-sage">
                            {c.title}
                          </p>
                          {c.description && (
                            <div className="text-xs text-ink/50 truncate mt-0.5">{c.description}</div>
                          )}
                        </div>
                        {c.completed && (
                          <span
                            className={`size-6 rounded-full flex items-center justify-center shrink-0 ${
                              c.passed ? "bg-green-100 text-green-700" : "bg-ink/5 text-ink/40"
                            }`}
                            title={c.passed ? "Completed" : "Attempted"}
                          >
                            <Check className="size-4" />
                          </span>
                        )}
                        <ArrowRight className="size-4 text-ink/30 group-hover:text-sage shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
