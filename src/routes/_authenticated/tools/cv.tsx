import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateCv, exportCvDocx } from "@/lib/cv.functions";
import { checkAccess } from "@/lib/payment.functions";
import { PaymentModal } from "@/components/PaymentModal";
import {
  Loader2,
  Upload,
  Download,
  Sparkles,
  UserSquare2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/cv")({
  head: () => ({ meta: [{ title: "CV Maker — ThesisPro" }] }),
  component: CvPage,
});

function CvPage() {
  const genFn = useServerFn(generateCv);
  const exportFn = useServerFn(exportCvDocx);
  const checkAccessFn = useServerFn(checkAccess);
  const [file, setFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [headshot, setHeadshot] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
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

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          ...(file
            ? { file_base64: file.base64, file_mime: file.mime, file_name: file.name }
            : {}),
          headshot_base64: headshot ?? undefined,
          ...(useForm || !file ? { manual } : {}),
        },
      }),
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(String(e)),
  });

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
    try {
      const access = await checkAccessFn({ data: { product: "cv" } });
      if (!access.allowed) {
        setShowPayment(true);
        return;
      }
    } catch {}
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

          {(useForm || (!file && useForm)) && (
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

          <button
            onClick={submit}
            disabled={mut.isPending}
            className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Generate CV
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
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {result.enhanced}
            </pre>
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
              }}
              className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5"
            >
              New CV
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        product="cv"
        onPaid={() => {
          setShowPayment(false);
          mut.mutate();
        }}
      />
    </div>
  );
}
