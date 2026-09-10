import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listStudyTasks,
  createStudyTask,
  updateStudyTask,
  toggleStudyTask,
  deleteStudyTask,
  generateStudyPlan,
  type StudyTask,
  type TaskPriority,
  type TaskSource,
} from "@/lib/study-planner.functions";
import { getLearningSignals, pastQuestionFacets } from "@/lib/past-questions.functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  Check,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Lightbulb,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/study-planner")({
  head: () => ({ meta: [{ title: "Study Planner — Mybrainpadi" }] }),
  component: StudyPlannerPage,
});

// ─── Date helpers (client local time) ──────────────────────────────────────
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-ink/50",
};

interface FormState {
  title: string;
  subject: string;
  notes: string;
  date: string;
  time: string;
  priority: TaskPriority;
  source: TaskSource;
}

const EMPTY_FORM: FormState = {
  title: "",
  subject: "",
  notes: "",
  date: toDateStr(new Date()),
  time: "",
  priority: "medium",
  source: "manual",
};

function StudyPlannerPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listStudyTasks);
  const createFn = useServerFn(createStudyTask);
  const updateFn = useServerFn(updateStudyTask);
  const toggleFn = useServerFn(toggleStudyTask);
  const deleteFn = useServerFn(deleteStudyTask);
  const generateFn = useServerFn(generateStudyPlan);
  const signalsFn = useServerFn(getLearningSignals);
  const facetsFn = useServerFn(pastQuestionFacets);

  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genDays, setGenDays] = useState(7);
  const [genHours, setGenHours] = useState(3);
  const [genSubjects, setGenSubjects] = useState("");
  const [genFocus, setGenFocus] = useState("");

  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(addDays(weekStart, 6));

  const { data: tasks } = useQuery({
    queryKey: ["study-tasks", weekStartStr],
    queryFn: () => listFn({ data: { from: weekStartStr, to: weekEndStr } }),
  });

  const { data: signals } = useQuery({
    queryKey: ["learning-signals"],
    queryFn: () => signalsFn(),
  });

  const { data: facets } = useQuery({
    queryKey: ["pq-facets"],
    queryFn: () => facetsFn(),
    staleTime: 5 * 60_000,
  });

  const subjectSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const s of facets?.subjects ?? []) if (s) set.add(s);
    for (const c of facets?.courses ?? []) if (c) set.add(c);
    return Array.from(set).sort();
  }, [facets]);

  const weakAreas = useMemo(() => {
    return ((signals ?? []) as Array<{ subject: string; attempts: number; correct: number }>)
      .filter((s) => s.attempts > 0)
      .map((s) => ({ ...s, accuracy: Math.round((s.correct / s.attempts) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
  }, [signals]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["study-tasks"] });

  const createMutation = useMutation({
    mutationFn: () => createFn({ data: { ...form } }),
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success("Task added.");
    },
    onError: (e) => toast.error(String(e)),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateFn({ data: { id: editingId!, ...form } }),
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success("Task updated.");
    },
    onError: (e) => toast.error(String(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleFn({ data: { id } }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Task deleted.");
    },
    onError: (e) => toast.error(String(e)),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateFn({
        data: {
          start_date: weekStartStr,
          days: genDays,
          hours_per_day: genHours,
          subjects: genSubjects.split(",").map((s) => s.trim()).filter(Boolean),
          focus: genFocus || undefined,
        },
      }),
    onSuccess: (generated) => {
      invalidate();
      setShowGenerate(false);
      setGenSubjects("");
      setGenFocus("");
      toast.success(`Generated ${generated.length} tasks for your plan.`);
    },
    onError: (e) => toast.error(String(e)),
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: selectedDate !== "all" ? selectedDate : weekStartStr });
    setShowForm(true);
  }

  function openEdit(t: StudyTask) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      subject: t.subject ?? "",
      notes: t.notes ?? "",
      date: t.due_date,
      time: t.start_time ?? "",
      priority: t.priority,
      source: t.source,
    });
    setShowForm(true);
  }

  function openWeakTask(subject: string) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, subject, source: "weak_area", date: weekStartStr });
    setShowForm(true);
  }

  function submitForm() {
    if (!form.title.trim()) {
      toast.error("Give the task a title.");
      return;
    }
    if (editingId) updateMutation.mutate();
    else createMutation.mutate();
  }

  // ── Group + sort tasks ───────────────────────────────────────────────────
  const byDate = useMemo(() => {
    const map = new Map<string, StudyTask[]>();
    for (const t of tasks ?? []) {
      const arr = map.get(t.due_date) ?? [];
      arr.push(t);
      map.set(t.due_date, arr);
    }
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const p = (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
        if (p !== 0) return p;
        const ta = a.start_time ?? "99:99";
        const tb = b.start_time ?? "99:99";
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [tasks]);

  const visibleDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) dates.push(toDateStr(addDays(weekStart, i)));
    return dates;
  }, [weekStart]);

  const weekTaskCount = (tasks ?? []).length;
  const doneCount = (tasks ?? []).filter((t) => t.status === "done").length;

  const dayShort = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };
  const dayNum = (dateStr: string) => Number(dateStr.slice(8, 10));
  const isToday = (dateStr: string) => dateStr === toDateStr(new Date());

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/learn" })}
            aria-label="Back to Learn"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Study Planner</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Plan your study week</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
                Learn · Practice
              </div>
              <h1 className="font-serif text-3xl text-ink">Study Planner</h1>
              <p className="text-ink/60 text-sm mt-1">
                Organise tasks, mark them done, or generate a week with AI.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenerate(true)}
                className="px-4 py-2 rounded-sm text-sm font-medium border border-ink/15 hover:bg-ink/5 transition-colors flex items-center gap-2"
              >
                <Sparkles className="size-4" /> AI plan
              </button>
              <button
                onClick={openAdd}
                className="px-4 py-2 rounded-sm text-sm font-medium bg-ink text-bone hover:bg-sage transition-colors flex items-center gap-2"
              >
                <Plus className="size-4" /> Add task
              </button>
            </div>
          </div>

          {/* Week strip */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                className="size-8 rounded-md flex items-center justify-center hover:bg-ink/5 text-ink/60"
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-xs text-ink/50 font-medium">
                {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} —{" "}
                {addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" · "}
                {doneCount}/{weekTaskCount} done
              </span>
              <button
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="size-8 rounded-md flex items-center justify-center hover:bg-ink/5 text-ink/60"
                aria-label="Next week"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-8 gap-1.5">
              <button
                onClick={() => setSelectedDate("all")}
                className={`rounded-sm border px-1 py-2 text-center transition-colors ${
                  selectedDate === "all"
                    ? "border-ink bg-ink text-bone"
                    : "border-ink/10 hover:bg-ink/5"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70">All</div>
                <div className="text-sm font-semibold">{weekTaskCount}</div>
              </button>
              {visibleDates.map((dateStr) => {
                const count = byDate.get(dateStr)?.length ?? 0;
                const active = selectedDate === dateStr;
                const today = isToday(dateStr);
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`rounded-sm border px-1 py-2 text-center transition-colors ${
                      active
                        ? "border-ink bg-ink text-bone"
                        : today
                          ? "border-sage bg-sage/5"
                          : "border-ink/10 hover:bg-ink/5"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      {dayShort(dateStr)}
                    </div>
                    <div className="text-sm font-semibold">{dayNum(dateStr)}</div>
                    {count > 0 && (
                      <div className={`text-[10px] ${active ? "text-bone/80" : "text-sage"}`}>{count}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weak areas */}
          {weakAreas.length > 0 && (
            <div className="mb-6 bg-card border border-ink/10 rounded-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="size-4 text-sage" />
                <h2 className="text-sm font-semibold text-ink">Suggested focus areas</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {weakAreas.map((s) => (
                  <button
                    key={s.subject}
                    onClick={() => openWeakTask(s.subject)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-sm border border-ink/10 bg-paper hover:bg-sage/5 transition-colors"
                    title="Add a study task for this subject"
                  >
                    <span className="font-medium">{s.subject}</span>
                    <span className="text-ink/50">{s.accuracy}%</span>
                    <Plus className="size-3 text-sage" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI generate panel */}
          {showGenerate && (
            <div className="mb-6 bg-card border border-ink/10 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-sage" />
                  <h2 className="text-sm font-semibold text-ink">Generate a study week</h2>
                </div>
                <button
                  onClick={() => setShowGenerate(false)}
                  className="text-ink/40 hover:text-ink"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">Days</span>
                  <select
                    value={genDays}
                    onChange={(e) => setGenDays(Number(e.target.value))}
                    className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  >
                    {[3, 5, 7, 10, 14].map((n) => (
                      <option key={n} value={n}>{n} days</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">Hours/day</span>
                  <select
                    value={genHours}
                    onChange={(e) => setGenHours(Number(e.target.value))}
                    className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}h</option>
                    ))}
                  </select>
                </label>
                <label className="block col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Subjects (comma separated)
                  </span>
                  <input
                    value={genSubjects}
                    onChange={(e) => setGenSubjects(e.target.value)}
                    list="planner-subjects"
                    placeholder="e.g. Biology, Mathematics"
                    className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Extra focus (optional)
                </span>
                <input
                  value={genFocus}
                  onChange={(e) => setGenFocus(e.target.value)}
                  placeholder="e.g. prepare for my exam next Friday"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                />
              </label>

              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Generate plan
                  </>
                )}
              </button>
            </div>
          )}

          {/* Add / edit form */}
          {showForm && (
            <div className="mb-6 bg-card border border-ink/10 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">
                  {editingId ? "Edit task" : "Add a task"}
                </h2>
                <button onClick={resetForm} className="text-ink/40 hover:text-ink" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="What do you need to do? (e.g. Revise cell division)"
                  className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  autoFocus
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    list="planner-subjects"
                    placeholder="Subject / course"
                    className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                    />
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                      className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                    Priority
                  </span>
                  <div className="flex gap-2">
                    {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setForm((f) => ({ ...f, priority: p }))}
                        className={`px-3 py-1.5 rounded-sm border text-xs transition-colors ${
                          form.priority === p
                            ? "border-ink bg-ink text-bone"
                            : "border-ink/15 text-ink/60 hover:bg-ink/5"
                        }`}
                      >
                        {PRIORITY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="w-full bg-paper border border-ink/10 rounded-sm px-3 py-2 text-sm resize-y"
                />

                <div className="flex gap-2">
                  <button
                    onClick={submitForm}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {editingId ? "Save changes" : "Add task"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2.5 border border-ink/15 rounded-sm text-sm hover:bg-ink/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tasks list */}
          <div className="space-y-2">
            {visibleDates
              .filter((d) => selectedDate === "all" || selectedDate === d)
              .map((dateStr) => {
                const dayTasks = byDate.get(dateStr) ?? [];
                if (dayTasks.length === 0) return null;
                return (
                  <div key={dateStr} className="mb-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 mb-1.5">
                      {dayShort(dateStr)} ·{" "}
                      {new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="space-y-2">
                      {dayTasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          onToggle={() => toggleMutation.mutate(t.id)}
                          onEdit={() => openEdit(t)}
                          onDelete={() => deleteMutation.mutate(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

            {weekTaskCount === 0 && (
              <div className="text-center py-16 text-ink/50">
                <Calendar className="size-8 mx-auto mb-3 text-ink/20" />
                <p className="text-sm">No tasks this week yet.</p>
                <p className="text-xs mt-1">Add a task or generate a plan with AI.</p>
              </div>
            )}
          </div>

          {/* Shared datalist for subject suggestions */}
          <datalist id="planner-subjects">
            {subjectSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: StudyTask;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "done";
  return (
    <div
      className={`flex items-start gap-3 rounded-sm border p-3 transition-colors ${
        done ? "border-ink/5 bg-ink/[0.02]" : "border-ink/10 bg-card"
      }`}
    >
      <button
        onClick={onToggle}
        aria-label={done ? "Mark as pending" : "Mark as done"}
        className={`mt-0.5 size-5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${
          done ? "bg-verde border-verde text-white" : "border-ink/25 hover:border-verde"
        }`}
      >
        {done && <Check className="size-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm ${done ? "line-through text-ink/40" : "text-ink"}`}>
            {task.title}
          </p>
          {task.source === "ai" && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-sage/10 text-sage font-semibold">
              AI
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-ink/50">
          {task.subject && <span className="font-medium text-ink/70">{task.subject}</span>}
          {task.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {task.start_time}
            </span>
          )}
          <span className={PRIORITY_COLOR[task.priority]}>{PRIORITY_LABEL[task.priority]}</span>
        </div>
        {task.notes && <p className="text-xs text-ink/40 mt-1">{task.notes}</p>}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="size-7 rounded-md flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5"
          aria-label="Edit"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="size-7 rounded-md flex items-center justify-center text-ink/40 hover:text-red-600 hover:bg-red-50"
          aria-label="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
