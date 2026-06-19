import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { listProposals, deleteProposal, exportProposalDocx, getProposal } from "@/lib/proposals.functions";
import { Loader2, FileText, Trash2, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import WhileYouWait from "@/components/WhileYouWait";

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({ meta: [{ title: "My Proposals — ThesisPro" }] }),
  component: ProposalsListPage,
});

function ProposalsListPage() {
  const fn = useServerFn(listProposals);
  const delFn = useServerFn(deleteProposal);
  const dlFn = useServerFn(exportProposalDocx);
  const getFn = useServerFn(getProposal);
  const navigate = useNavigate();
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const [thesisBusy, setThesisBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["proposals"], queryFn: () => fn() });
  const [showDrafting, setShowDrafting] = useState(() => sessionStorage.getItem("draft_in_progress") !== null);

  useEffect(() => {
    const err = sessionStorage.getItem("draft_error");
    if (err) {
      sessionStorage.removeItem("draft_error");
      toast.error(err);
    }
  }, []);

  useEffect(() => {
    if (showDrafting && (data?.length ?? 0) > 0) {
      const hasNew = (data as any[]).some(
        (p) => Date.now() - new Date(p.created_at).getTime() < 120_000
      );
      if (hasNew) {
        sessionStorage.removeItem("draft_in_progress");
        setShowDrafting(false);
      }
    }
  }, [data, showDrafting]);

  const goToThesis = async (id: string) => {
    setThesisBusy(id);
    try {
      const p = await getFn({ data: { id } });
      // sections may be a parsed object or a JSON string from supabase
      const s = (typeof p.sections === "string" ? JSON.parse(p.sections) : p.sections ?? {}) as Record<string, any>;
      const objectives: string[] = Array.isArray(s.objectives) && s.objectives.length
        ? s.objectives
        : ["Investigate the central problem identified in the proposal."];
      sessionStorage.setItem(
        "thesis_prefill",
        JSON.stringify({
          title: p.title ?? "",
          problem_statement: (s.statement_of_the_problem as string) ?? (s.problem_statement as string) ?? "",
          research_gap: (s.gap_in_literature as string)?.slice(0, 800) ?? (s.literature_review as string)?.slice(0, 800) ?? "",
          objectives,
          department: p.department ?? "",
          area_of_interest: p.area_of_interest ?? "",
          country: p.country ?? "",
          research_type: p.research_type ?? "",
          level: p.level ?? "undergraduate",
        }),
      );
      navigate({ to: "/new-thesis" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open thesis draft");
    } finally {
      setThesisBusy(null);
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Proposal deleted");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const download = async (id: string) => {
    setDlBusy(id);
    try {
      const r = await dlFn({ data: { id } });
      const bin = atob(r.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: r.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  };

  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    level: string;
    word_count: number;
    created_at: string;
  }>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8 md:mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Documents
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">My Proposals</h1>
        <p className="text-ink/60 max-w-xl text-sm sm:text-base">
          Every proposal lives here with its verified scholarly references.
        </p>
      </div>

      {showDrafting && (
        <WhileYouWait onDismiss={() => { sessionStorage.removeItem("draft_in_progress"); setShowDrafting(false); }} />
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-ink/50">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="text-center py-16 border border-dashed border-ink/15 rounded-sm">
          <p className="font-serif italic text-ink/50 text-lg">No proposals yet.</p>
          <p className="text-sm text-ink/40 mt-2">
            Open <Link to="/my-topics" className="underline">My Topics</Link> to start one.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((p) => (
          <div
            key={p.id}
            className="p-4 sm:p-5 bg-card border border-ink/10 rounded-sm hover:border-ink/25 transition-colors flex items-center gap-4"
          >
            <FileText className="size-5 text-sage shrink-0" />
            <Link to="/proposal/$id" params={{ id: p.id }} className="flex-1 min-w-0">
              <div className="font-serif text-base sm:text-lg truncate">{p.title}</div>
              <div className="text-xs text-ink/50 mt-1">
                {p.level} · {p.word_count.toLocaleString()} words ·{" "}
                {new Date(p.created_at).toLocaleDateString()}
              </div>
            </Link>
            <button
              onClick={() => goToThesis(p.id)}
              disabled={thesisBusy === p.id}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-sage text-sage rounded-sm hover:bg-sage hover:text-bone transition-colors disabled:opacity-50"
              title="Draft full thesis from this proposal"
            >
              {thesisBusy === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Full Thesis
            </button>
            <button
              onClick={() => download(p.id)}
              disabled={dlBusy === p.id}
              className="text-ink/60 hover:text-ink p-2 disabled:opacity-50"
              aria-label="Download proposal"
              title="Download .docx"
            >
              {dlBusy === p.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this proposal?")) del.mutate(p.id);
              }}
              className="text-ink/40 hover:text-red-700 p-2"
              aria-label="Delete proposal"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
