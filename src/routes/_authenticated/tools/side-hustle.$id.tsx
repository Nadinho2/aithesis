import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSideHustle } from "@/lib/tool-history.functions";
import { Loader2, ArrowLeft, Zap, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/side-hustle/$id")({
  head: () => ({ meta: [{ title: "Side Hustle — ThesisPro" }] }),
  component: SideHustleDetailPage,
});

function SideHustleDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getSideHustle);

  const { data, isLoading } = useQuery({
    queryKey: ["side-hustle", id],
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
        <p className="text-ink/40 text-sm">Side hustle not found.</p>
        <Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  const suggestions = typeof data.suggestions === "string" ? JSON.parse(data.suggestions) : data.suggestions;
  const answers = typeof data.answers === "string" ? JSON.parse(data.answers) : data.answers;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/history"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Side Hustle Finder</div>
        <h1 className="font-serif text-2xl mb-2">Your Side Hustle Ideas</h1>
        <p className="text-xs text-ink/40">{new Date(data.created_at).toLocaleString()}</p>
      </div>

      {/* Summary */}
      {suggestions?.summary && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-purple-100">
              <TrendingUp className="size-5 text-purple-600" />
            </div>
            <h2 className="font-serif text-lg">Your Profile Summary</h2>
          </div>
          <p className="text-sm text-ink/70 leading-relaxed">{suggestions.summary}</p>
        </div>
      )}

      {/* Suggestions */}
      <div className="space-y-4 mb-6">
        {suggestions?.suggestions?.map((item: any, i: number) => (
          <div key={i} className="bg-card border border-ink/10 rounded-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${
                    item.difficulty === "Beginner"
                      ? "bg-green-100"
                      : item.difficulty === "Intermediate"
                        ? "bg-amber-100"
                        : "bg-red-100"
                  }`}
                >
                  <Zap
                    className={`size-5 ${
                      item.difficulty === "Beginner"
                        ? "text-green-600"
                        : item.difficulty === "Intermediate"
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="font-serif text-lg">{item.title}</h3>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      item.difficulty === "Beginner"
                        ? "text-green-600"
                        : item.difficulty === "Intermediate"
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {item.difficulty}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-ink/70 leading-relaxed mb-3">{item.description}</p>

            <div className="flex flex-wrap gap-3 mb-3 text-xs">
              <div className="px-2.5 py-1 bg-green-50 border border-green-100 rounded-sm text-green-700 font-medium">
                💰 {item.estimated_earnings}
              </div>
              <div className="px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-sm text-blue-700 font-medium">
                ⏱ {item.time_required}
              </div>
            </div>

            {item.why_fit && (
              <p className="text-xs text-ink/50 italic mb-3">
                <strong>Why it fits you:</strong> {item.why_fit}
              </p>
            )}

            {item.first_steps?.length > 0 && (
              <div className="bg-paper border border-ink/5 rounded-sm p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">First Steps</p>
                <ol className="space-y-1.5">
                  {item.first_steps.map((step: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-ink/60">
                      <span className="size-5 rounded-full bg-ink/5 text-ink/40 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        {j + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User Answers */}
      {answers && (
        <div className="bg-paper border border-ink/10 rounded-sm p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-3">Your Answers</h2>
          <div className="space-y-2 text-sm text-ink/60">
            <p><strong className="text-ink/70">Skills:</strong> {answers.skills}</p>
            <p><strong className="text-ink/70">Interests:</strong> {answers.interests}</p>
            <p><strong className="text-ink/70">Time:</strong> {answers.time}</p>
            <p><strong className="text-ink/70">Goal:</strong> {answers.goal}</p>
            <p><strong className="text-ink/70">Experience:</strong> {answers.experience}</p>
          </div>
        </div>
      )}
    </div>
  );
}
