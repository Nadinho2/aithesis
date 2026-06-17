import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTopics, deleteTopics, exportTopicsDocx } from "@/lib/topics.functions";
import { generateProposal } from "@/lib/proposals.functions";
import { Loader2, Trash2, Sparkles, FileText, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

function downloadFromBase64(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_authenticated/my-topics")({
  head: () => ({ meta: [{ title: "My Topics — ThesisPro" }] }),
  component: MyTopicsPage,
});

type Topic = {
  id: string;
  title: string;
  problem_statement: string;
  research_gap: string;
  objectives: string[];
  novelty_score: number;
  feasibility_score: number;
  category: string | null;
  department: string | null;
};

function MyTopicsPage() {
  const fn = useServerFn(listTopics);
  const delFn = useServerFn(deleteTopics);
  const genFn = useServerFn(generateProposal);
  const exportFn = useServerFn(exportTopicsDocx);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genLevel, setGenLevel] = useState<Record<string, string>>({});
  const [genWords, setGenWords] = useState<Record<string, number>>({});
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-topics", "all"],
    queryFn: () => fn({ data: {} }),
  });

  const delMut = useMutation({
    mutationFn: (ids: string[]) => delFn({ data: { ids } }),
    onSuccess: (res) => {
      toast.success(`Deleted ${res.count} topic${res.count > 1 ? "s" : ""}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["my-topics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((t: Topic) => t.id)));
  };

  const handleGenerate = async (topicId: string) => {
    const level = (genLevel[topicId] ?? "undergraduate") as "undergraduate" | "masters" | "phd";
    const target_words = Math.min(3000, Math.max(2500, genWords[topicId] ?? 2800));
    setGenBusy(topicId);
    sessionStorage.setItem("draft_in_progress", Date.now().toString());
    // Fire the mutation (fire-and-forget) and navigate immediately
    genFn({ data: { topic_id: topicId, level, target_words } }).catch((e) => {
      console.error("Proposal generation failed:", e);
    });
    toast.info("Drafting your proposal in the background…");
    navigate({ to: "/proposals" });
  };

  const handleGenerateThesis = (topic: Topic) => {
    const level = (genLevel[topic.id] ?? "undergraduate") as "undergraduate" | "masters" | "phd";
    sessionStorage.setItem(
      "thesis_prefill",
      JSON.stringify({
        title: topic.title ?? "",
        problem_statement: topic.problem_statement ?? "",
        research_gap: topic.research_gap ?? "",
        objectives: topic.objectives ?? [],
        department: topic.department ?? "",
        area_of_interest: topic.category ?? "",
        country: "",
        research_type: "",
        level,
      }),
    );
    navigate({ to: "/new-thesis" });
  };

  const handleDownload = async (ids: string[]) => {
    setDlBusy(true);
    try {
      const r = await exportFn({ data: { ids } });
      downloadFromBase64(r.base64, r.filename, r.mime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(false);
    }
  };

  const topics = (data ?? []) as Topic[];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-6 md:mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            Research Library
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">My Topics</h1>
          <p className="text-ink/60 max-w-xl text-sm sm:text-base">
            Select topics to delete, or draft a full proposal grounded in real citations.
          </p>
        </div>
        <Link
          to="/proposals"
          className="text-xs font-medium px-3 py-2 border border-ink/15 rounded-sm hover:bg-parchment inline-flex items-center gap-1"
        >
          My Proposals <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-ink/50">
          <Loader2 className="size-4 animate-spin" /> Loading your library…
        </div>
      )}

      {!isLoading && topics.length === 0 && (
        <div className="text-center py-16 sm:py-20 border border-dashed border-ink/15 rounded-sm px-6">
          <p className="font-serif italic text-ink/50 text-lg">Your library is empty.</p>
          <p className="text-sm text-ink/40 mt-2">Find topics to populate your library.</p>
        </div>
      )}

      {topics.length > 0 && (
        <>
          <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 bg-paper/95 py-3 border-b border-[#E5E2D8]">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === topics.length && topics.length > 0}
                onChange={toggleAll}
                className="size-4 accent-sage"
              />
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </label>
            {selected.size > 0 && (
              <>
                <button
                  onClick={() => handleDownload(Array.from(selected))}
                  disabled={dlBusy}
                  className="text-xs font-medium px-3 py-1.5 border border-ink/15 rounded-sm hover:bg-parchment transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {dlBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  Download .docx
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${selected.size} topic(s)? This cannot be undone.`)) {
                      delMut.mutate(Array.from(selected));
                    }
                  }}
                  disabled={delMut.isPending}
                  className="text-xs font-medium px-3 py-1.5 bg-red-700 text-bone rounded-sm hover:bg-red-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {delMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Delete selected
                </button>
              </>
            )}
          </div>

          <div className="grid gap-4">
            {topics.map((t) => {
              const checked = selected.has(t.id);
              const busy = genBusy === t.id;
              return (
                <div
                  key={t.id}
                  className={`p-5 sm:p-6 bg-card border rounded-sm transition-colors ${checked ? "border-sage" : "border-ink/10 hover:border-ink/25"}`}
                >
                  <div className="flex gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(t.id)}
                      className="size-4 mt-1.5 accent-sage shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h3 className="font-serif text-lg leading-snug text-ink">{t.title}</h3>
                        <div className="flex gap-3 shrink-0 text-center">
                          <div>
                            <div className="text-[9px] text-ink/40 uppercase font-bold">Nov</div>
                            <div className="text-sm font-serif font-bold">
                              {Number(t.novelty_score).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-ink/40 uppercase font-bold">Feas</div>
                            <div className="text-sm font-serif font-bold">
                              {Number(t.feasibility_score).toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-ink/70 leading-relaxed mb-2">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-ink/50 mr-2">
                          Problem
                        </span>
                        {t.problem_statement}
                      </p>
                      <p className="text-sm text-ink/70 leading-relaxed mb-3">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-ink/50 mr-2">
                          Gap
                        </span>
                        {t.research_gap}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink/5">
                        <select
                          value={genLevel[t.id] ?? "undergraduate"}
                          onChange={(e) =>
                            setGenLevel({ ...genLevel, [t.id]: e.target.value })
                          }
                          className="text-xs bg-bone border border-ink/15 rounded-sm px-2 py-1.5 focus:outline-none focus:border-sage"
                        >
                          <option value="undergraduate">Undergraduate</option>
                          <option value="masters">Master's</option>
                          <option value="phd">PhD</option>
                        </select>
                        <input
                          type="number"
                          min={2500}
                          max={3000}
                          step={50}
                          value={genWords[t.id] ?? 2800}
                          onChange={(e) =>
                            setGenWords({ ...genWords, [t.id]: Number(e.target.value) })
                          }
                          title="Target words (2,500–3,000)"
                          className="text-xs bg-bone border border-ink/15 rounded-sm px-2 py-1.5 w-20 focus:outline-none focus:border-sage"
                        />
                        <button
                          onClick={() => handleGenerate(t.id)}
                          disabled={busy}
                          className="text-xs font-medium px-3 py-1.5 bg-ink text-bone rounded-sm hover:bg-sage transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          {busy ? "Drafting…" : "Draft Proposal"}
                        </button>
                        <button
                          onClick={() => handleDownload([t.id])}
                          disabled={dlBusy}
                          title="Download this topic as .docx"
                          className="text-xs font-medium px-3 py-1.5 border border-ink/15 rounded-sm hover:bg-parchment flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Download className="size-3.5" /> .docx
                        </button>
                        <button
                          onClick={() => handleGenerateThesis(t)}
                          className="text-xs font-medium px-3 py-1.5 bg-ink text-bone rounded-sm hover:bg-sage transition-colors flex items-center gap-1.5"
                        >
                          <Sparkles className="size-3.5" /> Full Thesis
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
