import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generatePresentation, exportPresentationDocx } from "@/lib/presentation.functions";
import { checkAccess, markTransactionUsed } from "@/lib/payment.functions";
import { saveFormBeforePay } from "@/lib/usePaymentCallback";
import { Loader2, Upload, Download, X, Sparkles, FileText, ImageIcon, Info, Palette } from "lucide-react";
import { toast } from "sonner";

// ─── Theme presets ──────────────────────────────────────────────────────────

type ThemeKey = "academic-cream" | "professional-navy" | "modern-slate" | "warm-amber";

interface Theme {
  label: string;
  bg: string;
  title: string;
  bullets: string;
  accent: string;
  preview: string; // tailwind gradient for the swatch
}

const THEMES: Record<ThemeKey, Theme> = {
  "academic-cream": {
    label: "Academic Cream",
    bg: "F5F0EB",
    title: "1A1A1A",
    bullets: "4A4A4A",
    accent: "2D5A27",
    preview: "bg-[#F5F0EB] ring-1 ring-ink/20",
  },
  "professional-navy": {
    label: "Professional Navy",
    bg: "1A2332",
    title: "FFFFFF",
    bullets: "B0C4DE",
    accent: "3B82F6",
    preview: "bg-[#1A2332] ring-1 ring-white/20",
  },
  "modern-slate": {
    label: "Modern Slate",
    bg: "2D3748",
    title: "FFFFFF",
    bullets: "CBD5E0",
    accent: "48BB78",
    preview: "bg-[#2D3748] ring-1 ring-white/20",
  },
  "warm-amber": {
    label: "Warm Amber",
    bg: "FFF8F0",
    title: "3D2B1F",
    bullets: "6B5B4F",
    accent: "D97706",
    preview: "bg-[#FFF8F0] ring-1 ring-ink/20",
  },
};

export const Route = createFileRoute("/_authenticated/tools/presentation")({
  head: () => ({ meta: [{ title: "Presentation Assistant — Mybrainpadi" }] }),
  component: PresentationPage,
});

