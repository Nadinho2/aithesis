import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";

export interface SubjectProgress {
  subject: string;
  attempts: number;
  correct: number;
  accuracy: number;
  weakConcepts: string[];
}

export interface DayProgress {
  date: string; // YYYY-MM-DD
  total: number;
  done: number;
}

export interface ProgressOverview {
  planner: {
    total: number;
    done: number;
    pending: number;
    overdue: number;
    completionRate: number;
    streak: number;
    last7Days: DayProgress[];
    bySubject: Array<{ subject: string; total: number; done: number }>;
  };
  quiz: {
    attempts: number;
    correct: number;
    accuracy: number;
    subjects: SubjectProgress[];
  };
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const getProgressOverview = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const { data: tasks, error: tasksError } = await supabase
      .from("study_plan_tasks")
      .select("subject, due_date, status, completed_at")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .limit(1000);

    if (tasksError) throw new Error(tasksError.message);

    const rows = (tasks ?? []) as Array<{
      subject: string | null;
      due_date: string;
      status: "pending" | "done";
      completed_at: string | null;
    }>;

    const total = rows.length;
    const done = rows.filter((t) => t.status === "done").length;
    const pending = total - done;
    const todayStr = toDateStr(new Date());
    const overdue = rows.filter((t) => t.status === "pending" && t.due_date < todayStr).length;
    const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);

    const last7Days: DayProgress[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateStr(d);
      const dayTasks = rows.filter((t) => t.due_date === key);
      last7Days.push({
        date: key,
        total: dayTasks.length,
        done: dayTasks.filter((t) => t.status === "done").length,
      });
    }

    const completedDays = new Set<string>();
    for (const t of rows) {
      if (t.status === "done" && t.completed_at) {
        completedDays.add(toDateStr(new Date(t.completed_at)));
      }
    }
    let streak = 0;
    const cursor = new Date();
    if (!completedDays.has(toDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (completedDays.has(toDateStr(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const subjectMap = new Map<string, { total: number; done: number }>();
    for (const t of rows) {
      const subject = t.subject?.trim() || "General";
      const entry = subjectMap.get(subject) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (t.status === "done") entry.done += 1;
      subjectMap.set(subject, entry);
    }
    const bySubject = Array.from(subjectMap.entries())
      .map(([subject, v]) => ({ subject, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const { data: signals, error: signalsError } = await supabase
      .from("learning_signals")
      .select("subject, attempts, correct, weak_concepts")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (signalsError) throw new Error(signalsError.message);

    const quizSubjects: SubjectProgress[] = (signals ?? [])
      .filter((s: any) => (s.attempts ?? 0) > 0)
      .map(
        (s: any): SubjectProgress => ({
          subject: s.subject,
          attempts: s.attempts,
          correct: s.correct,
          accuracy: Math.round((s.correct / s.attempts) * 100),
          weakConcepts: Array.isArray(s.weak_concepts) ? s.weak_concepts : [],
        }),
      )
      .sort((a: SubjectProgress, b: SubjectProgress) => a.accuracy - b.accuracy);

    const quizAttempts = quizSubjects.reduce((sum, s) => sum + s.attempts, 0);
    const quizCorrect = quizSubjects.reduce((sum, s) => sum + s.correct, 0);
    const quizAccuracy = quizAttempts === 0 ? 0 : Math.round((quizCorrect / quizAttempts) * 100);

    return {
      planner: { total, done, pending, overdue, completionRate, streak, last7Days, bySubject },
      quiz: { attempts: quizAttempts, correct: quizCorrect, accuracy: quizAccuracy, subjects: quizSubjects },
    } as ProgressOverview;
  });
