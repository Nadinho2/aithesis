import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMyCertificates, type Certificate } from "@/lib/certificates.functions";
import { ArrowLeft, Award, ExternalLink, Loader2, Share2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/learn/certificates")({
  head: () => ({ meta: [{ title: "My Certificates — Mybrainpadi" }] }),
  component: CertificatesPage,
});

const KIND_LABELS: Record<string, string> = {
  subject_mastery: "Subject mastery",
  path_completion: "Path completion",
};

function CertificatesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const certsFn = useServerFn(getMyCertificates);
  const { data, isLoading } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => certsFn(),
  });

  const certificates = data?.certificates ?? [];

  function shareUrl(cert: Certificate): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/certificate/${cert.id}`;
  }

  function shareToLinkedIn(cert: Certificate) {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl(cert))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

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
            <h2 className="font-serif text-lg font-bold text-ink">My Certificates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Earned for real progress</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Learn · Self learning
            </div>
            <h1 className="font-serif text-3xl text-ink">My Certificates</h1>
            <p className="text-ink/60 text-sm mt-1">
              Shareable proof of what you've mastered — earned by practice scores and completed
              paths, not passive viewing.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink/50 py-16 justify-center">
              <Loader2 className="size-4 animate-spin" /> Checking your progress…
            </div>
          ) : certificates.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-10 text-center">
              <Award className="size-6 text-ink/20 mx-auto mb-2" />
              <p className="text-sm text-ink/60">No certificates yet.</p>
              <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">
                Keep practicing in the Past Questions Bank and completing lessons to earn your
                first one.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {certificates.map((cert: Certificate) => (
                <div key={cert.id} className="border border-ink/10 rounded-sm bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-sage bg-sage/10 px-1.5 py-0.5 rounded-sm">
                        {KIND_LABELS[cert.kind] ?? cert.kind}
                      </span>
                      <p className="text-sm font-medium text-ink mt-1.5">{cert.title}</p>
                      {cert.subtitle && (
                        <p className="text-xs text-ink/50 mt-0.5">{cert.subtitle}</p>
                      )}
                      <p className="text-xs text-ink/40 mt-1">
                        Issued {format(new Date(cert.issued_at), "d MMM yyyy")}
                      </p>
                      {cert.ai_note && (
                        <p className="text-xs text-ink/60 italic mt-2 border-t border-ink/10 pt-2">
                          "{cert.ai_note}"
                        </p>
                      )}
                    </div>
                    <Award className="size-5 text-sage shrink-0 mt-0.5" />
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <a
                      href={shareUrl(cert)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-medium bg-ink text-bone rounded-sm hover:bg-sage transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="size-3.5" /> View
                    </a>
                    <button
                      onClick={() => shareToLinkedIn(cert)}
                      className="px-3 py-1.5 text-xs font-medium border border-ink/15 rounded-sm hover:bg-ink/5 flex items-center gap-1.5"
                    >
                      <Share2 className="size-3.5" /> Share on LinkedIn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
