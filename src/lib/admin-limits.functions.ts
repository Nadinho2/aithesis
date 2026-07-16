import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

function runtimeEnv(key: string): string | undefined {
  try {
    const proc = (globalThis as any).process;
    return proc?.env?.[key];
  } catch {
    return undefined;
  }
}

// ─── Require admin (throws if not admin) ───
export function requireAdmin(isAdmin: boolean): void {
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

// ─── List all users with their limits ───
export const adminListLimits = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    requireAdmin(context.isAdmin);
    const supabase = context.supabase as any;

    const { createClerkClient } = await import("@clerk/backend");
    const clerk = createClerkClient({ secretKey: runtimeEnv("CLERK_SECRET_KEY")! });
    const authUsers: Array<{ id: string; email: string | null }> = [];
    let offset = 0;
    const limit = 100;
    for (;;) {
      const userList = await clerk.users.getUserList({ offset, limit });
      for (const u of userList.data) {
        authUsers.push({ id: u.id, email: u.emailAddresses?.[0]?.emailAddress ?? null });
      }
      if (userList.data.length < limit) break;
      offset += limit;
      if (offset > 2000) break;
    }

    const ids = authUsers.map((u) => u.id);
    if (ids.length === 0) return [];

    const { data: limits } = await (supabase as any)
      .from("user_limits")
      .select("*")
      .in("user_id", ids);

    const limitsMap = new Map((limits ?? []).map((l: any) => [l.user_id, l]));

    return authUsers.map((u) => {
      const lim = limitsMap.get(u.id) as any;
      return {
        user_id: u.id,
        email: u.email,
        thesis_available_ug: lim?.thesis_available_ug ?? 0,
        thesis_available_masters: lim?.thesis_available_masters ?? 0,
        thesis_available_phd: lim?.thesis_available_phd ?? 0,
        proposal_available: (lim?.proposal_limit ?? 0) - (lim?.proposal_used ?? 0),
        proposal_limit: lim?.proposal_limit ?? 0,
        proposal_used: lim?.proposal_used ?? 0,
        assignment_available: lim?.assignment_available ?? 0,
        exam_available: lim?.exam_available ?? 0,
        presentation_available: lim?.presentation_available ?? 0,
        cv_available: lim?.cv_available ?? 0,
      };
    });
  });

// ─── Update a user's limits ───
export const updateUserLimits = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_id: z.string().min(1),
        thesis_available_ug: z.number().int().min(0).max(999),
        thesis_available_masters: z.number().int().min(0).max(999),
        thesis_available_phd: z.number().int().min(0).max(999),
        proposal_limit: z.number().int().min(0).max(999),
        assignment_available: z.number().int().min(0).max(999).default(0),
        exam_available: z.number().int().min(0).max(999).default(0),
        presentation_available: z.number().int().min(0).max(999).default(0),
        cv_available: z.number().int().min(0).max(999).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    requireAdmin(context.isAdmin);
    const supabase = context.supabase as any;

    const payload = {
      thesis_available_ug: data.thesis_available_ug,
      thesis_available_masters: data.thesis_available_masters,
      thesis_available_phd: data.thesis_available_phd,
      proposal_limit: data.proposal_limit,
      assignment_available: data.assignment_available ?? 0,
      exam_available: data.exam_available ?? 0,
      presentation_available: data.presentation_available ?? 0,
      cv_available: data.cv_available ?? 0,
      updated_at: new Date().toISOString(),
    };

    // Check if a row exists for this user
    const { data: existing } = await supabase
      .from("user_limits")
      .select("user_id")
      .eq("user_id", data.user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from("user_limits")
        .update(payload)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_limits")
        .insert({ user_id: data.user_id, ...payload });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

// ─── Map product type to user_limits column ───
function limitsColumn(type: string): string | null {
  switch (type) {
    case "proposal": return null; // special two-column model
    case "thesis": return null; // per-level below
    case "assignment": return "assignment_available";
    case "exam": return "exam_available";
    case "presentation": return "presentation_available";
    case "cv": return "cv_available";
    default: return null;
  }
}

// ─── Check generate limit (direct SQL, no RPC) ───
export async function checkGenerateLimit(
  supabase: any,
  userId: string,
  type: string,
  level?: string,
): Promise<boolean> {
  try {
    const { data: row } = await supabase
      .from("user_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row) return false;

    if (type === "proposal") {
      const remaining = (row.proposal_limit ?? 0) - (row.proposal_used ?? 0);
      return remaining > 0;
    }

    if (type === "thesis") {
      const lvl = level ?? "undergraduate";
      const col = lvl === "masters" ? "thesis_available_masters" : lvl === "phd" ? "thesis_available_phd" : "thesis_available_ug";
      return (row[col] ?? 0) > 0;
    }

    // Tools: assignment, exam, presentation, cv — single counter column
    const col = limitsColumn(type);
    if (col) return (row[col] ?? 0) > 0;

    return false;
  } catch {
    return false;
  }
}

// ─── Increment usage after successful generation (direct SQL, no RPC) ───
export async function incrementUsage(
  supabase: any,
  userId: string,
  type: string,
  level?: string,
): Promise<void> {
  try {
    // Ensure row exists
    await supabase
      .from("user_limits")
      .upsert({ user_id: userId, thesis_available_ug: 0, proposal_limit: 0, proposal_used: 0, updated_at: new Date().toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });

    if (type === "proposal") {
      const { data: row } = await supabase
        .from("user_limits")
        .select("proposal_used")
        .eq("user_id", userId)
        .maybeSingle();
      const used = (row?.proposal_used ?? 0) + 1;
      await supabase
        .from("user_limits")
        .update({ proposal_used: used, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      return;
    }

    if (type === "thesis") {
      const lvl = level ?? "undergraduate";
      const col = lvl === "masters" ? "thesis_available_masters" : lvl === "phd" ? "thesis_available_phd" : "thesis_available_ug";
      const { data: row } = await supabase
        .from("user_limits")
        .select(col)
        .eq("user_id", userId)
        .maybeSingle();
      const current = row?.[col] ?? 0;
      if (current <= 0) return;
      await supabase
        .from("user_limits")
        .update({ [col]: current - 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      return;
    }

    // Tools: assignment, exam, presentation, cv — single counter column
    const col = limitsColumn(type);
    if (!col) return;
    const { data: row } = await supabase
      .from("user_limits")
      .select(col)
      .eq("user_id", userId)
      .maybeSingle();
    const current = row?.[col] ?? 0;
    if (current <= 0) return;
    await supabase
      .from("user_limits")
      .update({ [col]: current - 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  } catch {
    // Non-critical — don't block generation
  }
}
