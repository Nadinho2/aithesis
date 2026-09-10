import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { loadLearnerScope, type QuestionCategory } from "@/lib/past-questions.functions";

export interface SubjectEntry {
  key: string;
  name: string;
  category: QuestionCategory;
  university: string | null;
  count: number;
  isWeak: boolean;
}

// ─── Browse-able subject directory (aggregated from the question bank) ─────
export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase, isAdmin } = context as any;
    const scope = await loadLearnerScope(supabase, userId);

    // Professional learners use the thesis/proposal tools, not the question bank.
    if (!isAdmin && scope.learner_type === "professional") return [] as SubjectEntry[];

    let q = supabase
      .from("past_questions")
      .select("category, university, course, subject")
      .eq("status", "published");

    if (!isAdmin) {
      if (scope.learner_type === "university") {
        q = q.eq("category", "university");
        if (scope.university) q = q.eq("university", scope.university);
      } else if (scope.learner_type === "pre_university") {
        if (scope.exam_tracks.length === 0) return [] as SubjectEntry[];
        q = q.in("category", scope.exam_tracks);
      }
    }

    const { data } = await q;
    const rows = (data ?? []) as Array<{
      category: string;
      university: string | null;
      course: string | null;
      subject: string | null;
    }>;

    const map = new Map<string, SubjectEntry>();
    for (const r of rows) {
      const category = r.category as QuestionCategory;
      const isUniversity = category === "university";
      const name = (isUniversity ? r.course || r.subject : r.subject)?.trim();
      if (!name) continue;

      const university = isUniversity ? (r.university ?? null) : null;
      const key = isUniversity ? `${category}:${university ?? ""}:${name}` : `${category}:${name}`;

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, name, category, university, count: 1, isWeak: false });
      }
    }

    // Flag subjects the user has struggled with.
    const { data: signals } = await supabase
      .from("learning_signals")
      .select("subject")
      .eq("user_id", userId);
    const weakSet = new Set(
      ((signals ?? []) as Array<{ subject: string }>).map((s) =>
        String(s.subject).trim().toLowerCase(),
      ),
    );

    return Array.from(map.values())
      .map((e) => ({ ...e, isWeak: weakSet.has(e.name.toLowerCase()) }))
      .sort((a, b) => b.count - a.count);
  });
