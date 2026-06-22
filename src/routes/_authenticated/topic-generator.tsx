import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateTopics } from "@/lib/topics.functions";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/topic-generator")({
  head: () => ({ meta: [{ title: "Topic Discovery — Mybrainpadi" }] }),
  component: TopicGeneratorPage,
});

function TopicGeneratorPage() {
  const fn = useServerFn(generateTopics);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    department: "",
    course: "",
    area_of_interest: "",
    country: "",
    research_type: "",
    count: 5,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => fn({ data }),
    onSuccess: (res) => {
      toast.success(`Found ${res.topics.length} topics — saved to My Topics`);
      qc.invalidateQueries({ queryKey: ["my-topics"] });
      navigate({ to: "/my-topics" });
    },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.department || !form.area_of_interest) {
      toast.error("Department and area of interest are required");
      return;
    }
    mutation.mutate(form);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8 md:mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Research Studio
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Topic Discovery</h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          Enter your parameters to discover up to seven original, scored research
          topics tailored to your field — auto-saved to your library.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="p-5 sm:p-8 bg-card border border-ink/10 rounded-sm space-y-6"
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            label="Department *"
            value={form.department}
            onChange={(v) => setForm({ ...form, department: v })}
            placeholder="e.g. Computer Science"
          />
          <Field
            label="Course"
            value={form.course}
            onChange={(v) => setForm({ ...form, course: v })}
            placeholder="e.g. Software Engineering"
          />
          <Field
            label="Area of Interest *"
            value={form.area_of_interest}
            onChange={(v) => setForm({ ...form, area_of_interest: v })}
            placeholder="e.g. ML for healthcare"
          />
          <Field
            label="Country / Context"
            value={form.country}
            onChange={(v) => setForm({ ...form, country: v })}
            placeholder="e.g. Nigeria"
          />
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
              Number of Topics *
            </label>
            <select
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "topic" : "topics"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full sm:w-auto px-6 py-3 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Find {form.count} Topic{form.count > 1 ? "s" : ""}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({
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
