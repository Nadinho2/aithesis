import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSeminar } from "@/lib/tool-history.functions";
import { seminarTypeLabel } from "@/lib/pricing";
import { Loader2, ArrowLeft, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/seminar/$id")({
  head: () => ({ meta: [{ title: "Seminar Paper — Mybrainpadi" }] }),
  component: SeminarDetailPage,
});

function SeminarDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getSeminar);

  const { data, isLoading, error } = useQuery({
    queryKey: ["seminar", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-ink/40 text-sm">Seminar not found or you don't have access.</p>
        <Link to="/tools/history" className="text-sm text-sage hover:underline mt-2 inline-block">
          Back to History
        </Link>
      </div>
    );
  }

  const seminar = data as any;
  const sections: Record<string, string> = typeof seminar.sections === "string"
    ? JSON.parse(seminar.sections)
    : (seminar.sections ?? {});

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link
          to="/tools/history"
          className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" /> Back to History
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools
        </div>
        <h1 className="font-serif text-2xl">{seminar.title}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="px-2 py-0.5 bg-sage/10 text-sage text-[10px] font-bold uppercase rounded-sm">
            {seminarTypeLabel(seminar.seminar_type)}
          </span>
          <span className="text-xs text-ink/40 capitalize">{seminar.academic_level}</span>
          <span className="text-xs text-ink/40">{seminar.word_count?.toLocaleString() ?? 0} words</span>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(sections).map(([key, content]) => {
          const displayContent = String(content ?? "");
          if (!displayContent.trim()) return null;
          return (
            <div key={key} className="bg-card border border-ink/10 rounded-sm p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-3">
                {key}
              </h3>
              <div className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed">
                {displayContent}
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(sections).length === 0 && (
        <div className="text-center py-16 border border-ink/10 rounded-sm">
          <BookOpen className="mx-auto size-8 text-ink/20 mb-3" />
          <p className="text-ink/40 text-sm">No content available for this seminar.</p>
        </div>
      )}
    </div>
  );
}
