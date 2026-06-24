import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { createClient } from "@supabase/supabase-js";
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
