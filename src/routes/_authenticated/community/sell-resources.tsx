import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { useIsMobile } from "@/hooks/use-mobile";
import { Briefcase, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community/sell-resources")({
  component: SellResourcesPage,
});

function SellResourcesPage() {
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
            <h2 className="font-serif text-lg font-bold text-ink">Sell resources</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Marketplace</p>
          </div>
        </div>
      )}
      <ComingSoon
        title="Marketplace is on the way"
        description="Buying and selling study resources between students is coming soon. We'll notify you the moment the marketplace goes live."
        icon={Briefcase}
        notifyEnabled={true}
        featureName="marketplace"
      />
    </div>
  );
}
