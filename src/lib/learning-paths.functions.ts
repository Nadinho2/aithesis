import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";

export type LearningPathStatus = "draft" | "published" | "archived";

export interface LearningPathStep {
  id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  completed: boolean;
  unlocked: boolean;
}

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: LearningPathStatus;
  steps: LearningPathStep[];
}

export interface LearningPathListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  step_count: number;
  completed_count: number;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ─── Resolve each user's completed (passed) course ids ─────────────────────
async function loadCompletedCourseIds(supabase: any, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("micro_course_completions")
    .select("course_id")
    .eq("user_id", userId)
    .eq("passed", true);
  return new Set(((data ?? []) as Array<{ course_id: string }>).map((c) => c.course_id));
}

// ─── List published paths with per-user progress ───────────────────────────
export const listLearningPaths = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const [{ data: paths }, completedIds] = await Promise.all([
      supabase
        .from("learning_paths")
        .select("id, slug, title, description")
        .eq("status", "published")
        .order("created_at", { ascending: true }),
      loadCompletedCourseIds(supabase, userId),
    ]);

    if (!paths || paths.length === 0) return [] as LearningPathListItem[];

    const { data: steps } = await supabase
      .from("learning_path_steps")
      .select("path_id, course_id")
      .in(
        "path_id",
        (paths ?? []).map((p: any) => p.id),
      );

    const stepsByPath = new Map<string, Set<string>>();
    for (const s of (steps ?? []) as Array<{ path_id: string; course_id: string }>) {
      const set = stepsByPath.get(s.path_id) ?? new Set<string>();
      set.add(s.course_id);
      stepsByPath.set(s.path_id, set);
    }

    return (paths ?? []).map((p: any) => {
      const courseIds = stepsByPath.get(p.id) ?? new Set<string>();
      const completedCount = Array.from(courseIds).filter((id) => completedIds.has(id)).length;
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description ?? null,
        step_count: courseIds.size,
        completed_count: completedCount,
      } as LearningPathListItem;
    });
  });

// ─── Fetch a single published path + ordered steps with state ──────────────
export const getLearningPath = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: path, error } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!path) throw new Error("Learning path not found.");

    const [{ data: steps }, completedIds] = await Promise.all([
      supabase
        .from("learning_path_steps")
        .select("id, course_id, position")
        .eq("path_id", path.id)
        .order("position", { ascending: true }),
      loadCompletedCourseIds(supabase, userId),
    ]);

    const ordered = (steps ?? []) as Array<{ id: string; course_id: string; position: number }>;
    const courseIds = ordered.map((s) => s.course_id);

    let courseMap = new Map<string, any>();
    if (courseIds.length > 0) {
      const { data: courses } = await supabase
        .from("micro_courses")
        .select("id, title, description, category, duration_minutes")
        .in("id", courseIds);
      courseMap = new Map(((courses ?? []) as any[]).map((c) => [c.id, c]));
    }

    const stepViews: LearningPathStep[] = ordered.map((s, i) => {
      const course = courseMap.get(s.course_id) ?? {};
      const completed = completedIds.has(s.course_id);
      const prevCompleted = i === 0 || completedIds.has(ordered[i - 1].course_id);
      return {
        id: s.id,
        course_id: s.course_id,
        position: s.position,
        title: course.title ?? "Lesson",
        description: course.description ?? null,
        category: course.category ?? "study-skills",
        duration_minutes: course.duration_minutes ?? 6,
        completed,
        unlocked: prevCompleted,
      };
    });

    return {
      id: path.id,
      slug: path.slug,
      title: path.title,
      description: path.description ?? null,
      status: path.status,
      steps: stepViews,
    } as LearningPath;
  });

// ═══════════════════════════════════════════════════════════
// Admin — curation layer, content stays team-owned
// ═══════════════════════════════════════════════════════════

function assertAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

export const adminListLearningPaths = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;

    const { data: paths, error } = await supabase
      .from("learning_paths")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const { data: steps } = await supabase
      .from("learning_path_steps")
      .select("id, path_id, course_id, position")
      .order("position", { ascending: true });

    const { data: courses } = await supabase
      .from("micro_courses")
      .select("id, title");

    const courseTitle = new Map<string, string>(((courses ?? []) as any[]).map((c) => [c.id, c.title]));

    const stepsByPath = new Map<string, any[]>();
    for (const s of (steps ?? []) as any[]) {
      const list = stepsByPath.get(s.path_id) ?? [];
      list.push({ ...s, course_title: courseTitle.get(s.course_id) ?? s.course_id });
      stepsByPath.set(s.path_id, list);
    }

    return (paths ?? []).map((p: any) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      steps: stepsByPath.get(p.id) ?? [],
    }));
  });

const UpsertPathInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  course_ids: z.array(z.string().uuid()).max(50).default([]),
});

export const adminUpsertLearningPath = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => UpsertPathInput.parse(i))
  .handler(async ({ data, context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;

    const payload = {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    let pathId = data.id;
    if (pathId) {
      const { data: row, error } = await supabase
        .from("learning_paths")
        .update(payload)
        .eq("id", pathId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      pathId = row.id;
    } else {
      const { data: row, error } = await supabase
        .from("learning_paths")
        .insert({ ...payload, slug: slugify(data.title) })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      pathId = row.id;
    }

    // Replace steps (simple delete + reinsert; single-user admin operation).
    await supabase.from("learning_path_steps").delete().eq("path_id", pathId);

    if (data.course_ids.length > 0) {
      const rows = data.course_ids.map((courseId, i) => ({
        path_id: pathId,
        course_id: courseId,
        position: i,
      }));
      const { error } = await supabase.from("learning_path_steps").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { id: pathId };
  });

export const adminDeleteLearningPath = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;
    const { error } = await supabase.from("learning_paths").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── AI content-planning aid: group existing courses into candidate paths ──
export const adminSuggestPathGrouping = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.isAdmin);
    const { supabase } = context as any;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("AI is not configured yet.");

    const { data: courses } = await supabase
      .from("micro_courses")
      .select("id, title, category")
      .eq("status", "published");

    if (!courses || courses.length < 2) {
      throw new Error("Need at least 2 published lessons to group into paths.");
    }

    const courseList = (courses as any[]).map((c) => c.title);
    const system = `You are a curriculum planner for a university skills platform.
Group the provided short lessons into 2-4 named learning paths. Each path is a logical sequence of related lessons.

Return ONLY valid JSON (no markdown, no code fences):
{
  "paths": [
    { "title": "Path name", "description": "one-sentence summary", "courses": ["lesson title 1", "lesson title 2"] }
  ]
}

Rules:
- Use only the exact lesson titles provided.
- Every path must have at least 2 courses.
- Each course may appear in at most one path.
- Keep paths practical and career/academic oriented.`;

    const parsed = await callAI(apiKey, {
      model: "deepseek-v4-flash",
      max_tokens: 6000,
      system,
      user: `Lessons:\n${courseList.map((t) => `- ${t}`).join("\n")}`,
    });

    const byTitle = new Map<string, string>();
    for (const c of courses as any[]) {
      byTitle.set(c.title.toLowerCase(), c.id);
    }

    const paths = Array.isArray(parsed?.paths) ? parsed.paths : [];
    return paths.map((p: any) => ({
      title: typeof p.title === "string" ? p.title : "Untitled path",
      description: typeof p.description === "string" ? p.description : "",
      course_ids: (Array.isArray(p.courses) ? p.courses : [])
        .map((t: any) => byTitle.get(String(t).toLowerCase()))
        .filter((id: string | undefined): id is string => !!id),
    }));
  });
