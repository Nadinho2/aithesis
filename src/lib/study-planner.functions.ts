import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "done";
export type TaskSource = "manual" | "ai" | "weak_area";

export interface StudyTask {
  id: string;
  user_id: string;
  title: string;
  subject: string | null;
  notes: string | null;
  due_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  priority: TaskPriority;
  status: TaskStatus;
  source: TaskSource;
  created_at: string;
  completed_at: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function normalizeTask(row: any): StudyTask {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    subject: row.subject ?? null,
    notes: row.notes ?? null,
    due_date: row.due_date,
    start_time: row.start_time ?? null,
    priority: row.priority ?? "medium",
    status: row.status ?? "pending",
    source: row.source ?? "manual",
    created_at: row.created_at,
    completed_at: row.completed_at ?? null,
  };
}

// ─── List tasks (optionally within a date window) ──────────────────────────
export const listStudyTasks = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: z.string().regex(DATE_RE).optional(),
        to: z.string().regex(DATE_RE).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    let q = supabase
      .from("study_plan_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(500);

    if (data.from) q = q.gte("due_date", data.from);
    if (data.to) q = q.lte("due_date", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? []).map(normalizeTask) as StudyTask[];
  });

// ─── Create a task ─────────────────────────────────────────────────────────
const CreateInput = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  due_date: z.string().regex(DATE_RE),
  start_time: z.string().regex(TIME_RE).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  source: z.enum(["manual", "ai", "weak_area"]).default("manual"),
});

export const createStudyTask = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: row, error } = await supabase
      .from("study_plan_tasks")
      .insert({
        user_id: userId,
        title: data.title.trim(),
        subject: data.subject?.trim() || null,
        notes: data.notes?.trim() || null,
        due_date: data.due_date,
        start_time: data.start_time || null,
        priority: data.priority,
        status: "pending",
        source: data.source,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return normalizeTask(row) as StudyTask;
  });

// ─── Update a task ─────────────────────────────────────────────────────────
const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  subject: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  due_date: z.string().regex(DATE_RE),
  start_time: z.string().regex(TIME_RE).optional(),
  priority: z.enum(["low", "medium", "high"]),
});

export const updateStudyTask = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: row, error } = await supabase
      .from("study_plan_tasks")
      .update({
        title: data.title.trim(),
        subject: data.subject?.trim() || null,
        notes: data.notes?.trim() || null,
        due_date: data.due_date,
        start_time: data.start_time || null,
        priority: data.priority,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return normalizeTask(row) as StudyTask;
  });

// ─── Toggle done / pending ─────────────────────────────────────────────────
export const toggleStudyTask = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: existing } = await supabase
      .from("study_plan_tasks")
      .select("status")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) throw new Error("Task not found.");

    const next = existing.status === "done" ? "pending" : "done";
    const { data: row, error } = await supabase
      .from("study_plan_tasks")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return normalizeTask(row) as StudyTask;
  });

