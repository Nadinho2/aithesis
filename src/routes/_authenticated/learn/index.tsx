import { createFileRoute, Link } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BookOpenCheck,
  Calendar,
  Library,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/")({
  head: () => ({ meta: [{ title: "Learn — Mybrainpadi" }] }),
  component: LearnPage,
});

const SECTIONS = [
  {
    title: "Self learning",
    description: "Short lessons and guided paths to build practical skills.",
    items: [
      {
        to: "/learn/learning-paths",
        label: "Learning paths",
        description: "Guided sequences of related lessons.",
        icon: BookOpenCheck,
      },
      {
        to: "/learn/micro-courses",
        label: "Micro courses",
        description: "Short, practical 5–10 minute lessons.",
        icon: Sparkles,
      },
      {
        to: "/learn/certificates",
        label: "My certificates",
        description: "Shareable proof of what you've mastered.",
        icon: BookmarkCheck,
      },
    ],
  },
  {
    title: "Practice",
    description: "Reinforce what you learn with real questions and a plan.",
    items: [
      {
        to: "/learn/past-questions",
        label: "Past questions",
        description: "Practice with real past exam questions.",
        icon: Library,
      },
      {
        to: "/learn/study-planner",
        label: "Study planner",
        description: "Build a plan and track daily tasks.",
        icon: Calendar,
      },
      {
        to: "/learn/progress",
        label: "My progress",
        description: "See how you're doing across subjects.",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "Discover",
    description: "Explore the library and keep what you want close.",
    items: [
      {
        to: "/learn/subjects",
        label: "Browse subjects",
        description: "Explore questions by subject.",
        icon: Search,
      },
      {
        to: "/learn/saved",
        label: "Saved",
        description: "Your bookmarked questions and lessons.",
        icon: Bookmark,
      },
    ],
  },
];

function LearnPage() {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0">
          <h2 className="font-serif text-lg font-bold text-ink">Learn</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Grow your skills</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn
            </div>
            <h1 className="font-serif text-3xl text-ink">Grow your skills</h1>
            <p className="text-ink/60 text-sm mt-1">
              Short lessons, guided paths, and real practice questions — all in one place.
            </p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
                <p className="text-xs text-ink/50 mt-0.5 mb-3">{section.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="border border-ink/10 rounded-sm bg-card p-4 flex items-start gap-3 hover:border-sage/40 transition-colors group"
                      >
                        <div className="size-9 rounded-sm bg-sage/10 text-sage flex items-center justify-center shrink-0">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink group-hover:text-sage">
                            {item.label}
                          </p>
                          <p className="text-xs text-ink/50 mt-0.5">{item.description}</p>
                        </div>
                        <ArrowRight className="size-4 text-ink/30 group-hover:text-sage shrink-0 mt-1" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
