import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, X, Sparkles, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/custom-analysis")({
  head: () => ({ meta: [{ title: "Assessment — Mybrainpadi" }] }),
  component: CustomAnalysisPage,
});

interface FieldInput {
  id: string;
  value: string;
}

interface AnalysisResult {
  name: string;
  answer: string;
}

let fieldIdCounter = 0;
function nextFieldId(): string {
  return `f_${++fieldIdCounter}`;
}

const MAX_SCENARIO = 2000;
const MAX_FIELDS = 10;
const MAX_FIELD_LENGTH = 60;
const MAX_TITLE = 100;

function CustomAnalysisPage() {
  const [title, setTitle] = useState("");
  const [scenarioText, setScenarioText] = useState("");
  const [fields, setFields] = useState<FieldInput[]>([
    { id: nextFieldId(), value: "" },
    { id: nextFieldId(), value: "" },
    { id: nextFieldId(), value: "" },
  ]);
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Derived state ──
  const nonEmptyFields = fields.filter((f) => f.value.trim());
  const canGenerate = title.trim() && scenarioText.trim() && nonEmptyFields.length >= 1;
  const canAddField = fields.length < MAX_FIELDS;

  // ── Field management ──
  const updateField = useCallback((id: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value: value.slice(0, MAX_FIELD_LENGTH) } : f)));
  }, []);

  const addField = useCallback(() => {
    if (fields.length < MAX_FIELDS) {
      setFields((prev) => [...prev, { id: nextFieldId(), value: "" }]);
    }
  }, [fields.length]);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const reset = useCallback(() => {
    setTitle("");
    setScenarioText("");
    setFields([
      { id: nextFieldId(), value: "" },
      { id: nextFieldId(), value: "" },
      { id: nextFieldId(), value: "" },
    ]);
    setResults(null);
    setError(null);
  }, []);

  // ── Mutation ──
  const mut = useMutation({
    mutationFn: async () => {
      setError(null);
      const fieldNames = nonEmptyFields.map((f) => f.value.trim());

      const resp = await fetch("/api/custom-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scenarioText: scenarioText.trim(),
          fields: fieldNames,
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.error || `Request failed (${resp.status})`);
      }

      if (!json.success) {
        throw new Error(json.error || "Generation failed.");
      }

      return json as { id: string; results: AnalysisResult[] };
    },
    onSuccess: (data) => {
      setResults(data.results);
      toast.success("Analysis complete!");
    },
    onError: (e: any) => {
      setError(e?.message || "Something went wrong.");
      toast.error(e?.message || "Something went wrong.");
    },
  });

  const handleGenerate = () => {
    if (!canGenerate) return;
    mut.mutate();
  };

  const handleRetry = () => {
    mut.mutate();
  };

  // ── Results view ──
  if (results) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
            Student Tools
          </div>
          <h1 className="font-serif text-3xl">Assessment Results</h1>
          <p className="text-ink/60 text-sm mt-1">
            Analysis of your scenario based on your custom fields.
          </p>
        </div>

        <div className="bg-card border border-ink/10 rounded-sm p-6 space-y-5">
          <div className="pb-3 border-b border-ink/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/50 mb-1">
              Title
            </p>
            <p className="text-sm font-medium">{title}</p>
          </div>

          <div className="pb-3 border-b border-ink/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/50 mb-1">
              Scenario
            </p>
            <p className="text-sm text-ink/80 whitespace-pre-wrap">{scenarioText}</p>
          </div>

          <div className="space-y-4 pt-1">
            {results.map((r, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-ink">{r.name}</p>
                <p className="text-sm text-ink/70 mt-1 leading-relaxed">{r.answer}</p>
                {i < results.length - 1 && <hr className="mt-4 border-ink/5" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <p className="text-xs text-ink/40">Saved to your history automatically.</p>
          <button
            onClick={reset}
            className="ml-auto px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2"
          >
            <RefreshCw className="size-3.5" /> New Assessment
          </button>
        </div>
      </div>
    );
  }

  // ── Input form ──
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/tools/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="size-4" /> Back to tools
      </Link>
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools · Free
        </div>
        <h1 className="font-serif text-3xl">Assessment</h1>
        <p className="text-ink/60 text-sm mt-1">
          Submit a scenario or statement and define your own response fields.
          The AI will analyze your scenario and answer each field with genuine, contextual insight.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-sm p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            disabled={mut.isPending}
            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-sm text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-1.5 disabled:opacity-60 shrink-0"
          >
            <RefreshCw className="size-3.5" /> Try Again
          </button>
        </div>
      )}

      {/* Step 1 — Title */}
      <div className="space-y-1.5 mb-4">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
          Give this analysis a title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder="e.g. Team Communication Review"
          className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
        />
        <p className="text-[10px] text-ink/40 text-right">{title.length}/{MAX_TITLE}</p>
      </div>

      {/* Step 2 — Scenario input */}
      <div className="space-y-1.5 mb-6">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
          Enter your statement or scenario
        </label>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value.slice(0, MAX_SCENARIO))}
          placeholder="e.g. Hello team, please share your weekly progress by Friday."
          rows={5}
          className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-none"
        />
        <p className="text-[10px] text-ink/40 text-right">{scenarioText.length}/{MAX_SCENARIO}</p>
      </div>

      {/* Step 3 — Field builder */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
            Define how you want the answer structured
          </label>
          <span className="text-[10px] text-ink/40">
            {nonEmptyFields.length}/{MAX_FIELDS} fields
          </span>
        </div>

        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                value={field.value}
                onChange={(e) => updateField(field.id, e.target.value)}
                placeholder="e.g. Statement Type"
                className="flex-1 bg-card border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
              <button
                onClick={() => removeField(field.id)}
                className="p-1.5 text-ink/30 hover:text-red-500 transition-colors shrink-0"
                title="Remove field"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addField}
          disabled={!canAddField}
          className="mt-2 flex items-center gap-1.5 text-sm text-sage hover:text-sage/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="size-3.5" /> Add field
        </button>
      </div>

      {/* Step 4 — Generate */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || mut.isPending}
        className="w-full sm:w-auto px-6 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mut.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Analyzing your scenario…
          </>
        ) : (
          <>
            <Sparkles className="size-4" /> Generate Assessment
          </>
        )}
      </button>
    </div>
  );
}
