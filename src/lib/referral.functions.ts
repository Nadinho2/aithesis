import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateReferralCode } from "./referral";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

// --- Get referral code for current user (auto-creates if missing) ---

export const getMyReferralCode = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check if user already has a code
    const { data: existing } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return (existing as any).code;

    // Auto-create referral code + wallet
    let code = generateReferralCode(userId);
    let attempts = 0;
    while (attempts < 10) {
      const { error } = await supabase
        .from("referral_codes")
        .insert({ user_id: userId, code });
      if (!error) break;
      code = generateReferralCode(userId);
      attempts++;
    }

    // Create wallet if not exists
    await supabase
      .from("wallets")
      .upsert({ user_id: userId, balance: 0, total_earned: 0, total_withdrawn: 0 }, { onConflict: "user_id" })
      .then(() => {});

    return code;
  });

// --- Get wallet for current user ---

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return data as any;
  });

// --- Get earnings for current user ---

export const getMyEarnings = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return [];

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("referral_earnings")
      .select("*")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    return (data ?? []) as any[];
  });

// --- Get referral count (how many people this user has referred) ---

export const getMyReferralCount = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return 0;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { count } = await supabase
      .from("referral_relationships")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", userId);

    return count ?? 0;
  });

// --- Get withdrawal history ---

export const getMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return [];

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    return (data ?? []) as any[];
  });

// --- Get banks list ---

export const getBanks = createServerFn({ method: "GET" })
  .handler(async () => {
    const paystackKey = runtimeEnv("PAYSTACK_SECRET_KEY");
    if (!paystackKey) return [];

    try {
      const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
        headers: { Authorization: `Bearer ${paystackKey}` },
      });
      const json = await res.json();
      return (json.data ?? []) as { name: string; code: string }[];
    } catch {
      return [];
    }
  });

// ═══════════════════════════════════════════════════════════
// Tool enabled check — reads from settings table
// ═══════════════════════════════════════════════════════════

export const isToolEnabled = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      // Can't check DB — assume disabled for safety
      return { key: "", enabled: false };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await (supabase as any)
      .from("settings")
      .select("key,value")
      .like("key", "tool:%");

    if (error) {
      console.error("[isToolEnabled]", error.message);
      return { key: "", enabled: false };
    }

    // Return the referral toggle specifically
    const referralRow = (data ?? []).find((r: any) => r.key === "tool:referral:enabled");
    const enabled = referralRow ? (referralRow.value === true || referralRow.value === "true") : false;
    return { key: "tool:referral:enabled", enabled };
  });

// ═══════════════════════════════════════════════════════════
// Referral profile + earnings summary (role-aware dashboard)
// ═══════════════════════════════════════════════════════════

function getClient() {
  const supabaseUrl = runtimeEnv("SUPABASE_URL");
  const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assertAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

export const getMyReferralProfile = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabase = getClient();
    if (!supabase) return { code: null, codeType: "standard" as const };

    // Ensure the user has a code (auto-create).
    const { data: existing } = await (supabase as any)
      .from("referral_codes")
      .select("code, code_type")
      .eq("user_id", userId)
      .maybeSingle();

    let code = existing?.code ?? null;
    let codeType = (existing?.code_type as "standard" | "ambassador" | "influencer") ?? "standard";

    if (!code) {
      code = generateReferralCode(userId);
      await (supabase as any)
        .from("referral_codes")
        .insert({ user_id: userId, code, code_type: "standard" })
        .then(() => {})
        .catch(() => {});
    }

    return { code, codeType };
  });

export const getMyEarningsSummary = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabase = getClient();
    if (!supabase) return { l1Total: 0, l2Total: 0 };

    const { data } = await (supabase as any)
      .from("referral_earnings")
      .select("level, commission_amount")
      .eq("referrer_id", userId);

    let l1Total = 0;
    let l2Total = 0;
    for (const row of (data ?? []) as any[]) {
      if (row.level === "L2") l2Total += Number(row.commission_amount ?? 0);
      else l1Total += Number(row.commission_amount ?? 0);
    }
    return { l1Total, l2Total };
  });

// ═══════════════════════════════════════════════════════════
// Ambassador application (self-serve) + admin review
// ═══════════════════════════════════════════════════════════

const AmbassadorApplicationInput = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  school: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
  socialHandles: z.string().optional(),
  promoPlan: z.string().optional(),
  requestedCode: z.string().optional(),
});

