import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateThesis } from "@/lib/theses.functions";
import { checkAccess } from "@/lib/payment.functions";
import { saveFormBeforePay, restoreFormAfterPay } from "@/lib/usePaymentCallback";
import { BookOpen, Loader2, Plus, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { StructureBuilder } from "@/components/StructureBuilder";
import type { ChapterTemplate } from "@/lib/seeds/templates";

export const Route = createFileRoute("/_authenticated/new-thesis")({
  validateSearch: (search: Record<string, unknown>): {
    title?: string;
    area_of_interest?: string;
    department?: string;
    level?: string;
  } => ({
    title: typeof search.title === "string" ? search.title : undefined,
    area_of_interest: typeof search.area_of_interest === "string" ? search.area_of_interest : undefined,
    department: typeof search.department === "string" ? search.department : undefined,
    level: typeof search.level === "string" ? search.level : undefined,
  }),
  head: () => ({ meta: [{ title: "Draft Thesis — Mybrainpadi" }] }),
  component: NewThesisPage,
});

function NewThesisPage() {
  const fn = useServerFn(generateThesis);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Restore form data if returning from Paystack redirect (check both keys)
  const savedForm = restoreFormAfterPay<{
    title: string; problem_statement: string; research_gap: string;
    objectives: string[]; department: string; area_of_interest: string;
    country: string; research_type: string;
    is_primary_data: boolean; primary_instrument: string;
    target_population: string; sample_size: string;
    sample_questions: string[]; empirical_notes: string;
    level: "undergraduate" | "masters" | "phd"; target_words: number;
    citation_style: "apa_7" | "harvard";
    custom_chapters?: ChapterTemplate[];
  }>();

  const search = Route.useSearch();

  const [form, setForm] = useState(() => {
    const base = savedForm ?? {
      title: "",
      problem_statement: "",
      research_gap: "",
      objectives: ["", "", ""],
      department: "",
      area_of_interest: "",
      country: "",
      research_type: "",
      is_primary_data: false,
      primary_instrument: "",
      target_population: "",
      sample_size: "",
      sample_questions: ["", ""],
      empirical_notes: "",
      level: "undergraduate" as "undergraduate" | "masters" | "phd",
      target_words: 8000,
      citation_style: "apa_7" as "apa_7" | "harvard",
      custom_chapters: undefined as ChapterTemplate[] | undefined,
    };
    return {
      ...base,
      title: search.title || base.title,
      area_of_interest: search.area_of_interest || base.area_of_interest,
      department: search.department || base.department,
      level: search.level === "masters" || search.level === "phd" || search.level === "undergraduate"
        ? (search.level as "undergraduate" | "masters" | "phd")
        : base.level,
    };
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("thesis_prefill");
      if (!raw) return;
      const p = JSON.parse(raw);
      sessionStorage.removeItem("thesis_prefill");
      setForm((f) => ({
        ...f,
        title: p.title ?? f.title,
        problem_statement: p.problem_statement ?? f.problem_statement,
        research_gap: p.research_gap ?? f.research_gap,
        objectives: Array.isArray(p.objectives) && p.objectives.length ? p.objectives : f.objectives,
        department: p.department ?? f.department,
        area_of_interest: p.area_of_interest ?? f.area_of_interest,
        country: p.country ?? f.country,
        research_type: p.research_type ?? f.research_type,
        is_primary_data: p.is_primary_data ?? f.is_primary_data,
        primary_instrument: p.primary_instrument ?? f.primary_instrument,
        target_population: p.target_population ?? f.target_population,
        sample_size: p.sample_size ?? f.sample_size,
        sample_questions: Array.isArray(p.sample_questions) && p.sample_questions.length ? p.sample_questions : f.sample_questions,
        empirical_notes: p.empirical_notes ?? f.empirical_notes,
        level: p.level ?? f.level,
      }));
      toast.success("Prefilled from your proposal — review and draft.");
    } catch {
      /* ignore */
    }
  }, []);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          manual: {
            title: form.title.trim(),
            problem_statement: form.problem_statement.trim(),
            research_gap: form.research_gap.trim(),
            objectives: form.objectives.map((s) => s.trim()).filter(Boolean),
            department: form.department.trim(),
            area_of_interest: form.area_of_interest.trim(),
            country: form.country.trim(),
            research_type: form.research_type.trim(),
            is_primary_data: form.is_primary_data,
            primary_instrument: form.primary_instrument.trim(),
            target_population: form.target_population.trim(),
            sample_size: form.sample_size.trim(),
            sample_questions: form.sample_questions.map((q) => q.trim()).filter(Boolean),
            empirical_notes: form.empirical_notes.trim(),
          },
          level: form.level,
          target_words: form.target_words,
          citation_style: form.citation_style,
          custom_chapters: form.custom_chapters && form.custom_chapters.length > 0 ? form.custom_chapters : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Thesis generated successfully!");
      qc.invalidateQueries({ queryKey: ["theses"] });
    },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  });

  const checkAccessFn = useServerFn(checkAccess);

  // Handle Paystack redirect back after payment — just verify silently

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.problem_statement || !form.research_gap) {
      toast.error("Title, problem statement, and research gap are required.");
      return;
    }
    if (form.objectives.filter((o) => o.trim()).length < 1) {
      toast.error("Add at least one objective.");
      return;
    }
    // Check if user has paid for this thesis level
    try {
      const access = await checkAccessFn({ data: { product: "thesis", level: form.level } });
      if (!access.allowed) {
        saveFormBeforePay(form);
        sessionStorage.setItem("return_path", window.location.pathname);
        navigate({ to: "/billing" });
        setTimeout(() => { window.location.href = "/billing"; }, 300);
        return;
      }
    } catch {
      saveFormBeforePay(form);
      sessionStorage.setItem("return_path", window.location.pathname);
      navigate({ to: "/billing" });
      setTimeout(() => { window.location.href = "/billing"; }, 300);
      return;
    }
    // Fire mutation and navigate away — it continues in the background
    mut.mutate();
    sessionStorage.setItem("draft_in_progress", Date.now().toString());
    toast.info("Drafting your thesis in the background…");
    navigate({ to: "/theses" });
  };

  const updateObj = (i: number, v: string) => {
    const next = [...form.objectives];
    next[i] = v;
    setForm({ ...form, objectives: next });
  };
  const addObj = () => setForm({ ...form, objectives: [...form.objectives, ""] });
  const removeObj = (i: number) =>
    setForm({ ...form, objectives: form.objectives.filter((_, j) => j !== i) });

  const updateQuestion = (i: number, v: string) => {
    const next = [...form.sample_questions];
    next[i] = v;
    setForm({ ...form, sample_questions: next });
  };
  const addQuestion = () => setForm({ ...form, sample_questions: [...form.sample_questions, ""] });
  const removeQuestion = (i: number) =>
    setForm({ ...form, sample_questions: form.sample_questions.filter((_, j) => j !== i) });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="mb-8 max-w-full overflow-hidden">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Full Thesis
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3 break-words">
          Draft a complete thesis
        </h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base break-words">
          Five chapters from Introduction through Discussion, with APA 7 references retrieved live
          from OpenAlex, Crossref, Semantic Scholar, and arXiv. Original, human-toned prose.
          Drafting can take 1–3 minutes for longer targets.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="p-5 sm:p-8 bg-card border border-ink/10 rounded-sm space-y-5 max-w-full overflow-hidden"
      >
        <Text label="Topic / Title *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Area
          label="Problem Statement *"
          value={form.problem_statement}
          onChange={(v) => setForm({ ...form, problem_statement: v })}
          rows={4}
        />
        <Area
          label="Research Gap *"
          value={form.research_gap}
          onChange={(v) => setForm({ ...form, research_gap: v })}
          rows={3}
        />

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
            Objectives *
          </label>
          <div className="mt-2 space-y-2">
            {form.objectives.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={o}
                  onChange={(e) => updateObj(i, e.target.value)}
                  placeholder={`Objective ${i + 1}`}
                  className="flex-1 bg-bone border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
                {form.objectives.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeObj(i)}
                    className="p-2 text-ink/40 hover:text-red-700"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addObj}
              className="text-xs flex items-center gap-1 text-sage hover:underline"
            >
              <Plus className="size-3.5" /> Add objective
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 block mb-2">
              University & Department
            </label>
            <StructureBuilder
              documentType="thesis"
              initialChapters={form.custom_chapters}
              onChaptersChange={(chs) => {
                setForm((prev) => ({ ...prev, custom_chapters: chs }));
              }}
              onSelectionChange={(sel) => {
                setForm((prev) => ({
                  ...prev,
                  department: sel.department || prev.department,
                  country: (sel.university && sel.university !== "__other__") ? (prev.country || "Nigeria") : prev.country,
                }));
              }}
            />
          </div>
          <Text label="Area of Interest" value={form.area_of_interest} onChange={(v) => setForm({ ...form, area_of_interest: v })} placeholder="e.g. maternal health" />
          <Text label="Country / Context" value={form.country} onChange={(v) => setForm({ ...form, country: v })} placeholder="e.g. Nigeria" />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
              Research Type
            </label>
            <select
              value={form.research_type}
              onChange={(e) => {
                const rt = e.target.value;
                const isEmpirical = /Empirical|Mixed|Case Study/i.test(rt);
                const isQual = /Qualitative|Case Study/i.test(rt);
                setForm((prev) => ({
                  ...prev,
                  research_type: rt,
                  is_primary_data: isEmpirical ? true : prev.is_primary_data,
                  primary_instrument: isEmpirical && !prev.primary_instrument
                    ? (isQual ? "Key Informant Interviews (KII) / In-depth Interviews" : "Structured Questionnaire / Survey")
                    : prev.primary_instrument,
                }));
              }}
              className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
            >
              <option value="">Any</option>
              <option>Empirical Qualitative</option>
              <option>Empirical Quantitative</option>
              <option>Mixed Methods</option>
              <option>Systematic Review</option>
              <option>Case Study</option>
              <option>Comparative Analysis</option>
              <option>Theoretical</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
              Level
            </label>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as any })}
              className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
            >
              <option value="undergraduate">Undergraduate</option>
              <option value="masters">Master's</option>
              <option value="phd">PhD</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
              Citation Style
            </label>
            <select
              value={form.citation_style}
              onChange={(e) => setForm({ ...form, citation_style: e.target.value as any })}
              className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
            >
              <option value="apa_7">APA 7th</option>
              <option value="harvard">Harvard</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
              Target Words (6,000 – 80,000)
            </label>
            <input
              type="number"
              min={6000}
              max={80000}
              step={500}
              value={form.target_words}
              onChange={(e) => setForm({ ...form, target_words: Number(e.target.value) })}
              className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
            />
          </div>
        </div>

        {/* Empirical Primary Field Data Section */}
        <div className="p-4 sm:p-5 bg-bone/70 border border-ink/15 rounded-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink">
                Empirical Primary Field Data (Optional)
              </div>
              <p className="text-xs text-ink/60 mt-0.5">
                Input your field data specifications (number of interviews, respondents, sample questions) so the AI structures methodology and findings accurately.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.is_primary_data}
                onChange={(e) => setForm({ ...form, is_primary_data: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-ink/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sage"></div>
            </label>
          </div>

          {form.is_primary_data && (
            <div className="pt-3 border-t border-ink/10 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Data Collection Instrument
                  </label>
                  <select
                    value={form.primary_instrument}
                    onChange={(e) => setForm({ ...form, primary_instrument: e.target.value })}
                    className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                  >
                    <option value="">Select Instrument</option>
                    <option value="Key Informant Interviews (KII) / In-depth Interviews">Key Informant Interviews (KII) / In-depth Interviews</option>
                    <option value="Structured Questionnaire / Survey">Structured Questionnaire / Survey</option>
                    <option value="Focus Group Discussions (FGD)">Focus Group Discussions (FGD)</option>
                    <option value="Mixed Methods (Questionnaire + Follow-up Interviews)">Mixed Methods (Questionnaire + Follow-up Interviews)</option>
                    <option value="Observational Field Checklist">Observational Field Checklist</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Sample Size / Number of Interviews or Respondents
                  </label>
                  <input
                    type="text"
                    value={form.sample_size}
                    onChange={(e) => setForm({ ...form, sample_size: e.target.value })}
                    placeholder="e.g. 15 in-depth interview participants or 250 survey respondents"
                    className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Target Population / Informants
                </label>
                <input
                  type="text"
                  value={form.target_population}
                  onChange={(e) => setForm({ ...form, target_population: e.target.value })}
                  placeholder="e.g. Senior Medical Officers & Nurses across 3 tertiary hospitals in Lagos"
                  className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Sample Interview Questions / Questionnaire Constructs
                  </label>
                  <span className="text-[10px] text-ink/40">Analysed directly in Chapter 4</span>
                </div>
                <div className="mt-2 space-y-2">
                  {form.sample_questions.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={q}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                        placeholder={`Question ${i + 1} (e.g. What institutional challenges hinder implementation?)`}
                        className="flex-1 bg-bone border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                      />
                      {form.sample_questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(i)}
                          className="p-2 text-ink/40 hover:text-red-700"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-xs flex items-center gap-1 text-sage hover:underline pt-1"
                  >
                    <Plus className="size-3.5" /> Add sample question
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Key Empirical Findings / Field Notes (Optional)
                </label>
                <textarea
                  value={form.empirical_notes}
                  onChange={(e) => setForm({ ...form, empirical_notes: e.target.value })}
                  rows={3}
                  placeholder="Paste brief interview notes, key participant quotes, or survey highlights to guide the analysis..."
                  className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={mut.isPending}
          className="w-full sm:w-auto px-6 py-3 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {mut.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Drafting thesis… (may take 1–3 min)
            </>
          ) : (
            <>
              <BookOpen className="size-4" /> Draft Full Thesis
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage break-words"
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="min-w-0">
      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage resize-y break-words"
      />
    </div>
  );
}
