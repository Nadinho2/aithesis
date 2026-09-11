import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";

export type MicroCourseCategory = "research" | "career" | "study-skills" | "wellbeing";
export type MicroCourseStatus = "draft" | "published" | "archived";

export type MicroCourseBlockType = "heading" | "text" | "bullet" | "tip";

export interface MicroCourseBlock {
  type: MicroCourseBlockType;
  body: string;
}

export interface MicroCourseCheckQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface MicroCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: MicroCourseCategory;
  duration_minutes: number;
  content: MicroCourseBlock[];
  check_questions: MicroCourseCheckQuestion[];
  status: MicroCourseStatus;
  sort_order: number;
}

export interface MicroCourseListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: MicroCourseCategory;
  duration_minutes: number;
  completed: boolean;
  passed: boolean;
}

export interface MicroCourseSuggestion {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: MicroCourseCategory;
  duration_minutes: number;
  reason: string;
}

const CATEGORIES: MicroCourseCategory[] = ["research", "career", "study-skills", "wellbeing"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function asBlocks(value: unknown): MicroCourseBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((b: any) => ({
      type: (["heading", "text", "bullet", "tip"].includes(b?.type) ? b.type : "text") as MicroCourseBlockType,
      body: typeof b?.body === "string" ? b.body : "",
    }))
    .filter((b) => b.body.trim().length > 0);
}

function asCheckQuestions(value: unknown): MicroCourseCheckQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((q: any) => ({
      question: typeof q?.question === "string" ? q.question : "",
      options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : [],
      answer: typeof q?.answer === "string" ? q.answer : "",
      explanation: typeof q?.explanation === "string" ? q.explanation : undefined,
    }))
    .filter((q) => q.question.trim().length > 0 && q.options.length >= 2 && q.answer.trim().length > 0);
}

function normalizeCourse(row: any): MicroCourse {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    category: row.category ?? "study-skills",
    duration_minutes: row.duration_minutes ?? 6,
    content: asBlocks(row.content),
    check_questions: asCheckQuestions(row.check_questions),
    status: row.status ?? "draft",
    sort_order: row.sort_order ?? 0,
  };
}

// ─── List published courses (with per-user completion state) ───────────────
export const listMicroCourses = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const [{ data: courses }, { data: completions }] = await Promise.all([
      supabase
        .from("micro_courses")
        .select("id, slug, title, description, category, duration_minutes, sort_order")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("micro_course_completions")
        .select("course_id, passed")
        .eq("user_id", userId),
    ]);

    if (courses === null) return [] as MicroCourseListItem[];

    const done = new Map<string, boolean>(
      ((completions ?? []) as Array<{ course_id: string; passed: boolean }>).map((c) => [
        c.course_id,
        c.passed,
      ]),
    );

    return (courses ?? []).map((c: any) => {
      const passed = done.get(c.id);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description ?? null,
        category: c.category,
        duration_minutes: c.duration_minutes,
        completed: passed !== undefined,
        passed: passed === true,
      } as MicroCourseListItem;
    });
  });

// ─── Fetch a single published course (answers withheld) ────────────────────
export const getMicroCourse = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase
      .from("micro_courses")
      .select("*")
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Lesson not found.");

    const course = normalizeCourse(row);
    // Never leak the correct answers to the client.
    const publicQuestions = course.check_questions.map((q) => ({
      question: q.question,
      options: q.options,
    }));

    return {
      ...course,
      check_questions: publicQuestions,
    };
  });

// ─── Submit the post-lesson check (grades + records completion) ────────────
const SubmitCheckInput = z.object({
  course_id: z.string().uuid(),
  answers: z.array(z.string().max(500)).max(10),
});

export const submitMicroCourseCheck = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SubmitCheckInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: row, error } = await supabase
      .from("micro_courses")
      .select("check_questions")
      .eq("id", data.course_id)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Lesson not found.");

    const questions = asCheckQuestions(row.check_questions);
    if (questions.length === 0) throw new Error("This lesson has no check questions.");

    const normalize = (s: string) => s.trim().toLowerCase();
    let correct = 0;
    const results = questions.map((q, i) => {
      const selected = data.answers[i] ?? "";
      const isCorrect = normalize(selected) === normalize(q.answer);
      if (isCorrect) correct += 1;
      return {
        question: q.question,
        selected,
        correct_answer: q.answer,
        is_correct: isCorrect,
        explanation: q.explanation ?? null,
      };
    });

    const total = questions.length;
    const passed = correct / total >= 0.6;

    const { error: upsertError } = await supabase.from("micro_course_completions").upsert(
      {
        user_id: userId,
        course_id: data.course_id,
        check_score: correct,
        check_total: total,
        passed,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" },
    );

    if (upsertError) throw new Error(upsertError.message);

    return { results, correct, total, passed };
  });

