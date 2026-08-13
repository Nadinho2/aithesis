import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { useIsMobile } from "@/hooks/use-mobile";
import { GraduationCap, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/$")({
  component: LearnCatchAllPage,
});

function LearnCatchAllPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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
            <h2 className="font-serif text-lg font-bold text-ink">Learn</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Grow your skills</p>
          </div>
        </div>
      )}
      <ComingSoon
        title="Learn is on the way"
        description="Micro courses, past questions, and guided learning paths are coming soon. Keep generating great academic work in the meantime — we'll notify you the moment Learn goes live."
        icon={GraduationCap}
        notifyEnabled={true}
        featureName="learn"
      />
    </div>
  );
}