export const submitAmbassadorApplication = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AmbassadorApplicationInput.parse(i))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const supabase = getClient();
    if (!supabase) throw new Error("Server configuration error");

    const body = data;

    if (!body.fullName?.trim()) throw new Error("Full name is required");

    const { error } = await (supabase as any)
      .from("referral_applications")
      .upsert(
        {
          user_id: userId,
          full_name: body.fullName.trim(),
          email: "", // email is looked up from Clerk; kept for future use
          phone: body.phone ?? null,
          school: body.school ?? null,
          department: body.department ?? null,
          level: body.level ?? null,
          social_handles: body.socialHandles ?? null,
          promo_plan: body.promoPlan ?? null,
          requested_code: body.requestedCode ?? null,
          status: "pending",
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("[submitAmbassadorApplication]", error.message);
      throw new Error("Failed to submit application");
    }

    return { success: true, status: "pending" as const };
  });

export const getMyApplication = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabase = getClient();
    if (!supabase) return null;

    const { data } = await (supabase as any)
      .from("referral_applications")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return (data as any) ?? null;
  });

export const adminListReferralApplications = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.isAdmin);
    const supabase = getClient();
    if (!supabase) return [];

    const { data } = await (supabase as any)
      .from("referral_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    return (data ?? []) as any[];
  });

const ReviewApplicationInput = z.object({
  applicationId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export const adminReviewReferralApplication = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => ReviewApplicationInput.parse(i))
  .handler(async ({ context, data }) => {
    assertAdmin(context.isAdmin);
    const supabase = getClient();
    if (!supabase) throw new Error("Server configuration error");

    const { applicationId, action } = data;

    if (action === "approve") {
      // Fetch the application to get the user + requested vanity code.
      const { data: app } = await (supabase as any)
        .from("referral_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();

      if (!app) throw new Error("Application not found");

      await (supabase as any)
        .from("referral_applications")
        .update({ status: "approved", reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
        .eq("id", applicationId);

      // Promote the user's referral code to ambassador.
      await (supabase as any)
        .from("referral_codes")
        .update({ code_type: "ambassador", approved_at: new Date().toISOString() })
        .eq("user_id", app.user_id);

      // Optionally assign the requested vanity code (best-effort, only if free).
      if (app.requested_code) {
        const vanity = String(app.requested_code).trim().toUpperCase();
        if (vanity) {
          const { data: clash } = await (supabase as any)
            .from("referral_codes")
            .select("user_id")
            .eq("code", vanity)
            .maybeSingle();
          if (!clash) {
            await (supabase as any)
              .from("referral_codes")
              .update({ code: vanity })
              .eq("user_id", app.user_id);
          }
        }
      }
    } else {
      await (supabase as any)
        .from("referral_applications")
        .update({ status: "rejected", reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
        .eq("id", applicationId);
    }

    return { success: true };
  });

// ═══════════════════════════════════════════════════════════
// Admin: assign code type / vanity code directly (no application)
// ═══════════════════════════════════════════════════════════

export const adminListReferralCodes = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.isAdmin);
    const supabase = getClient();
    if (!supabase) return [];

    const { data } = await (supabase as any)
      .from("referral_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    return (data ?? []) as any[];
  });

const SetCodeTypeInput = z.object({
  userId: z.string().min(1),
  codeType: z.enum(["standard", "ambassador", "influencer"]),
  customCode: z.string().optional(),
});

export const adminSetCodeType = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SetCodeTypeInput.parse(i))
  .handler(async ({ context, data }) => {
    assertAdmin(context.isAdmin);
    const supabase = getClient();
    if (!supabase) throw new Error("Server configuration error");

    const { userId, codeType, customCode } = data;

    if (!userId) throw new Error("userId is required");
    if (!["standard", "ambassador", "influencer"].includes(codeType)) {
      throw new Error("Invalid codeType");
    }

    // Ensure the user has a referral code first.
    const { data: existing } = await (supabase as any)
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const code = customCode?.trim().toUpperCase() || generateReferralCode(userId);
      await (supabase as any)
        .from("referral_codes")
        .insert({
          user_id: userId,
          code,
          code_type: codeType,
          approved_at: codeType !== "standard" ? new Date().toISOString() : null,
        });
    } else {
      const patch: any = { code_type: codeType, approved_at: codeType !== "standard" ? new Date().toISOString() : null };
      if (customCode?.trim()) {
        const vanity = customCode.trim().toUpperCase();
        const { data: clash } = await (supabase as any)
          .from("referral_codes")
          .select("user_id")
          .eq("code", vanity)
          .maybeSingle();
        if (clash && clash.user_id !== userId) throw new Error(`Code ${vanity} is already in use`);
        patch.code = vanity;
      }
      await (supabase as any)
        .from("referral_codes")
        .update(patch)
        .eq("user_id", userId);
    }

    return { success: true };
  });
