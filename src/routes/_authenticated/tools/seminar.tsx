import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkAccess, markTransactionUsed } from "@/lib/payment.functions";
import { generateSeminar } from "@/lib/seminar.functions";
import { getPrice, seminarTypeLabel } from "@/lib/pricing";
import type { ProductType } from "@/lib/pricing";
import { saveFormBeforePay } from "@/lib/usePaymentCallback";
import {
  Loader2, Sparkles, BookOpen, Users, GraduationCap,
  Wrench, BookMarked, Check, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

const SEMINAR_TYPES = [
  {
    key: "seminar_journal" as const,
    label: "Journal / Conference Paper",
    description: "Formal academic paper for conference presentation or journal submission",
    wordCount: "4,000 – 8,000 words",
    referencing: "APA 7th",
    icon: BookOpen,
    price: 3500,
    wordMin: 4000,
    wordMax: 8000,
  },
  {
    key: "seminar_departmental" as const,
    label: "Departmental Seminar Paper",
    description: "Topic-based seminar paper for departmental presentation — no methodology required",
    wordCount: "2,000 – 5,000 words",
    referencing: "APA 7th",
    icon: Users,
    price: 2000,
    wordMin: 2000,
    wordMax: 5000,
  },
  {
    key: "seminar_postgraduate" as const,
    label: "Postgraduate Research Seminar",
    description: "Research plan seminar for Masters or PhD students — presents proposed study",
    wordCount: "3,000 – 6,000 words",
    referencing: "APA 7th",
    icon: GraduationCap,
    price: 2500,
    wordMin: 3000,
    wordMax: 6000,
  },
  {
    key: "seminar_technical" as const,
    label: "Technical / Engineering Seminar",
    description: "Engineering and technology seminar presenting a problem, solution, and implementation plan",
    wordCount: "3,000 – 6,000 words",
    referencing: "IEEE",
    icon: Wrench,
    price: 2500,
    wordMin: 3000,
    wordMax: 6000,
  },
  {
    key: "seminar_book_review" as const,
    label: "Book Review Seminar",
    description: "Critical review and analysis of a book or major academic work",
    wordCount: "1,500 – 3,000 words",
    referencing: "APA 7th",
    icon: BookMarked,
    price: 1500,
    wordMin: 1500,
    wordMax: 3000,
  },
] as const;

const ACADEMIC_LEVELS = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate (Masters)" },
  { value: "phd", label: "PhD" },
] as const;

const SUB_THEME_OPTIONS = [2, 3, 4] as const;

type SeminarTypeKey = (typeof SEMINAR_TYPES)[number]["key"];

export const Route = createFileRoute("/_authenticated/tools/seminar")({
  head: () => ({ meta: [{ title: "Seminar Paper — Mybrainpadi" }] }),
  component: SeminarPage,
});

