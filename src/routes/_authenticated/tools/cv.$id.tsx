import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCv } from "@/lib/tool-history.functions";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/cv/$id")({
  head: () => ({ meta: [{ title: "CV — ThesisPro" }] }),
  component: CvDetailPage,
});

function CvDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getCv);

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

  const cv = typeof data.content === "string" ? JSON.parse(data.content) : data.content;

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
        <h1 className="font-serif text-2xl mb-2">
          {cv?.full_name || "CV"} — {cv?.job_title || ""}
        </h1>
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

            {/* Education */}
            {cv.education?.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Education</h2>
                <div className="space-y-2">
                  {cv.education.map((edu: any, i: number) => (
                    <div key={i} className="text-sm text-ink/70">
                      <p className="font-medium">{edu.institution}</p>
                      <p>{edu.degree} — {edu.field}</p>
                      {edu.dates && <p className="text-ink/40">{edu.dates}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {cv.experience?.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Experience</h2>
                <div className="space-y-3">
                  {cv.experience.map((exp: any, i: number) => (
                    <div key={i} className="text-sm text-ink/70">
                      <p className="font-medium">{exp.company}</p>
                      <p>{exp.position}</p>
                      {exp.dates && <p className="text-ink/40 text-xs">{exp.dates}</p>}
                      {exp.description && <p className="text-xs text-ink/60 mt-1 whitespace-pre-wrap">{exp.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {cv.skills?.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/40 mb-2">Skills</h2>
                <div className="flex flex-wrap gap-1.5">
                  {cv.skills.map((skill: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-ink/5 rounded-sm text-xs text-ink/70">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
