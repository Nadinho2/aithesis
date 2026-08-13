import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { useIsMobile } from "@/hooks/use-mobile";
import { Users, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community/$")({
  component: CommunityCatchAllPage,
});

function CommunityCatchAllPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/community" })}
            aria-label="Back to Community"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Community</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Connect and grow</p>
          </div>
        </div>
      )}
      <ComingSoon
        title="Community is on the way"
        description="University feeds, study groups, mentorship matching, and a student marketplace are coming soon. We'll notify you the moment Community goes live."
        icon={Users}
        notifyEnabled={true}
        featureName="community"
      />
    </div>
  );
}
