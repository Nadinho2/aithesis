import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPresentation } from "@/lib/tool-history.functions";
import { Loader2, ArrowLeft, Presentation, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/presentation/$id")({
  head: () => ({ meta: [{ title: "Presentation — ThesisPro" }] }),
  component: PresentationDetailPage,
});

function PresentationDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getPresentation);

  const { data, isLoading } = useQuery({
    queryKey: ["presentation", id],
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
        <p className="text-ink/40 text-sm">Presentation not found.</p>
        <Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  const slides = typeof data.slides === "string" ? JSON.parse(data.slides) : data.slides;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/history"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Presentation</div>
        <h1 className="font-serif text-2xl mb-2">{data.topic}</h1>
        <p className="text-xs text-ink/40">
          {new Date(data.created_at).toLocaleString()} · {data.slide_count} slides
        </p>
      </div>

      {slides?.slides?.length > 0 && (
        <div className="space-y-4">
          {slides.slides.map((slide: any, i: number) => (
            <div key={i} className="bg-card border border-ink/10 rounded-sm p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
                Slide {i + 1} of {slides.slides.length}
              </div>
              <h3 className="font-serif text-lg mb-2">{slide.title}</h3>
              <div className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed">
                {slide.content}
              </div>
              {slide.notes && (
                <div className="mt-3 pt-3 border-t border-ink/5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1">Speaker Notes</p>
                  <p className="text-xs text-ink/50 italic">{slide.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