// ─── Delete a task ─────────────────────────────────────────────────────────
export const deleteStudyTask = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { error } = await supabase
      .from("study_plan_tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── AI: generate a weekly study plan ──────────────────────────────────────
function addDaysUtc(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const GenerateInput = z.object({
  start_date: z.string().regex(DATE_RE),
  days: z.number().int().min(1).max(14).default(7),
  hours_per_day: z.number().int().min(1).max(12).default(3),
  subjects: z.array(z.string().max(120)).max(30).default([]),
  focus: z.string().max(500).optional(),
});

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => GenerateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("AI is not configured yet.");

    // Learner context + weak areas for a smarter plan.
    const { data: profile } = await supabase
      .from("profiles")
      .select("learner_type, university, faculty, department, level, exam_tracks")
      .eq("id", userId)
      .maybeSingle();

    const { data: signals } = await supabase
      .from("learning_signals")
      .select("subject, attempts, correct")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    const weakSubjects = (signals ?? [])
      .filter((s: any) => (s.attempts ?? 0) > 0)
      .map((s: any) => s.subject)
      .filter(Boolean) as string[];

    const requestedSubjects = (data.subjects ?? [])
      .map((s) => s.trim())
      .filter(Boolean);

    const subjectPool = Array.from(new Set([...weakSubjects, ...requestedSubjects]));

    const contextLines: string[] = [];
    if (profile?.learner_type === "university") {
      contextLines.push(
        `University student${profile.university ? ` at ${profile.university}` : ""}${profile.level ? `, level ${profile.level}` : ""}${profile.department ? `, department ${profile.department}` : ""}.`,
      );
    } else if (profile?.learner_type === "pre_university") {
      const tracks = Array.isArray(profile.exam_tracks)
        ? (profile.exam_tracks as string[]).join(", ")
        : "";
      contextLines.push(`Pre-university student${tracks ? ` preparing for ${tracks}` : ""}.`);
    }

    if (subjectPool.length > 0) {
      contextLines.push(`Subjects to focus on (prioritise the first ones): ${subjectPool.join(", ")}.`);
    }
    if (weakSubjects.length > 0) {
      contextLines.push(`Weakest areas (revise these most): ${weakSubjects.join(", ")}.`);
    }
    if (data.focus?.trim()) {
      contextLines.push(`Additional focus: ${data.focus.trim()}.`);
    }

    const userPrompt =
      contextLines.join("\n") +
      `\n\nBuild a ${data.days}-day study plan with roughly ${data.hours_per_day} study hour(s) per day.`;

    const minTasks = Math.max(data.days, 3);
    const maxTasks = Math.min(data.days * 3, 40);

    const systemPrompt = `You are an expert study coach for university and pre-university students. Produce a realistic, achievable study plan.

Return ONLY valid JSON (no markdown, no code fences):
{
  "tasks": [
    {
      "day_offset": 0,
      "title": "short concrete task, e.g. 'Revise photosynthesis notes'",
      "subject": "Biology",
      "start_time": "09:00",
      "priority": "high",
      "notes": "optional one-line guidance"
    }
  ]
}

Rules:
- day_offset is an integer from 0 to ${data.days - 1} (0 = the first day).
- Spread tasks evenly across days; do not overload a single day.
- With ${data.hours_per_day} hour(s)/day, produce 1-3 tasks per day.
- Cover weak subjects first, then the rest of the subject pool.
- "title" must be short and actionable.
- "start_time" must be 24-hour HH:mm or null.
- "priority" must be exactly one of: low, medium, high.
- "subject" may be null if a task is general (e.g. 'Review flashcards').
- Return between ${minTasks} and ${maxTasks} tasks total.`;

    const parsed = await callAI(apiKey, {
      model: "deepseek-reasoner",
      max_tokens: 12000,
      system: systemPrompt,
      user: userPrompt,
    });

    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    if (tasks.length === 0) {
      throw new Error("Could not generate a plan. Try again.");
    }

    const rows = tasks.slice(0, maxTasks).map((t: any) => {
      const dayOffset = Math.max(0, Math.min(data.days - 1, Number(t.day_offset) || 0));
      const startTime = typeof t.start_time === "string" && TIME_RE.test(t.start_time) ? t.start_time : null;
      const priority: TaskPriority = ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium";

      return {
        user_id: userId,
        title: String(t.title ?? "Study session").trim().slice(0, 200) || "Study session",
        subject: t.subject ? String(t.subject).trim().slice(0, 200) : null,
        notes: t.notes ? String(t.notes).trim().slice(0, 2000) : null,
        due_date: addDaysUtc(data.start_date, dayOffset),
        start_time: startTime,
        priority,
        status: "pending",
        source: "ai",
      };
    });

    const { data: inserted, error } = await supabase
      .from("study_plan_tasks")
      .insert(rows)
      .select("*");

    if (error) throw new Error(error.message);
    return (inserted ?? []).map(normalizeTask) as StudyTask[];
  });
