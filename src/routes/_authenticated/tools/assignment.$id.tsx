import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssignment } from "@/lib/tool-history.functions";
import { Loader2, ArrowLeft, FileText, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/assignment/$id")({
  head: () => ({ meta: [{ title: "Assignment — Mybrainpadi" }] }),
  component: AssignmentDetailPage,
});

function AssignmentDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getAssignment);

  const { data, isLoading } = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-ink/40 text-sm">Assignment not found.</p>
        <Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  const result = typeof data.answer === "string" ? JSON.parse(data.answer) : data.answer;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/history"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Assignment</div>
        <h1 className="font-serif text-2xl mb-2 truncate">{data.question}</h1>
        <p className="text-xs text-ink/40">
          {new Date(data.created_at).toLocaleString()} · {data.word_count ?? 0} words
        </p>
      </div>

      <div className="bg-card border border-ink/10 rounded-sm p-5 mb-6">
        <div className="flex items-start gap-2 mb-4">
          <FileText className="size-5 text-verde shrink-0 mt-0.5" />
          <div>
            <h2 className="font-medium text-sm mb-1">Question</h2>
            <p className="text-sm text-ink/70">{data.question}</p>
          </div>
        </div>
      </div>

      {result?.answer && (
        <div className="bg-card border border-ink/10 rounded-sm p-5 mb-6">
          <div className="flex items-start gap-2 mb-4">
            <BookOpen className="size-5 text-verde shrink-0 mt-0.5" />
            <h2 className="font-medium text-sm">Answer</h2>
          </div>
          <div className="prose prose-sm max-w-none text-ink/80 leading-relaxed whitespace-pre-wrap">
            {result.answer}
          </div>
        </div>
      )}

      {result?.references?.length > 0 && (
        <div className="bg-card border border-ink/10 rounded-sm p-5">
          <h2 className="font-medium text-sm mb-3">References ({result.references.length})</h2>
          <div className="space-y-2">
            {result.references.map((ref: any, i: number) => (
              <div key={i} className="text-xs text-ink/60 leading-relaxed pl-3 border-l-2 border-ink/10">
                {ref.citation}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
