import { useState } from "react";
import { Bookmark, BookmarkCheck, FileText, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toggleSaveTopic } from "@/lib/topics.functions";
import { toast } from "sonner";

export type TopicCardData = {
  id: string;
  title: string;
  problem_statement: string;
  research_gap: string;
  objectives: string[];
  novelty_score: number;
  feasibility_score: number;
  category: string | null;
  department: string | null;
  saved: boolean;
};

export function TopicCard({ topic, onChange }: { topic: TopicCardData; onChange?: () => void }) {
  const [saved, setSaved] = useState(topic.saved);
  const [busy, setBusy] = useState(false);
  const toggle = useServerFn(toggleSaveTopic);

  const handleSave = async () => {
    setBusy(true);
    try {
      await toggle({ data: { id: topic.id, saved: !saved } });
      setSaved(!saved);
      toast.success(saved ? "Removed from library" : "Saved to library");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group p-6 bg-card border border-ink/10 rounded-sm hover:border-ink/25 transition-colors">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex gap-2 flex-wrap">
          {topic.category && (
            <span className="px-2 py-0.5 bg-ink/5 text-[10px] font-medium tracking-tight border border-ink/10 uppercase">
              {topic.category}
            </span>
          )}
          {topic.department && (
            <span className="px-2 py-0.5 bg-ink/5 text-[10px] font-medium tracking-tight border border-ink/10 uppercase">
              {topic.department}
            </span>
          )}
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="text-center">
            <div className="text-[9px] text-ink/40 uppercase tracking-tighter font-bold">Novelty</div>
            <div className="text-base font-serif font-bold text-ink">
              {Number(topic.novelty_score).toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-ink/40 uppercase tracking-tighter font-bold">Feasibility</div>
            <div className="text-base font-serif font-bold text-ink">
              {Number(topic.feasibility_score).toFixed(1)}
            </div>
          </div>
        </div>
      </div>
      <h3 className="font-serif text-lg leading-snug mb-3 text-ink">{topic.title}</h3>
      <p className="text-sm text-ink/70 leading-relaxed mb-3">
        <span className="text-[10px] uppercase tracking-widest font-bold text-ink/50 mr-2">
          Problem
        </span>
        {topic.problem_statement}
      </p>
      <p className="text-sm text-ink/70 leading-relaxed mb-4">
        <span className="text-[10px] uppercase tracking-widest font-bold text-ink/50 mr-2">Gap</span>
        {topic.research_gap}
      </p>
      {topic.objectives.length > 0 && (
        <ul className="text-sm text-ink/70 space-y-1 mb-5 list-disc list-inside marker:text-sage">
          {topic.objectives.slice(0, 3).map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleSave}
          disabled={busy}
          className="text-[11px] font-medium px-3 py-1.5 border border-ink/15 rounded-sm hover:bg-parchment transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          disabled
          title="Coming soon"
          className="text-[11px] font-medium px-3 py-1.5 bg-ink text-bone rounded-sm flex items-center gap-1.5 opacity-50 cursor-not-allowed"
        >
          <FileText className="size-3.5" /> Draft Proposal
        </button>
        <button
          disabled
          title="Coming soon"
          className="text-[11px] font-medium px-3 py-1.5 border border-ink/15 rounded-sm flex items-center gap-1.5 opacity-50 cursor-not-allowed"
        >
          <Sparkles className="size-3.5" /> Draft Thesis
        </button>
      </div>
    </div>
  );
}
