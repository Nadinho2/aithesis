import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateCv, exportCvDocx } from "@/lib/cv.functions";
import { checkAccess, markTransactionUsed } from "@/lib/payment.functions";
import { saveFormBeforePay } from "@/lib/usePaymentCallback";
import {
  Loader2,
  Upload,
  Download,
  Sparkles,
  UserSquare2,
  Camera,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/cv")({
  head: () => ({ meta: [{ title: "CV Maker — Mybrainpadi" }] }),
  component: CvPage,
});

function CvPage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  if (pathname !== "/tools/cv") return <Outlet />;

  const genFn = useServerFn(generateCv);
  const exportFn = useServerFn(exportCvDocx);
  const checkAccessFn = useServerFn(checkAccess);
  const [file, setFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [headshot, setHeadshot] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const navigate = useNavigate();
  const [manual, setManual] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    summary: "",
    education: "",
    experience: "",
    skills: "",
    certifications: "",
    languages: "",
  });
  const [useForm, setUseForm] = useState(false);

  // ── Job tailoring state ──
  const [tailorMode, setTailorMode] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          ...(file
            ? { file_base64: file.base64, file_mime: file.mime, file_name: file.name }
            : {}),
          headshot_base64: headshot ?? undefined,
          ...(useForm && !file ? { manual } : {}),
          // Job tailoring
          ...(tailorMode && jobDescription.trim() ? {
            tailor_mode: true,
            job_description: jobDescription,
            ...(jobTitle.trim() ? { job_title: jobTitle } : {}),
            ...(company.trim() ? { company } : {}),
          } : {}),
        },
      }),
    onSuccess: (data) => {
      const d = data as any;
      if (d?.code === "PAYMENT_REQUIRED") {
        saveFormBeforePay({ manual, useForm, tailorMode, jobDescription, jobTitle, company });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
      setResult(d);
      markUsedFn({ data: { product: "cv" } }).catch(() => {});
    },
    onError: (e) => toast.error(String(e)),
  });

  const markUsedFn = useServerFn(markTransactionUsed);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      ![
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
      ].includes(f.type)
    ) {
      toast.error("Only PDF and DOCX files are supported.");
      return;
    }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setFile({ base64: b64, mime: f.type, name: f.name });
    setUseForm(false);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(f);
    });
    setHeadshot(b64);
  };

  const submit = async () => {
    if (!file && !useForm) {
      toast.error("Upload a CV or fill the form.");
      return;
    }
    if (tailorMode && jobDescription.trim().length < 50) {
      toast.error("Paste a job description (at least 50 characters) to tailor your CV.");
      return;
    }
    try {
      const access = await checkAccessFn({ data: { product: "cv" } });
      if (!access.allowed) {
        saveFormBeforePay({ manual, useForm, tailorMode, jobDescription, jobTitle, company });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
    } catch {
      saveFormBeforePay({ manual, useForm, tailorMode, jobDescription, jobTitle, company });
      sessionStorage.setItem("return_path", window.location.pathname);
      navigate({ to: "/billing" });
      setTimeout(() => { window.location.href = "/billing"; }, 300);
      return;
    }
    mut.mutate();
  };

  const download = async () => {
    if (!result) return;
    setDlBusy(true);
    try {
      const base64 = await exportFn({
        data: { info: result.info, enhanced: result.enhanced, headshot: result.headshot ?? undefined },
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

  // Parse enhanced JSON for formatted display
  const parsedEnhanced = (() => {
    if (!result?.enhanced) return null;
    try {
      return typeof result.enhanced === "string" ? JSON.parse(result.enhanced) : result.enhanced;
    } catch {
      return null;
    }
  })();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools · ₦3,000
        </div>
        <h1 className="font-serif text-3xl">CV Maker</h1>
        <p className="text-ink/60 text-sm mt-1">
          Upload your existing CV to auto-fill, or use the form. We'll rewrite and format it
          professionally.
        </p>
      </div>

      {!result ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
            >
              <Upload className="size-4" />
              {file ? file.name : "Upload existing CV (PDF/DOCX)"}
            </button>
            <button
              onClick={() => {
                setUseForm(true);
                setFile(null);
              }}
              className="flex items-center gap-2 text-sm px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
            >
              <UserSquare2 className="size-4" /> Fill form manually
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => photoRef.current?.click()}
              className="flex items-center gap-2 text-xs px-3 py-1.5 border border-ink/15 rounded-sm hover:bg-ink/5"
            >
              <Camera className="size-3.5" />
              {headshot ? "Change photo" : "Add headshot"}
            </button>
            {headshot && (
              <img
                src={headshot}
                alt="headshot"
                className="size-10 rounded-full object-cover"
              />
            )}
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="hidden"
            />
          </div>

          {useForm && (
            <div className="grid sm:grid-cols-2 gap-4">
              {Object.entries(manual).map(([k, v]) => (
                <div
                  key={k}
                  className={
                    ["summary", "education", "experience", "skills", "certifications"].includes(k)
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    {k.replace(/_/g, " ")}
                  </label>
                  {["summary", "education", "experience", "skills"].includes(k) ? (
                    <textarea
                      value={v}
                      onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                      rows={4}
                      className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
                    />
                  ) : (
                    <input
                      value={v}
                      onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                      className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── Job Tailoring ─── */}
          <div className="border border-ink/10 rounded-sm p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tailorMode}
                onChange={(e) => setTailorMode(e.target.checked)}
                className="size-4 rounded accent-sage"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Target className="size-3.5" /> Target a specific job
              </span>
            </label>

            {tailorMode && (
              <div className="space-y-3 pl-6 border-l-2 border-sage/30">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                      Job Title
                    </label>
                    <input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Product Manager"
                      className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                      Company (optional)
                    </label>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Flutterwave"
                      className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Job Description
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here… (minimum 50 characters)"
                    rows={6}
                    className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
                  />
                  <p className="text-[10px] text-ink/40 mt-1">
                    {jobDescription.length} / 50 characters minimum
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={submit}
            disabled={mut.isPending}
            className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {tailorMode ? "Tailoring…" : "Generating…"}
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> {tailorMode ? "Tailor CV for Job" : "Generate CV"}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-ink/10 rounded-sm p-6">
            {result.headshot && (
              <img
                src={result.headshot}
                className="size-20 rounded-full object-cover mb-4"
                alt="headshot"
              />
            )}

            {parsedEnhanced ? (
              <div className="space-y-6">
                {/* Name + Contact */}
                <div className="text-center">
                  <h2 className="font-serif text-2xl">{parsedEnhanced.full_name}</h2>
                  <p className="text-sm text-ink/60 mt-1">
                    {[parsedEnhanced.email, parsedEnhanced.phone, parsedEnhanced.address].filter(Boolean).join(" · ")}
                  </p>
                  {tailorMode && (
                    <p className="text-[10px] text-sage mt-1 font-medium">
                      Tailored for {jobTitle || "target role"}{company ? ` at ${company}` : ""}
                    </p>
                  )}
                </div>

                {/* Summary */}
                {parsedEnhanced.summary && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1.5">Professional Summary</h3>
                    <p className="text-sm text-ink/70 whitespace-pre-wrap">{parsedEnhanced.summary}</p>
                  </div>
                )}

                {/* Education */}
                {parsedEnhanced.education && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1.5">Education</h3>
                    <ul className="text-sm text-ink/70 space-y-0.5">
                      {parsedEnhanced.education.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                        <li key={i} className="before:content-['—'] before:mr-2 before:text-ink/30">{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Experience */}
                {parsedEnhanced.experience && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1.5">Experience</h3>
                    <ul className="text-sm text-ink/70 space-y-1">
                      {parsedEnhanced.experience.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                        <li key={i} className="before:content-['—'] before:mr-2 before:text-ink/30">{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Skills */}
                {parsedEnhanced.skills && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1.5">Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedEnhanced.skills.split(/[,、]\s*/).filter(Boolean).map((skill: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-ink/5 rounded-sm text-xs text-ink/70">{skill.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {parsedEnhanced.certifications && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1.5">Certifications</h3>
                    <ul className="text-sm text-ink/70 space-y-0.5">
                      {parsedEnhanced.certifications.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                        <li key={i} className="before:content-['—'] before:mr-2 before:text-ink/30">{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Languages */}
                {parsedEnhanced.languages && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40 mb-1.5">Languages</h3>
                    <ul className="text-sm text-ink/70 space-y-0.5">
                      {parsedEnhanced.languages.split(/\n/).filter(Boolean).map((line: string, i: number) => (
                        <li key={i} className="before:content-['—'] before:mr-2 before:text-ink/30">{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {result.enhanced}
              </pre>
            )}
          </div>
          <div className="flex gap-3">
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
            <button
              onClick={() => {
                setResult(null);
                setFile(null);
                setHeadshot(null);
                setUseForm(false);
                setManual({
                  full_name: "",
                  email: "",
                  phone: "",
                  address: "",
                  summary: "",
                  education: "",
                  experience: "",
                  skills: "",
                  certifications: "",
                  languages: "",
                });
                setTailorMode(false);
                setJobDescription("");
                setJobTitle("");
                setCompany("");
              }}
              className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5"
            >
              New CV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
