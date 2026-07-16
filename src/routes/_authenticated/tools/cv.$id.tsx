import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCv } from "@/lib/tool-history.functions";
import { exportCvDocx } from "@/lib/cv.functions";
import { Loader2, ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/cv/$id")({
  head: () => ({ meta: [{ title: "CV — Mybrainpadi" }] }),
  component: CvDetailPage,
});

function CvDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getCv);
  const exportFn = useServerFn(exportCvDocx);
  const [dlBusy, setDlBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cv", id],
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
        <p className="text-ink/40 text-sm">CV not found.</p>
        <Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  const cvData = typeof data.cv_data === "string" ? JSON.parse(data.cv_data) : data.cv_data;

  // Parse enhanced data for display (prefer enhanced over raw cv_data)
  const cv = (() => {
    if (data.enhanced) {
      try {
        return typeof data.enhanced === "string" ? JSON.parse(data.enhanced) : data.enhanced;
      } catch {
        return cvData;
      }
    }
    return cvData;
  })();

  const download = async () => {
    setDlBusy(true);
    try {
      const base64 = await exportFn({
        data: { info: cvData ?? {}, enhanced: data.enhanced || JSON.stringify(cvData), headshot: undefined },
      });
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "cv.docx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDlBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/history"
        className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to history
      </Link>

      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">CV</div>
        <h1 className="font-serif text-2xl mb-2">{cv?.full_name || "CV"}</h1>
        <p className="text-xs text-ink/40">{new Date(data.created_at).toLocaleString()}</p>
      </div>

      <div className="bg-card border border-ink/10 rounded-sm p-5">
        {cv && (
          <div className="space-y-6">
            {/* Personal Info */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Personal Details</h2>
              <div className="text-sm space-y-1 text-ink/70">
                {cv.full_name && <p><span className="font-medium">Name:</span> {cv.full_name}</p>}
                {cv.email && <p><span className="font-medium">Email:</span> {cv.email}</p>}
                {cv.phone && <p><span className="font-medium">Phone:</span> {cv.phone}</p>}
                {cv.address && <p><span className="font-medium">Address:</span> {cv.address}</p>}
              </div>
            </div>

            {/* Summary */}
            {cv.summary && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Professional Summary</h2>
                <p className="text-sm text-ink/70 whitespace-pre-wrap">{cv.summary}</p>
              </div>
            )}

            {/* Education — stored as multi-line string, split for display */}
            {cv.education && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Education</h2>
                <ul className="text-sm text-ink/70 space-y-1">
                  {cv.education.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                    <li key={i}>— {line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Experience — stored as multi-line string */}
            {cv.experience && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Experience</h2>
                <ul className="text-sm text-ink/70 space-y-2">
                  {cv.experience.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                    <li key={i} className="whitespace-pre-wrap">— {line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills — stored as comma-separated string */}
            {cv.skills && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Skills</h2>
                <div className="flex flex-wrap gap-1.5">
                  {cv.skills.split(/[,、]\s*/).filter(Boolean).map((skill: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-ink/5 rounded-sm text-xs text-ink/70">{skill.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {cv.certifications && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Certifications</h2>
                <ul className="text-sm text-ink/70 space-y-1">
                  {cv.certifications.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                    <li key={i}>— {line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Languages */}
            {cv.languages && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Languages</h2>
                <ul className="text-sm text-ink/70 space-y-1">
                  {cv.languages.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                    <li key={i}>— {line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={download}
          disabled={dlBusy}
          className="px-4 py-2 bg-ink text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {dlBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download .docx
        </button>
      </div>
    </div>
  );
}