function SeminarPage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  if (pathname !== "/tools/seminar") return <Outlet />;

  const navigate = useNavigate();
  const checkAccessFn = useServerFn(checkAccess);
  const markUsedFn = useServerFn(markTransactionUsed);
  const genSeminarFn = useServerFn(generateSeminar);

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<SeminarTypeKey | null>(null);
  const [title, setTitle] = useState("");
  const [academicLevel, setAcademicLevel] = useState("undergraduate");
  const [wordCount, setWordCount] = useState(3000);
  const [authorName, setAuthorName] = useState("");
  const [institution, setInstitution] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [numSubThemes, setNumSubThemes] = useState<2 | 3 | 4>(3);

  const sel = SEMINAR_TYPES.find((t) => t.key === selectedType);

  const handleTypeSelect = (type: SeminarTypeKey) => {
    const t = SEMINAR_TYPES.find((s) => s.key === type)!;
    setSelectedType(type);
    setWordCount(t.wordMin);
    setStep(2);
  };

  const handlePay = async () => {
    if (!sel) return;
    if (!title.trim()) { toast.error("Enter a seminar title."); return; }

    try {
      const access = await checkAccessFn({ data: { product: sel.key as ProductType } });
      if (!access.allowed) {
        saveFormBeforePay({
          selectedType, title, academicLevel, wordCount,
          authorName, institution, bookAuthor, numSubThemes,
        });
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
    } catch {
      saveFormBeforePay({
        selectedType, title, academicLevel, wordCount,
        authorName, institution, bookAuthor, numSubThemes,
      });
      sessionStorage.setItem("return_path", window.location.pathname);
      navigate({ to: "/billing" });
      setTimeout(() => { window.location.href = "/billing"; }, 300);
      return;
    }

    // Enqueue generation job
    genMut.mutate();
  };

  const genMut = useMutation({
    mutationFn: async () => {
      if (!sel) throw new Error("No type selected");
      return genSeminarFn({
        data: {
          seminar_type: sel.key,
          title: title.trim(),
          academic_level: academicLevel,
          target_words: wordCount,
          num_sub_themes: sel.key === "seminar_departmental" ? numSubThemes : undefined,
          book_author: sel.key === "seminar_book_review" ? (bookAuthor || undefined) : undefined,
          author_name: sel.key === "seminar_journal" ? (authorName || undefined) : undefined,
          institution: sel.key === "seminar_journal" ? (institution || undefined) : undefined,
        },
      });
    },
    onSuccess: () => {
      // Mark transaction used (fire-and-forget)
      if (sel) {
        markUsedFn({ data: { product: sel.key as any } }).catch(() => {});
      }
      toast.success("Seminar generation started! Check your history in a few minutes.");
      navigate({ to: "/tools/history" });
    },
    onError: (e) => toast.error(String(e)),
  });

  // ── Render ──

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools
        </div>
        <h1 className="font-serif text-3xl">Seminar Paper</h1>
        <p className="text-ink/60 text-sm mt-1">
          Generate a complete seminar paper in 5 academic formats — journal paper,
          departmental seminar, postgraduate research, technical, or book review.
        </p>
      </div>

      {/* Step 1 — Select seminar type */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-ink/60">Select your seminar type:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {SEMINAR_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTypeSelect(t.key)}
                  className="text-left bg-card border border-ink/10 rounded-sm p-4 hover:border-sage/60 hover:bg-sage/5 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Icon className="size-5 text-sage group-hover:text-sage/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{t.label}</h3>
                      <p className="text-xs text-ink/50 mt-1 leading-relaxed">{t.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-ink/40">{t.wordCount}</span>
                        <span className="px-1.5 py-0.5 bg-ink/5 rounded-sm text-[10px] font-medium text-ink/50">
                          {t.referencing}
                        </span>
                        <span className="text-[10px] font-medium text-sage ml-auto">
                          ₦{t.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2 — Fill details form */}
      {step === 2 && sel && (
        <div className="space-y-5">
          <button
            onClick={() => { setStep(1); setSelectedType(null); }}
            className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to seminar types
          </button>

          <div className="bg-card border border-ink/10 rounded-sm p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {(() => { const Icon = sel.icon; return <Icon className="size-4 text-sage" />; })()}
                <span className="text-sm font-medium">{sel.label}</span>
                <span className="px-1.5 py-0.5 bg-ink/5 rounded-sm text-[10px] font-medium text-ink/50">
                  {sel.referencing}
                </span>
              </div>
              <p className="text-xs text-ink/40">{sel.description}</p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Seminar Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Impact of Social Media on Academic Performance Among Nigerian Undergraduates"
                className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Academic Level
                </label>
                <select
                  value={academicLevel}
                  onChange={(e) => setAcademicLevel(e.target.value)}
                  className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                >
                  {ACADEMIC_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Word Count
                </label>
                <input
                  type="number"
                  value={wordCount}
                  onChange={(e) => setWordCount(Math.max(sel.wordMin, Math.min(sel.wordMax, Number(e.target.value) || sel.wordMin)))}
                  min={sel.wordMin}
                  max={sel.wordMax}
                  className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
                <p className="text-[10px] text-ink/40 mt-1">
                  Range: {sel.wordCount}
                </p>
              </div>
            </div>

            {/* Journal-specific fields */}
            {sel.key === "seminar_journal" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Author Name
                  </label>
                  <input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Your full name"
                    className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Institution / Affiliation
                  </label>
                  <input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. University of Lagos"
                    className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                  />
                </div>
              </div>
            )}

            {/* Book review specific field */}
            {sel.key === "seminar_book_review" && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Book Author and Subject
                </label>
                <input
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  placeholder="e.g. Chinua Achebe — Things Fall Apart"
                  className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </div>
            )}

            {/* Departmental sub-theme count */}
            {sel.key === "seminar_departmental" && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Number of Sub-themes
                </label>
                <select
                  value={numSubThemes}
                  onChange={(e) => setNumSubThemes(Number(e.target.value) as 2 | 3 | 4)}
                  className="mt-1 w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                >
                  {SUB_THEME_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} sub-themes</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={!title.trim()}
            className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <Check className="size-4" /> Review & Pay
          </button>
        </div>
      )}

      {/* Step 3 — Review and pay */}
      {step === 3 && sel && (
        <div className="space-y-5">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Edit details
          </button>

          <div className="bg-card border border-ink/10 rounded-sm p-5 space-y-4">
            <h3 className="font-medium text-sm">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink/50">Type</span>
                <span className="font-medium">{sel.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Title</span>
                <span className="font-medium text-right max-w-[60%] truncate">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Academic Level</span>
                <span className="font-medium">{ACADEMIC_LEVELS.find((l) => l.value === academicLevel)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Word Count</span>
                <span className="font-medium">{wordCount.toLocaleString()} words</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Referencing</span>
                <span className="font-medium">{sel.referencing}</span>
              </div>
              {sel.key === "seminar_departmental" && (
                <div className="flex justify-between">
                  <span className="text-ink/50">Sub-themes</span>
                  <span className="font-medium">{numSubThemes}</span>
                </div>
              )}
              <hr className="border-ink/10" />
              <div className="flex justify-between font-semibold">
                <span>Price</span>
                <span className="text-sage">₦{sel.price.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={genMut.isPending}
            className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {genMut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enqueuing…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Pay ₦{sel.price.toLocaleString()} & Generate
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