function PresentationPage() {
  // If a child route is matched (detail page), render Outlet
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  if (pathname !== "/tools/presentation") return <Outlet />;
  const genFn = useServerFn(generatePresentation);
  const exportDocxFn = useServerFn(exportPresentationDocx);
  const checkAccessFn = useServerFn(checkAccess);
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [slideCount, setSlideCount] = useState(10);
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const [theme, setTheme] = useState<ThemeKey>("academic-cream");
  const [docFile, setDocFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [imageFile, setImageFile] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ slides: any[] } | null>(null);
  const [dlBusy, setDlBusy] = useState<"pptx" | "docx" | null>(null);
  const navigate = useNavigate();

  const activeTheme = THEMES[theme];

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          topic: inputMode === "text" ? topic : "Image-based Presentation",
          content: inputMode === "text" ? content : "",
          slide_count: slideCount,
          ...(docFile ? { file_base64: docFile.base64, file_mime: docFile.mime, file_name: docFile.name } : {}),
          ...(imageFile ? { image_base64: `data:${imageFile.mime};base64,${imageFile.base64}` } : {}),
        },
      }),
    onSuccess: (data) => {
      // Handle server-side PAYMENT_REQUIRED rejection
      const d = data as any;
      if (d?.code === "PAYMENT_REQUIRED") {
        saveFormBeforePay({ topic, content, slideCount });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
      setResult(d);
      markUsedFn({ data: { product: "presentation" } }).catch(() => {});
    },
    onError: (e) => toast.error(String(e)),
  });

  const markUsedFn = useServerFn(markTransactionUsed);

  const switchMode = (mode: "text" | "image") => {
    setInputMode(mode);
    if (mode === "image") {
      setTopic("");
      setContent("");
      setDocFile(null);
    } else {
      setImageFile(null);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (!allowed.includes(f.type)) {
      toast.error("Only PDF, DOCX, and TXT files are supported.");
      return;
    }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setDocFile({ base64: b64, mime: f.type, name: f.name });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(f);
    });
    setImageFile({ base64: b64, mime: f.type, name: f.name });
  };

  const download = async (format: "pptx" | "docx") => {
    if (!result) return;
    setDlBusy(format);
    try {
      if (format === "pptx") {
        const PptxGenJS = (await import("pptxgenjs")).default;
        const pptx = new PptxGenJS();

        // Cover slide
        const cover = pptx.addSlide();
        cover.background = { color: activeTheme.bg };
        cover.addText(topic, {
          x: 1.0, y: 2.0, w: 8.0, h: 1.5, fontSize: 36, bold: true,
          color: activeTheme.title, align: "center",
        });
        cover.addText(
          new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          { x: 1.0, y: 3.5, w: 8.0, h: 0.5, fontSize: 14, color: activeTheme.accent, align: "center" },
        );
        cover.addText("by Mybrainpadi", {
          x: 1.0, y: 6.5, w: 8.0, h: 0.4, fontSize: 10, color: activeTheme.bullets, align: "center",
        });

        // Content slides
        result.slides.forEach((slide: any, i: number) => {
          const s = pptx.addSlide();
          s.background = { color: activeTheme.bg };
          s.addText(slide.title, {
            x: 0.5, y: 0.3, w: 9.0, h: 0.9, fontSize: 24, bold: true, color: activeTheme.title,
          });
          s.addText(slide.bullets ?? [], {
            x: 0.5, y: 1.4, w: 9.0, h: 5.2, fontSize: 16, color: activeTheme.bullets,
            lineSpacing: 24, bullet: true, valign: "top",
          });
          // Slide number
          s.addText(`${i + 1}`, {
            x: 9.3, y: 6.9, w: 0.5, h: 0.3, fontSize: 9, color: activeTheme.accent, align: "right",
          });
          // Speaker notes
          if (slide.speaker_notes) {
            try { (s as any).addNotes?.(slide.speaker_notes); } catch { /* ignore */ }
          }
        });
        const blob = (await pptx.write({ outputType: "blob" })) as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${topic.replace(/\s+/g, "_")}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const base64 = await exportDocxFn({
          data: { topic, slides: result.slides },
        });
        const url = URL.createObjectURL(
          new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${topic.replace(/\s+/g, "_")}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDlBusy(null);
    }
  };

  const submit = async () => {
    if (inputMode === "text") {
      if (!topic.trim() && !content.trim() && !docFile) {
        toast.error("Enter a presentation topic, paste content, or upload a document.");
        return;
      }
    } else {
      if (!imageFile) {
        toast.error("Please upload an image with your presentation content.");
        return;
      }
    }
    try {
      const access = await checkAccessFn({ data: { product: "presentation" } });
      if (!access.allowed) {
        saveFormBeforePay({ topic, content, slideCount });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
    } catch {
      saveFormBeforePay({ topic, content, slideCount });
      sessionStorage.setItem("return_path", window.location.pathname);
      navigate({ to: "/billing" });
      setTimeout(() => { window.location.href = "/billing"; }, 300);
      return;
    }
    mut.mutate();
  };

  const handleNewPresentation = () => {
    setResult(null);
    setTopic("");
    setContent("");
    setSlideCount(10);
    setInputMode("text");
    setTheme("academic-cream");
    setDocFile(null);
    setImageFile(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools · ₦3,000
        </div>
        <h1 className="font-serif text-3xl">Presentation Assistant</h1>
        <p className="text-ink/60 text-sm mt-1">
          Create presentation slides from your content. Download as PowerPoint or DOCX.
        </p>
      </div>

      {/* ─── Input Mode Announcement ─── */}
      <div className="mb-5 flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
        <Info className="size-4 mt-0.5 shrink-0" />
        <p>
          Choose <strong>one input method at a time</strong> — either type / upload a document
          <em>or</em> upload an image. This keeps processing focused and delivers faster results.
        </p>
      </div>

      {!result ? (
        <div className="space-y-5">
          {/* ─── Mode Toggle ─── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchMode("text")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                inputMode === "text"
                  ? "bg-ink text-bone border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-ink/5"
              }`}
            >
              <FileText className="size-3.5" />
              Text / Document
            </button>
            <button
              onClick={() => switchMode("image")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                inputMode === "image"
                  ? "bg-ink text-bone border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-ink/5"
              }`}
            >
              <ImageIcon className="size-3.5" />
              Upload Image
            </button>
          </div>

          {/* ─── Text Mode ─── */}
          {inputMode === "text" && (
            <>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Presentation topic"
                className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content / notes here…"
                rows={5}
                className="w-full bg-card border border-ink/15 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-sage resize-y"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => docRef.current?.click()}
                  className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
                >
                  <Upload className="size-3.5" />
                  {docFile ? docFile.name : "Upload notes (PDF/DOCX/TXT)"}
                </button>
                {docFile && (
                  <button
                    onClick={() => setDocFile(null)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <input
                  ref={docRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleDocUpload}
                  className="hidden"
                />
              </div>
            </>
          )}

          {/* ─── Image Mode ─── */}
          {inputMode === "image" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => imgRef.current?.click()}
                  className="flex items-center gap-2 text-xs px-4 py-2 border border-ink/15 rounded-sm hover:bg-ink/5"
                >
                  <Upload className="size-3.5" />
                  {imageFile ? "Change image" : "Upload image of your content"}
                </button>
                {imageFile && (
                  <button
                    onClick={() => setImageFile(null)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              {imageFile && (
                <div className="border border-ink/10 rounded-sm overflow-hidden max-w-md">
                  <img
                    src={`data:${imageFile.mime};base64,${imageFile.base64}`}
                    alt="Uploaded preview"
                    className="w-full h-auto max-h-64 object-contain bg-white"
                  />
                  <p className="text-[10px] text-ink/40 px-2 py-1 border-t border-ink/5 truncate">
                    {imageFile.name}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Number of Slides (5–30)
              </label>
              <input
                type="number"
                min={5}
                max={30}
                value={slideCount}
                onChange={(e) => setSlideCount(Math.min(30, Math.max(5, Number(e.target.value))))}
                className="mt-1 w-32 bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm"
              />
            </div>

            {/* ─── Theme Selector ─── */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 flex items-center gap-1">
                <Palette className="size-2.5" /> Slide Theme
              </label>
              <div className="mt-1 flex gap-1.5">
                {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
                  const t = THEMES[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      title={t.label}
                      className={`w-7 h-7 rounded-sm border-2 transition-all ${t.preview} ${
                        theme === key
                          ? "border-sage scale-110 shadow-sm"
                          : "border-transparent hover:scale-105"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-ink/40 mt-0.5">{activeTheme.label}</p>
            </div>
          </div>

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
                <Sparkles className="size-4" /> Generate Slides
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ─── Theme preview banner ─── */}
          <div className="flex items-center gap-2 text-xs text-ink/40">
            <Palette className="size-3" />
            <span>Theme: <span className="font-medium text-ink/60">{activeTheme.label}</span></span>
          </div>

          {result.slides.map((slide: any, i: number) => (
            <div
              key={i}
              className="border border-ink/10 rounded-sm p-5"
              style={{ backgroundColor: `#${activeTheme.bg}` }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: `#${activeTheme.accent}` }}
              >
                Slide {i + 1}
              </div>
              <h3 className="font-serif text-lg mb-3" style={{ color: `#${activeTheme.title}` }}>
                {slide.title}
              </h3>
              <ul className="space-y-1 text-sm" style={{ color: `#${activeTheme.bullets}` }}>
                {(slide.bullets ?? []).map((b: string, j: number) => (
                  <li key={j}>• {b}</li>
                ))}
              </ul>
              {slide.speaker_notes && (
                <div className="mt-3 pt-3" style={{ borderTopColor: `#${activeTheme.bullets}20` }}>
                  <p className="text-xs italic" style={{ color: `#${activeTheme.bullets}80` }}>
                    {slide.speaker_notes}
                  </p>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => download("pptx")}
              disabled={dlBusy === "pptx"}
              className="px-4 py-2 bg-ink text-bone rounded-sm text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {dlBusy === "pptx" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download PPTX
            </button>
            <button
              onClick={() => download("docx")}
              disabled={dlBusy === "docx"}
              className="px-4 py-2 border border-ink/15 rounded-sm text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {dlBusy === "docx" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download DOCX
            </button>
            <button
              onClick={handleNewPresentation}
              className="px-4 py-2 border border-ink/15 rounded-sm text-sm hover:bg-ink/5"
            >
              New Presentation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
