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
        // Legacy combined (backward compat)
        thesis_limit: lim?.thesis_limit ?? 0,
        thesis_used: lim?.thesis_used ?? 0,
        // Per-level thesis
        thesis_limit_ug: lim?.thesis_limit_ug ?? 0,
        thesis_used_ug: lim?.thesis_used_ug ?? 0,
        thesis_limit_masters: lim?.thesis_limit_masters ?? 0,
        thesis_used_masters: lim?.thesis_used_masters ?? 0,
        thesis_limit_phd: lim?.thesis_limit_phd ?? 0,
        thesis_used_phd: lim?.thesis_used_phd ?? 0,
        // Proposal
        proposal_limit: lim?.proposal_limit ?? 0,
        proposal_used: lim?.proposal_used ?? 0,
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
        thesis_limit_ug: z.number().int().min(0).max(999),
        thesis_limit_masters: z.number().int().min(0).max(999),
        thesis_limit_phd: z.number().int().min(0).max(999),
        proposal_limit: z.number().int().min(0).max(999),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    requireAdmin(context.isAdmin);
    const supabase = context.supabase as any;

    const { error } = await supabase.from("user_limits").upsert(
      {
        user_id: data.user_id,
        thesis_limit_ug: data.thesis_limit_ug,
        thesis_limit_masters: data.thesis_limit_masters,
        thesis_limit_phd: data.thesis_limit_phd,
        proposal_limit: data.proposal_limit,
        // Keep old combined in sync (sum of per-level)
        thesis_limit: data.thesis_limit_ug + data.thesis_limit_masters + data.thesis_limit_phd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Check generate limit (used before generation) ───
export async function checkGenerateLimit(
  supabase: any,
  userId: string,
  type: "thesis" | "proposal",
  level?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_generate", {
    p_user_id: userId,
    p_type: type,
    p_level: level ?? "undergraduate",
  });
  if (error) throw new Error(error.message);
  return !!data;
}

// ─── Increment usage after successful generation ───
export async function incrementUsage(
  supabase: any,
  userId: string,
  type: "thesis" | "proposal",
  level?: string,
): Promise<void> {
  const { error } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_type: type,
    p_level: level ?? "undergraduate",
  });
  if (error) throw new Error(error.message);
}
