import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { listTheses, deleteThesis, exportThesisDocx } from "@/lib/theses.functions";
import { Loader2, BookOpen, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import WhileYouWait from "@/components/WhileYouWait";

export const Route = createFileRoute("/_authenticated/theses")({
  head: () => ({ meta: [{ title: "My Theses — Mybrainpadi" }] }),
  component: TheseListPage,
});

function TheseListPage() {
  const fn = useServerFn(listTheses);
  const delFn = useServerFn(deleteThesis);
  const dlFn = useServerFn(exportThesisDocx);
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["theses"], queryFn: () => fn() });
  const [showDrafting, setShowDrafting] = useState(() => sessionStorage.getItem("draft_in_progress") !== null);

  useEffect(() => {
    if (showDrafting && (data?.length ?? 0) > 0) {
      const hasNew = (data as any[]).some(
        (t) => Date.now() - new Date(t.created_at).getTime() < 120_000
      );
      if (hasNew) {
        sessionStorage.removeItem("draft_in_progress");
        setShowDrafting(false);
      }
    }
  }, [data, showDrafting]);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Thesis deleted");
      qc.invalidateQueries({ queryKey: ["theses"] });
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
    target_words: number;
    created_at: string;
  }>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8 md:mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            Documents
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">My Theses</h1>
          <p className="text-ink/60 max-w-xl text-sm sm:text-base">
            Full five-chapter theses with APA 7 references. Draft as many as you need.
          </p>
        </div>
        <Link
          to="/new-thesis"
          className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors"
        >
          New Thesis
        </Link>
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
          <p className="font-serif italic text-ink/50 text-lg">No theses yet.</p>
          <p className="text-sm text-ink/40 mt-2">
            <Link to="/new-thesis" className="underline">Draft your first one</Link>.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((t) => (
          <div
            key={t.id}
            className="p-4 sm:p-5 bg-card border border-ink/10 rounded-sm hover:border-ink/25 transition-colors flex items-center gap-4"
          >
            <BookOpen className="size-5 text-sage shrink-0" />
            <Link to="/thesis/$id" params={{ id: t.id }} className="flex-1 min-w-0">
              <div className="font-serif text-base sm:text-lg truncate">{t.title}</div>
              <div className="text-xs text-ink/50 mt-1">
                {t.level} · {t.word_count.toLocaleString()} / {t.target_words.toLocaleString()} words ·{" "}
                {new Date(t.created_at).toLocaleDateString()}
              </div>
            </Link>
            <button
              onClick={() => download(t.id)}
              disabled={dlBusy === t.id}
              className="text-ink/60 hover:text-ink p-2 disabled:opacity-50"
              aria-label="Download thesis"
              title="Download .docx"
            >
              {dlBusy === t.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this thesis?")) del.mutate(t.id);
              }}
              className="text-ink/40 hover:text-red-700 p-2"
              aria-label="Delete thesis"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