// ─── Contextual suggestions from weak areas in learning_signals ────────────
export const getMicroCourseSuggestions = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const [{ data: signals }, { data: courses }, { data: completions }] = await Promise.all([
      supabase
        .from("learning_signals")
        .select("subject, attempts, correct")
        .eq("user_id", userId),
      supabase
        .from("micro_courses")
        .select("id, slug, title, description, category, duration_minutes")
        .eq("status", "published"),
      supabase
        .from("micro_course_completions")
        .select("course_id")
        .eq("user_id", userId),
    ]);

    const completedIds = new Set(
      ((completions ?? []) as Array<{ course_id: string }>).map((c) => c.course_id),
    );

    // Weak subjects: attempted but scoring below 60%.
    const weakSubjects = ((signals ?? []) as Array<{ subject: string; attempts: number; correct: number }>)
      .filter((s) => s.attempts > 0 && s.correct / s.attempts < 0.6)
      .map((s) => s.subject.trim().toLowerCase())
      .filter(Boolean);

    if (weakSubjects.length === 0 || !courses || courses.length === 0) {
      return [] as MicroCourseSuggestion[];
    }

    const suggestions: MicroCourseSuggestion[] = [];
    for (const course of courses as any[]) {
      if (completedIds.has(course.id)) continue;
      const haystack = `${course.title} ${course.description ?? ""} ${course.category}`.toLowerCase();
      const match = weakSubjects.find((subject) => haystack.includes(subject));
      if (match) {
        suggestions.push({
          id: course.id,
          slug: course.slug,
          title: course.title,
          description: course.description ?? null,
          category: course.category,
          duration_minutes: course.duration_minutes,
          reason: match,
        });
      }
    }

    return suggestions.slice(0, 5);
  });

// ═══════════════════════════════════════════════════════════
// Admin — content ownership stays with the team (not open uploads)
// ═══════════════════════════════════════════════════════════

function assertAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

export const adminListMicroCourses = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("micro_courses")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(normalizeCourse) as MicroCourse[];
  });

const UpsertCourseInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["research", "career", "study-skills", "wellbeing"]),
  duration_minutes: z.number().int().min(1).max(60).default(6),
  content: z.array(z.object({ type: z.enum(["heading", "text", "bullet", "tip"]), body: z.string().min(1) })),
  check_questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string()).min(2),
        answer: z.string().min(1),
        explanation: z.string().optional(),
      }),
    )
    .default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  sort_order: z.number().int().default(0),
});

export const adminUpsertMicroCourse = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => UpsertCourseInput.parse(i))
  .handler(async ({ data, context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;

    const payload = {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      category: data.category,
      duration_minutes: data.duration_minutes,
      content: data.content,
      check_questions: data.check_questions,
      status: data.status,
      sort_order: data.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("micro_courses")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return normalizeCourse(row) as MicroCourse;
    }

    const { data: row, error } = await supabase
      .from("micro_courses")
      .insert({ ...payload, slug: slugify(data.title) })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeCourse(row) as MicroCourse;
  });

export const adminDeleteMicroCourse = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;
    const { error } = await supabase.from("micro_courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── AI production assist: draft a lesson for team review ──────────────────
const GenerateScriptInput = z.object({
  title: z.string().min(1).max(200),
  topic: z.string().min(1).max(500),
});

export const adminGenerateMicroCourseScript = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => GenerateScriptInput.parse(i))
  .handler(async ({ data, context }) => {
    assertAdmin(context.isAdmin);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("AI is not configured yet.");

    const system = `You write short, practical micro-lessons for university and pre-university students.
Each lesson must be 5-10 minutes of reading (roughly 250-500 words total) and stay lightweight — never a full course.

Return ONLY valid JSON (no markdown, no code fences):
{
  "description": "one-sentence summary",
  "category": "research" | "career" | "study-skills" | "wellbeing",
  "duration_minutes": 6,
  "content": [
    { "type": "heading", "body": "Section heading" },
    { "type": "text", "body": "Short paragraph" },
    { "type": "bullet", "body": "Actionable bullet point" },
    { "type": "tip", "body": "A practical tip or warning" }
  ],
  "check_questions": [
    { "question": "...", "options": ["correct answer", "wrong 1", "wrong 2"], "answer": "correct answer", "explanation": "one line" }
  ]
}

Rules:
- content is a sequence of 4-10 blocks mixing heading/text/bullet/tip.
- check_questions must be exactly 2-3 questions, each with 3-4 full answer choices in "options".
- "answer" must be exactly equal to one of the options (full text, not a letter).
- Keep it concrete and immediately useful, not theoretical.`;

    const parsed = await callAI(apiKey, {
      model: "deepseek-v4-flash",
      max_tokens: 8000,
      system,
      user: `Lesson title: ${data.title}\nTopic: ${data.topic}`,
    });

    return {
      title: data.title,
      description: typeof parsed?.description === "string" ? parsed.description : "",
      category: CATEGORIES.includes(parsed?.category) ? parsed.category : "study-skills",
      duration_minutes: Number(parsed?.duration_minutes) || 6,
      content: asBlocks(parsed?.content),
      check_questions: asCheckQuestions(parsed?.check_questions),
    };
  });
