import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";

// ─── Get current user's credit limits ───
export const getUserLimits = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;

    const { data } = await supabase
      .from("user_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      return {
        proposal_remaining: 0,
        thesis_available_ug: 0,
        thesis_available_masters: 0,
        thesis_available_phd: 0,
        assignment_available: 0,
        exam_available: 0,
        presentation_available: 0,
        cv_available: 0,
        seminar_available: 0,
        chat_available: 0,
      };
    }

    return {
      proposal_remaining: Math.max(0, (data.proposal_limit ?? 0) - (data.proposal_used ?? 0)),
      thesis_available_ug: data.thesis_available_ug ?? 0,
      thesis_available_masters: data.thesis_available_masters ?? 0,
      thesis_available_phd: data.thesis_available_phd ?? 0,
      assignment_available: data.assignment_available ?? 0,
      exam_available: data.exam_available ?? 0,
      presentation_available: data.presentation_available ?? 0,
      cv_available: data.cv_available ?? 0,
      seminar_available: data.seminar_available ?? 0,
      chat_available: data.chat_available ?? 0,
    };
  });

// ─── Recent items across research tools ───
interface RecentItem {
  id: string;
  type: "topic" | "proposal" | "thesis";
  title: string;
  subtitle?: string;
  created_at: string;
  route: string;
}

export const getRecentItems = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;

    const [topicsRes, proposalsRes, thesesRes] = await Promise.all([
      supabase
        .from("topics")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("proposals")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("theses")
        .select("id, title, level, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const items: RecentItem[] = [];

    for (const t of topicsRes.data ?? []) {
      items.push({
        id: t.id,
        type: "topic",
        title: t.title ?? "Untitled topic",
        created_at: t.created_at,
        route: `/my-topics`,
      });
    }

    for (const p of proposalsRes.data ?? []) {
      items.push({
        id: p.id,
        type: "proposal",
        title: p.title ?? "Untitled proposal",
        created_at: p.created_at,
        route: `/proposals`,
      });
    }

    for (const th of thesesRes.data ?? []) {
      const levelLabel = th.level === "masters" ? "Master's" : th.level === "phd" ? "PhD" : "UG";
      items.push({
        id: th.id,
        type: "thesis",
        title: th.title ?? "Untitled thesis",
        subtitle: `${levelLabel} thesis`,
        created_at: th.created_at,
        route: `/theses`,
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return items.slice(0, 5);
  });

// ─── Quick stats ───
export const getQuickStats = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;

    const [topics, proposals, theses, assignments, exams, presentations, cvs, seminars, sideHustles] =
      await Promise.all([
        supabase.from("topics").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("proposals").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("theses").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("assignments").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("exams").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("presentations").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("cvs").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("seminars").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("side_hustles").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

    const totalProjects =
      (topics.count ?? 0) +
      (proposals.count ?? 0) +
      (theses.count ?? 0) +
      (assignments.count ?? 0) +
      (exams.count ?? 0) +
      (presentations.count ?? 0) +
      (cvs.count ?? 0) +
      (seminars.count ?? 0) +
      (sideHustles.count ?? 0);

    return {
      totalProjects,
      topics: topics.count ?? 0,
      proposals: proposals.count ?? 0,
      theses: theses.count ?? 0,
      toolsCount:
        (assignments.count ?? 0) +
        (exams.count ?? 0) +
        (presentations.count ?? 0) +
        (cvs.count ?? 0) +
        (seminars.count ?? 0) +
        (sideHustles.count ?? 0),
    };
  });
