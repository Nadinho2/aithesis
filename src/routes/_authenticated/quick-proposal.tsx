import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateProposal } from "@/lib/proposals.functions";
import { checkAccess } from "@/lib/payment.functions";
import { PaymentModal } from "@/components/PaymentModal";
import { usePaymentCallback, saveFormBeforePay, restoreFormAfterPay } from "@/lib/usePaymentCallback";
import { FileText, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { StructureBuilder } from "@/components/StructureBuilder";

export const Route = createFileRoute("/_authenticated/quick-proposal")({
  head: () => ({ meta: [{ title: "Draft Proposal — Mybrainpadi" }] }),
  component: QuickProposalPage,
});

function QuickProposalPage() {
  const fn = useServerFn(generateProposal);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Restore form data if returning from Paystack redirect
  const savedForm = restoreFormAfterPay<{
    title: string; problem_statement: string; research_gap: string;
    objectives: string[]; department: string; area_of_interest: string;
    country: string; research_type: string;
    level: "undergraduate" | "masters" | "phd"; target_words: number;
    citation_style: "apa_7" | "harvard";
  }>();

  const defaultForm = {
    title: "",
    problem_statement: "",
    research_gap: "",
    objectives: ["", "", ""],
    department: "",
    area_of_interest: "",
    country: "",
    research_type: "",
    level: "undergraduate" as "undergraduate" | "masters" | "phd",
    target_words: 2800,
    citation_style: "apa_7" as "apa_7" | "harvard",
  };

  const [form, setForm] = useState(savedForm ?? defaultForm);

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
          },
          level: form.level,
          target_words: form.target_words,
          citation_style: form.citation_style,
        },
      }),
    onSuccess: () => {
      toast.success("Proposal draft complete — check your proposals.");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  });

  const checkAccessFn = useServerFn(checkAccess);
  const [showPayment, setShowPayment] = useState(false);

  // Handle Paystack redirect back after payment — just verify silently
  usePaymentCallback();

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
    // Check if user has paid
    try {
      const access = await checkAccessFn({ data: { product: "proposal" } });
      if (!access.allowed) {
        saveFormBeforePay(form);
        setShowPayment(true);
        return;
      }
    } catch {
      saveFormBeforePay(form);
      setShowPayment(true);
      return;
    }
    // Fire mutation and navigate away — it continues in the background
    sessionStorage.setItem("draft_in_progress", Date.now().toString());
    mut.mutate();
    toast.info("Drafting your proposal in the background…");
    navigate({ to: "/proposals" });
  };

  const updateObj = (i: number, v: string) => {
    const next = [...form.objectives];
    next[i] = v;
    setForm({ ...form, objectives: next });
  };
  const addObj = () => setForm({ ...form, objectives: [...form.objectives, ""] });
  const removeObj = (i: number) =>
    setForm({ ...form, objectives: form.objectives.filter((_, j) => j !== i) });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Direct Proposal
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">
          I already have a topic
        </h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          Paste your topic details and draft a full APA 7 proposal with verified scholarly
          references.
        </p>
      </div>

      <form onSubmit={submit} className="p-5 sm:p-8 bg-card border border-ink/10 rounded-sm space-y-5">
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
                  <button type="button" onClick={() => removeObj(i)} className="p-2 text-ink/40 hover:text-red-700">
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
              documentType="proposal"
              onSelectionChange={(sel) => {
                setForm({
                  ...form,
                  department: sel.department,
                  country: (sel.university && sel.university !== "__other__") ? (form.country || "Nigeria") : form.country,
                });
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
              onChange={(e) => setForm({ ...form, research_type: e.target.value })}
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
              Target Words
            </label>
            <input
              type="number"
              min={500}
              max={20000}
              step={100}
              value={form.target_words}
              onChange={(e) => setForm({ ...form, target_words: Number(e.target.value) })}
              className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={mut.isPending}
          className="w-full sm:w-auto px-6 py-3 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {mut.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Drafting proposal…
            </>
          ) : (
            <>
              <FileText className="size-4" /> Draft Proposal
            </>
          )}
        </button>
      </form>

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        product="proposal"
        callbackPath={typeof window !== "undefined" ? window.location.pathname : undefined}
        onPaid={() => {
          setShowPayment(false);
          sessionStorage.setItem("draft_in_progress", Date.now().toString());
          mut.mutate();
          toast.info("Drafting your proposal in the background…");
          navigate({ to: "/proposals" });
        }}
      />
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
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
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
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage resize-y"
      />
    </div>
  );
}
