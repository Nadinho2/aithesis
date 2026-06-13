import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { buildProposalDocx, buildTopicsDocx, toBase64 } from "./docx.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const adminCheck = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, topics, generations, proposals] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("topics").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("topic_generations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("proposals").select("id", { count: "exact", head: true }),
    ]);
    return {
      users: profiles.count ?? 0,
      topics: topics.count ?? 0,
      generations: generations.count ?? 0,
      proposals: proposals.count ?? 0,
    };
  });

async function loadAuthUsers(): Promise<Map<string, { email: string | null; banned_until: string | null; created_at: string | null; last_sign_in_at: string | null }>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const map = new Map<string, any>();
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      map.set(u.id, {
        email: u.email ?? null,
        banned_until: (u as any).banned_until ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 25) break;
  }
  return map;
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const auth = await loadAuthUsers();
    const ids = Array.from(auth.keys());
    const [{ data: profiles }, { data: roles }, { data: topicCounts }, { data: propCounts }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, country, university").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("topics").select("user_id").in("user_id", ids),
      supabaseAdmin.from("proposals").select("user_id").in("user_id", ids),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    const topicCount = new Map<string, number>();
    (topicCounts ?? []).forEach((t) => topicCount.set(t.user_id, (topicCount.get(t.user_id) ?? 0) + 1));
    const propCount = new Map<string, number>();
    (propCounts ?? []).forEach((t) => propCount.set(t.user_id, (propCount.get(t.user_id) ?? 0) + 1));

    return ids.map((id) => {
      const a = auth.get(id)!;
      const banned = !!a.banned_until && new Date(a.banned_until) > new Date();
      return {
        id,
        email: a.email,
        created_at: a.created_at,
        last_sign_in_at: a.last_sign_in_at,
        full_name: profileMap.get(id)?.full_name ?? null,
        country: profileMap.get(id)?.country ?? null,
        university: profileMap.get(id)?.university ?? null,
        roles: roleMap.get(id) ?? [],
        topic_count: topicCount.get(id) ?? 0,
        proposal_count: propCount.get(id) ?? 0,
        banned,
      };
    });
  });

export const adminListGenerations = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("topic_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((g: any) => g.user_id)));
    const auth = ids.length > 0 ? await loadAuthUsers() : new Map();
    return (data ?? []).map((g: any) => ({
      ...g,
      user_email: auth.get(g.user_id)?.email ?? null,
    }));
  });

export const adminListProposals = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("proposals")
      .select("id,title,level,word_count,created_at,user_id,department")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const auth = await loadAuthUsers();
    return (data ?? []).map((p: any) => ({ ...p, user_email: auth.get(p.user_id)?.email ?? null }));
  });

export const adminDownloadProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Proposal not found");
    const bytes = await buildProposalDocx({
      title: row.title,
      level: row.level,
      department: row.department,
      area_of_interest: row.area_of_interest,
      country: row.country,
      abstract: row.abstract,
      word_count: row.word_count,
      sections: row.sections as any,
      references_list: (row.references_list as any) ?? [],
    });
    return {
      base64: toBase64(bytes),
      filename: row.title.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 100) + "-proposal.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  });

export const adminDownloadUserTopics = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("topics")
      .select("*")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("This user has no topics");
    const first = rows[0];
    const bytes = await buildTopicsDocx({
      meta: {
        department: first.department,
        area_of_interest: first.area_of_interest,
        country: first.country,
        research_type: first.research_type,
      },
      topics: rows.map((t: any) => ({
        title: t.title,
        problem_statement: t.problem_statement,
        research_gap: t.research_gap,
        objectives: t.objectives ?? [],
        novelty_score: t.novelty_score,
        feasibility_score: t.feasibility_score,
      })),
    });
    return {
      base64: toBase64(bytes),
      filename: `topics-${data.user_id.slice(0, 8)}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  });

export const adminSetBan = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ user_id: z.string().uuid(), banned: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("You cannot ban yourself.");
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("You cannot delete yourself.");
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "user"]),
        grant: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.user_id === userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role });
      // Ignore unique-violation duplicates.
      if (error && !String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
