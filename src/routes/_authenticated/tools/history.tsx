import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAssignments, deleteAssignment,
  listExams, deleteExam,
  listPresentations, deletePresentation,
  listCvs, deleteCv,
  listSideHustles, deleteSideHustle,
} from "@/lib/tool-history.functions";
import {
  FileText, GraduationCap, Presentation, UserSquare2, Zap,
  Loader2, Trash2, Calendar, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/history")({
  head: () => ({ meta: [{ title: "Tool History — Mybrainpadi" }] }),
  component: ToolHistoryPage,
});

type Tab = "assignments" | "exams" | "presentations" | "cvs" | "side_hustles";

const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "assignments", label: "Assignments", icon: FileText },
  { key: "exams", label: "Exams", icon: GraduationCap },
  { key: "presentations", label: "Presentations", icon: Presentation },
  { key: "cvs", label: "CVs", icon: UserSquare2 },
  { key: "side_hustles", label: "Side Hustles", icon: Zap },
];

function ToolHistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const queryClient = useQueryClient();

  const listFns: Record<Tab, any> = {
    assignments: useServerFn(listAssignments),
    exams: useServerFn(listExams),
    presentations: useServerFn(listPresentations),
    cvs: useServerFn(listCvs),
    side_hustles: useServerFn(listSideHustles),
  };

  const deleteFns: Record<Tab, any> = {
    assignments: useServerFn(deleteAssignment),
    exams: useServerFn(deleteExam),
    presentations: useServerFn(deletePresentation),
    cvs: useServerFn(deleteCv),
    side_hustles: useServerFn(deleteSideHustle),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["tool-history", activeTab],
    queryFn: () => listFns[activeTab](),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFns[activeTab]({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-history", activeTab] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(String(e)),
  });

  const TabIcon = tabs.find((t) => t.key === activeTab)?.icon ?? FileText;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
          Student Tools
        </div>
        <h1 className="font-serif text-3xl">My History</h1>
        <p className="text-ink/60 text-sm mt-1">
          View your past generated content across all tools.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink/10 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                active
                  ? "border-ink text-ink font-medium"
                  : "border-transparent text-ink/40 hover:text-ink/70"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-ink/30" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16 border border-ink/10 rounded-sm">
          <TabIcon className="mx-auto size-8 text-ink/20 mb-3" />
          <p className="text-ink/40 text-sm mb-4">No {activeTab} yet</p>
          <Link
            to={(() => {
              switch (activeTab) {
                case "assignments": return "/tools/assignment";
                case "exams": return "/tools/exam";
                case "presentations": return "/tools/presentation";
                case "cvs": return "/tools/cv";
                case "side_hustles": return "/tools/side-hustle";
              }
            })()}
            className="text-sm text-sage hover:underline font-medium"
          >
            Create one now
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item: any) => (
            <HistoryCard
              key={item.id}
              item={item}
              tab={activeTab}
              onDelete={() => {
                if (confirm("Delete this item?")) delMut.mutate(item.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, tab, onDelete }: { item: any; tab: Tab; onDelete: () => void }) {
  let title = "";
  let subtitle = "";
  let viewPath = "";

  switch (tab) {
    case "assignments":
      title = item.title?.slice(0, 80) + (item.title?.length > 80 ? "…" : "") || item.question?.slice(0, 80) + (item.question?.length > 80 ? "…" : "");
      subtitle = `${item.academic_level ?? "UG"} · ${item.grading_target ? `Target: ${item.grading_target}` : ""} · ${item.word_count ?? 0} words`;
      viewPath = `/tools/assignment/${item.id}`;
      break;
    case "exams":
      title = `${item.total_questions} ${item.question_type} questions` + (item.subject_notes ? ` — ${item.subject_notes.slice(0, 50)}…` : "");
      subtitle = item.subject_notes?.slice(0, 80) + (item.subject_notes?.length > 80 ? "…" : "");
      viewPath = `/tools/exam/${item.id}`;
      break;
    case "presentations":
      title = item.topic;
      subtitle = `${item.slide_count} slides`;
      viewPath = `/tools/presentation/${item.id}`;
      break;
    case "cvs":
      title = `CV — ${new Date(item.created_at).toLocaleDateString()}`;
      subtitle = "CV document";
      viewPath = `/tools/cv/${item.id}`;
      break;
    case "side_hustles": {
      const answers = typeof item.answers === "string" ? JSON.parse(item.answers) : item.answers;
      title = answers?.skills?.slice(0, 60) + (answers?.skills?.length > 60 ? "…" : "") || "Side hustle ideas";
      subtitle = new Date(item.created_at).toLocaleDateString();
      viewPath = `/tools/side-hustle/${item.id}`;
      break;
    }
  }

  return (
    <Link
      to={viewPath}
      className="flex items-center justify-between bg-card border border-ink/10 rounded-sm p-4 hover:border-ink/20 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-sage transition-colors">{title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-ink/40">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {new Date(item.created_at).toLocaleDateString()}
          </span>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="p-1.5 text-ink/30 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 className="size-4" />
        </button>
        <ChevronRight className="size-4 text-ink/20 group-hover:text-ink/40 transition-colors" />
      </div>
    </Link>
  );
}
