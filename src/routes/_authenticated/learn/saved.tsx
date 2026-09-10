import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { getSavedItems, unsaveItem, type SavedItem } from "@/lib/saved.functions";
import { ArrowLeft, Bookmark, Loader2, Trash2, GraduationCap, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/learn/saved")({
  head: () => ({ meta: [{ title: "Saved — Mybrainpadi" }] }),
  component: SavedPage,
});

const TYPE_LABELS: Record<string, string> = {
  subject: "Subject",
  past_question: "Question",
  study_plan: "Study plan",
  learning_path: "Learning path",
};

function SavedPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const savedFn = useServerFn(getSavedItems);
  const unsaveFn = useServerFn(unsaveItem);

  const { data: items, isLoading } = useQuery({
    queryKey: ["saved-items"],
    queryFn: () => savedFn(),
  });

  const unsaveMutation = useMutation({
    mutationFn: (item: SavedItem) =>
      unsaveFn({ data: { item_type: item.item_type, item_id: item.item_id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      toast.success("Removed");
    },
    onError: (e) => toast.error(String(e)),
  });

  const practice = (item: SavedItem) => {
    const m = item.metadata as Record<string, any>;
    if (item.item_type === "subject" && m.category === "university") {
      navigate({
        to: "/learn/past-questions",
        search: { category: "university", university: m.university ?? undefined, course: m.course },
      });
    } else if (item.item_type === "subject" && m.subject) {
      navigate({
        to: "/learn/past-questions",
        search: { category: m.category, subject: m.subject },
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
            <h2 className="font-serif text-lg font-bold text-ink">Saved</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your bookmarks</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Discover
            </div>
            <h1 className="font-serif text-3xl text-ink">Saved</h1>
            <p className="text-ink/60 text-sm mt-1">
              Subjects and questions you've bookmarked for later.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-16 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : !items || items.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-10 text-center">
              <Bookmark className="size-6 text-ink/20 mx-auto mb-2" />
              <p className="text-sm text-ink/60">Nothing saved yet.</p>
              <Link
                to="/learn/subjects"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-sage hover:text-verde transition-colors"
              >
                Browse subjects <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const m = (item.metadata ?? {}) as Record<string, any>;
                const title =
                  typeof m.title === "string" && m.title ? m.title : item.item_id;
                const subtitle = typeof m.subtitle === "string" ? m.subtitle : null;
                return (
                  <div
                    key={item.id}
                    className="border border-ink/10 rounded-sm bg-card p-4 flex items-center gap-3"
                  >
                    <Bookmark className="size-4 text-sage shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink truncate">{title}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/40 bg-ink/5 px-1.5 py-0.5 rounded-sm shrink-0">
                          {TYPE_LABELS[item.item_type] ?? item.item_type}
                        </span>
                      </div>
                      {subtitle && (
                        <div className="text-xs text-ink/50 truncate mt-0.5">{subtitle}</div>
                      )}
                    </div>
                    {item.item_type === "subject" && (
                      <button
                        onClick={() => practice(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sage hover:text-verde transition-colors shrink-0"
                      >
                        <GraduationCap className="size-4" /> Practise
                      </button>
                    )}
                    <button
                      onClick={() => unsaveMutation.mutate(item)}
                      disabled={unsaveMutation.isPending}
                      aria-label="Remove"
                      className="size-8 rounded-sm flex items-center justify-center shrink-0 text-ink/40 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
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
