import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCertificate } from "@/lib/certificates.functions";
import { Award, Check, Copy, Loader2, Share2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/certificate/$id")({
  head: () => ({
    meta: [
      { title: "Certificate — Mybrainpadi" },
      { name: "description", content: "A Mybrainpadi achievement certificate." },
      { property: "og:title", content: "Mybrainpadi Certificate" },
      { property: "og:description", content: "Shareable proof of real progress on Mybrainpadi." },
    ],
  }),
  component: CertificatePublicPage,
});

function CertificatePublicPage() {
  const { id } = Route.useParams();
  const certFn = useServerFn(getCertificate);
  const [copied, setCopied] = useState(false);

  const { data: cert, isLoading, error } = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => certFn({ data: { id } }),
  });

  function shareUrl(): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/certificate/${id}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function shareToLinkedIn() {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-ink/50 bg-[#faf9f6]">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[#faf9f6]">
        <Award className="size-8 text-ink/20 mb-3" />
        <p className="text-sm text-ink/60">This certificate could not be found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          {/* Certificate card */}
          <div className="bg-white border border-ink/15 rounded-md p-2 shadow-sm">
            <div className="border border-ink/10 rounded-sm px-6 py-10 sm:px-10 sm:py-12 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-sage mb-4">
                mybrainpadi
              </div>

              <div className="font-serif text-2xl sm:text-3xl text-ink">Certificate of Achievement</div>
              <p className="text-xs text-ink/40 uppercase tracking-[0.2em] mt-2">
                {cert.kind === "path_completion" ? "Learning Path Completed" : "Subject Mastery"}
              </p>

              <div className="my-8">
                <p className="text-xs text-ink/40 uppercase tracking-widest">Awarded to</p>
                <p className="font-serif text-3xl sm:text-4xl text-ink mt-2">
                  {cert.recipient_name ?? "Student"}
                </p>
              </div>

              <div className="border-t border-ink/10 pt-6 max-w-sm mx-auto">
                <p className="font-medium text-ink">{cert.title}</p>
                {cert.subtitle && <p className="text-sm text-ink/60 mt-1">{cert.subtitle}</p>}
                {cert.ai_note && (
                  <p className="text-sm text-ink/60 italic mt-3">"{cert.ai_note}"</p>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 mt-8 text-xs text-ink/40">
                <span>{format(new Date(cert.issued_at), "d MMMM yyyy")}</span>
                <span>·</span>
                <span>mybrainpadi.com</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={shareToLinkedIn}
              className="px-4 py-2 text-sm font-medium bg-ink text-bone rounded-sm hover:bg-sage transition-colors flex items-center gap-2"
            >
              <Share2 className="size-4" /> Share on LinkedIn
            </button>
            <button
              onClick={copyLink}
              className="px-4 py-2 text-sm font-medium border border-ink/15 rounded-sm hover:bg-ink/5 flex items-center gap-2"
            >
              {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
