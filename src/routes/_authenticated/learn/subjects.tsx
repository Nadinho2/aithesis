import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { listSubjects, type SubjectEntry } from "@/lib/subjects.functions";
import { getSavedItems, saveItem, unsaveItem, type SavedItem } from "@/lib/saved.functions";
import type { QuestionCategory } from "@/lib/past-questions.functions";
import {
  ArrowLeft,
  Search,
  Bookmark,
  BookmarkCheck,
  GraduationCap,
  Loader2,
  Brain,
  Library,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/learn/subjects")({
  head: () => ({ meta: [{ title: "Browse Subjects — Mybrainpadi" }] }),
  component: SubjectsPage,
});

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  university: "University",
  waec: "WAEC",
  neco: "NECO",
  jamb: "JAMB",
};

function SubjectsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const listFn = useServerFn(listSubjects);
  const savedFn = useServerFn(getSavedItems);
  const saveFn = useServerFn(saveItem);
  const unsaveFn = useServerFn(unsaveItem);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["learn-subjects"],
    queryFn: () => listFn(),
  });

  const { data: savedItems } = useQuery({
    queryKey: ["saved-items"],
    queryFn: () => savedFn(),
  });

  const savedKeys = useMemo(
    () => new Set((savedItems ?? []).map((s: SavedItem) => `${s.item_type}:${s.item_id}`)),
    [savedItems],
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<QuestionCategory | "all">("all");

  const categories = useMemo(() => {
    const set = new Set<QuestionCategory>();
    (subjects ?? []).forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [subjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (subjects ?? []).filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !(s.university ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [subjects, category, query]);

  const saveMutation = useMutation({
    mutationFn: (subject: SubjectEntry) =>
      saveFn({
        data: {
          item_type: "subject",
          item_id: subject.key,
          metadata: {
            title: subject.name,
            subtitle: subject.university
              ? `${CATEGORY_LABELS[subject.category]} · ${subject.university}`
              : CATEGORY_LABELS[subject.category],
            category: subject.category,
            university: subject.university,
            course: subject.category === "university" ? subject.name : undefined,
            subject: subject.category !== "university" ? subject.name : undefined,
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error(String(e)),
  });

  const unsaveMutation = useMutation({
    mutationFn: (subject: SubjectEntry) =>
      unsaveFn({ data: { item_type: "subject", item_id: subject.key } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      toast.success("Removed from saved");
    },
    onError: (e) => toast.error(String(e)),
  });

  const isSaved = (s: SubjectEntry) => savedKeys.has(`subject:${s.key}`);

  const practice = (s: SubjectEntry) => {
    if (s.category === "university") {
      navigate({
        to: "/learn/past-questions",
        search: { category: "university", university: s.university ?? undefined, course: s.name },
      });
    } else {
      navigate({
        to: "/learn/past-questions",
        search: { category: s.category, subject: s.name },
      });
    }
  };

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
            <h2 className="font-serif text-lg font-bold text-ink">Browse Subjects</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Discover what to study</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Discover
            </div>
            <h1 className="font-serif text-3xl text-ink">Browse Subjects</h1>
            <p className="text-ink/60 text-sm mt-1">
              Find a subject or course and jump straight into practice.
            </p>
          </div>

          {/* Search + category filter */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 bg-card border border-ink/10 rounded-sm px-3">
              <Search className="size-4 text-ink/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subjects or courses…"
                className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategory("all")}
                className={`px-3 py-1.5 rounded-sm border text-xs transition-colors ${
                  category === "all"
                    ? "bg-ink text-bone border-ink"
                    : "border-ink/15 text-ink/60 hover:bg-ink/5"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-sm border text-xs transition-colors ${
                    category === cat
                      ? "bg-ink text-bone border-ink"
                      : "border-ink/15 text-ink/60 hover:bg-ink/5"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-16 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading subjects…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-10 text-center">
              <Library className="size-6 text-ink/20 mx-auto mb-2" />
              <p className="text-sm text-ink/60">
                {subjects && subjects.length === 0
                  ? "No subjects available yet. They'll appear once past questions are added."
                  : "No subjects match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((s) => {
                const saved = isSaved(s);
                return (
                  <div
                    key={s.key}
                    className="border border-ink/10 rounded-sm bg-card p-4 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-ink text-sm truncate">{s.name}</h3>
                        <p className="text-xs text-ink/50 mt-0.5 truncate">
                          {s.university ?? CATEGORY_LABELS[s.category]} · {s.count} question
                          {s.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          saved ? unsaveMutation.mutate(s) : saveMutation.mutate(s)
                        }
                        aria-label={saved ? "Remove from saved" : "Save"}
                        disabled={saveMutation.isPending || unsaveMutation.isPending}
                        className="size-7 rounded-sm flex items-center justify-center shrink-0 text-ink/40 hover:text-sage hover:bg-ink/5 transition-colors disabled:opacity-50"
                      >
                        {saved ? (
                          <BookmarkCheck className="size-4 text-sage" />
                        ) : (
                          <Bookmark className="size-4" />
                        )}
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-ink/5 flex items-center gap-2">
                      {s.isWeak && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm">
                          <Brain className="size-3" /> Needs work
                        </span>
                      )}
                      <button
                        onClick={() => practice(s)}
                        className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-sage hover:text-verde transition-colors"
                      >
                        <GraduationCap className="size-4" /> Practise
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
