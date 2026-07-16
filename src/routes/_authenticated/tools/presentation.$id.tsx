import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPresentation } from "@/lib/tool-history.functions";
import { exportPresentationDocx } from "@/lib/presentation.functions";
import { Loader2, ArrowLeft, Download, Palette } from "lucide-react";

// ─── Theme presets (shared — keep in sync with presentation.tsx) ────────────

type ThemeKey = "academic-cream" | "professional-navy" | "modern-slate" | "warm-amber";

interface Theme {
  label: string;
  bg: string;
  title: string;
  bullets: string;
  accent: string;
  preview: string;
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

export const Route = createFileRoute("/_authenticated/tools/presentation/$id")({
  head: () => ({ meta: [{ title: "Presentation — Mybrainpadi" }] }),
  component: PresentationDetailPage,
});

function PresentationDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getPresentation);
  const exportDocxFn = useServerFn(exportPresentationDocx);
  const [dlBusy, setDlBusy] = useState<"pptx" | "docx" | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("academic-cream");

  const { data, isLoading } = useQuery({
    queryKey: ["presentation", id],
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
        <p className="text-ink/40 text-sm">Presentation not found.</p>
        <Link to="/tools/history" className="text-sage text-sm hover:underline mt-2 inline-block">
          ← Back to history
        </Link>
      </div>
    );
  }

  const slides: any[] = typeof data.slides === "string" ? JSON.parse(data.slides) : data.slides;
  const topic = data.topic || "Presentation";
  const activeTheme = THEMES[theme];

  const download = async (format: "pptx" | "docx") => {
    if (!slides?.length) return;
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
        slides.forEach((slide: any, i: number) => {
          const s = pptx.addSlide();
          s.background = { color: activeTheme.bg };
          s.addText(slide.title, {
            x: 0.5, y: 0.3, w: 9.0, h: 0.9, fontSize: 24, bold: true, color: activeTheme.title,
          });
          s.addText((slide.bullets ?? []).map((b: string) => `• ${b}`).join("\n"), {
            x: 0.5, y: 1.4, w: 9.0, h: 5.2, fontSize: 16, color: activeTheme.bullets,
            lineSpacing: 24, valign: "top",
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
        a.download = `${(topic || "presentation").replace(/[^a-zA-Z0-9\- ]/g, "_").replace(/\s+/g, "_")}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const base64 = await exportDocxFn({
          data: { topic, slides },
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
    } catch (e: any) {
      console.error("Download failed:", e?.message ?? e);
    } finally {
      setDlBusy(null);
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
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">Presentation</div>
        <h1 className="font-serif text-2xl mb-2">{topic}</h1>
        <p className="text-xs text-ink/40">
          {new Date(data.created_at).toLocaleString()} · {data.slide_count} slides
        </p>
      </div>

      {/* ─── Theme Selector ─── */}
      <div className="mb-5">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 flex items-center gap-1 mb-1">
          <Palette className="size-2.5" /> Slide Theme
        </label>
        <div className="flex gap-1.5">
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

      {slides?.length > 0 && (
        <>
          <div className="space-y-4">
            {slides.map((slide: any, i: number) => (
              <div
                key={i}
                className="border border-ink/10 rounded-sm p-5"
                style={{ backgroundColor: `#${activeTheme.bg}` }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: `#${activeTheme.accent}` }}
                >
                  Slide {i + 1} of {slides.length}
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: `${activeTheme.bullets}60` }}>Speaker Notes</p>
                    <p className="text-xs italic" style={{ color: `#${activeTheme.bullets}80` }}>
                      {slide.speaker_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
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
          </div>
        </>
      )}
    </div>
  );
}
