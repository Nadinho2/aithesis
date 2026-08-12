/**
 * Referral system utilities — code generation, tracking, and commission crediting.
 *
 * All amounts are in naira (not kobo). Only convert to kobo when sending to Paystack API.
 *
 * Commission model (20% total cap):
 *   - L1 (direct referrer, B) always earns 15% on the referred user's (C) payments.
 *   - The remaining 5% goes to the upline (A = B's referrer) when eligible, otherwise
 *     it rolls into B's share (B earns the full 20%).
 *   - Upline (A) eligibility for the 5% override:
 *       • code_type 'ambassador' or 'influencer' → 5% ONGOING (every payment)
 *       • code_type 'standard' → 5% ONE-TIME (C's very first payment only)
 *   - code_type 'influencer' as the DIRECT referrer (B) → flat 20%, never split.
 *
 * The chain never walks deeper than one upline (2 lookups, not a stored tree).
 */

import { createClient } from "@supabase/supabase-js";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

let _supabase: ReturnType<typeof createClient> | null = null;

async function getClient() {
  if (!_supabase) {
    const url = runtimeEnv("SUPABASE_URL");
    const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Missing Supabase env vars for referral");
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

// Helper: cast from() to any so untyped tables don't error
function anyFrom(supabase: Awaited<ReturnType<typeof getClient>>, table: string) {
  return (supabase as any).from(table);
}

// ─── Commission constants ─────────────────────────────────────────────────

export const REFERRAL_L1_PCT = 15; // direct referrer
export const REFERRAL_L2_PCT = 5; // upline override
export const REFERRAL_TOTAL_PCT = 20; // hard cap (L1 + L2)

// ─── A) Generate referral code ─────────────────────────────────────────────

export function generateReferralCode(userId: string): string {
  const prefix = userId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 to avoid confusion
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}

// ─── B) Create referral code for user (idempotent) ─────────────────────────

export async function createReferralCodeForUser(userId: string): Promise<string> {
  const supabase = await getClient();

  // Check if user already has a code
  const { data: existing } = await anyFrom(supabase, "referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return (existing as any).code;

  // Generate unique code
  let code = generateReferralCode(userId);
  let attempts = 0;
  while (attempts < 10) {
    const { error } = await anyFrom(supabase, "referral_codes")
      .insert({ user_id: userId, code });
    if (!error) break;
    code = generateReferralCode(userId);
    attempts++;
  }

  // Create wallet if not exists
  await anyFrom(supabase, "wallets")
    .upsert({ user_id: userId, balance: 0, total_earned: 0, total_withdrawn: 0 }, { onConflict: "user_id" })
    .then(() => {});

  return code;
}

// ─── C) Get referral code for user ────────────────────────────────────────

export async function getReferralCodeForUser(userId: string): Promise<string | null> {
  const supabase = await getClient();
  const { data } = await anyFrom(supabase, "referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle() as any;
  return data ? (data as any).code : null;
}

// ─── C2) Get code_type for user ────────────────────────────────────────────

export type ReferralCodeType = "standard" | "ambassador" | "influencer";

export async function getCodeTypeForUser(userId: string): Promise<ReferralCodeType> {
  const supabase = await getClient();
  const { data } = await anyFrom(supabase, "referral_codes")
    .select("code_type")
    .eq("user_id", userId)
    .maybeSingle() as any;
  return (data?.code_type as ReferralCodeType) ?? "standard";
}

// ─── D) Get referral link ──────────────────────────────────────────────────

export function getReferralLink(code: string): string {
  return `https://www.mybrainpadi.com?ref=${code}`;
}

// ─── E) Track a referral from a ref code on signup ─────────────────────────

export async function trackReferral(
  referredUserId: string,
  refCode: string,
): Promise<void> {
  try {
    const supabase = await getClient();

    // Look up the referral code
    const { data: referrer } = await anyFrom(supabase, "referral_codes")
      .select("user_id")
      .eq("code", refCode.trim().toUpperCase())
      .maybeSingle() as any;

    if (!referrer) return; // Code not found — silently return

    const referrerId = (referrer as any).user_id;
    if (referrerId === referredUserId) return; // No self-referral

    // Insert relationship (upsert — a user can only be referred once)
    await anyFrom(supabase, "referral_relationships")
      .upsert(
        { referrer_id: referrerId, referred_id: referredUserId },
        { onConflict: "referred_id", ignoreDuplicates: true },
      ) as any;
  } catch (err) {
    console.error("[referral] trackReferral error:", err);
    // Never throw — silent failure
  }
}

// ─── F) Credit commission when a referred user pays ────────────────────────

export async function creditReferralCommission({
  paymentId,
  referredUserId,
  paymentAmount,
  tool,
}: {
  paymentId: string;
  referredUserId: string;
  paymentAmount: number;
  tool: string;
}): Promise<void> {
  try {
    const supabase = await getClient();

    // C = the paying user. Find B = C's direct referrer.
    const { data: relB } = await anyFrom(supabase, "referral_relationships")
      .select("referrer_id")
      .eq("referred_id", referredUserId)
      .maybeSingle() as any;

    if (!relB) return; // C was never referred — nothing to credit.

    const bId = (relB as any).referrer_id;
    if (bId === referredUserId) return; // defensive: no self-referral

    // Find A = B's upline.
    const { data: relA } = await anyFrom(supabase, "referral_relationships")
      .select("referrer_id")
      .eq("referred_id", bId)
      .maybeSingle() as any;
    const aId = relA ? (relA as any).referrer_id : null;

    // Determine the split.
    const bCodeType = await getCodeTypeForUser(bId);

    let bPct: number;
    let aPct = 0;

    if (bCodeType === "influencer") {
      // Influencer as direct referrer: flat 20%, never split.
      bPct = REFERRAL_TOTAL_PCT;
      aPct = 0;
    } else if (aId && aId !== referredUserId && aId !== bId) {
      const aCodeType = await getCodeTypeForUser(aId);
      if (aCodeType === "ambassador" || aCodeType === "influencer") {
        // Partner upline: ongoing 5% override.
        aPct = REFERRAL_L2_PCT;
      } else {
        // Standard upline: 5% one-time on C's first payment only.
        const isFirst = await isFirstPaymentFor(supabase, referredUserId);
        aPct = isFirst ? REFERRAL_L2_PCT : 0;
      }
      bPct = REFERRAL_TOTAL_PCT - aPct; // 15% when A earns, 20% when A doesn't
    } else {
      // No upline: roll the 5% into B (B earns full 20%).
      bPct = REFERRAL_TOTAL_PCT;
      aPct = 0;
    }

    const bAmount = Math.floor((paymentAmount * bPct) / 100);
    const aAmount = Math.floor((paymentAmount * aPct) / 100);

    // Record B's earning (L1).
    if (bAmount > 0) {
      await recordEarning(supabase, {
        referrerId: bId,
        referredId: referredUserId,
        paymentId,
        paymentAmount,
        commissionAmount: bAmount,
        tool,
        level: "L1",
      });
    }

    // Record A's earning (L2), if any.
    if (aId && aAmount > 0) {
      await recordEarning(supabase, {
        referrerId: aId,
        referredId: referredUserId,
        paymentId,
        paymentAmount,
        commissionAmount: aAmount,
        tool,
        level: "L2",
      });
    }
  } catch (err) {
    console.error("[referral] creditReferralCommission error:", err);
    // Never throw — commission failure must never crash the payment flow
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function isFirstPaymentFor(
  supabase: Awaited<ReturnType<typeof getClient>>,
  referredUserId: string,
): Promise<boolean> {
  const { count } = await anyFrom(supabase, "referral_earnings")
    .select("id", { count: "exact", head: true })
    .eq("referred_id", referredUserId) as any;
  return (count ?? 0) === 0;
}

async function recordEarning(
  supabase: Awaited<ReturnType<typeof getClient>>,
  earning: {
    referrerId: string;
    referredId: string;
    paymentId: string;
    paymentAmount: number;
    commissionAmount: number;
    tool: string;
    level: "L1" | "L2";
  },
): Promise<void> {
  // Idempotency guard: skip if this referrer already earned on this payment level.
  const { data: existing } = await anyFrom(supabase, "referral_earnings")
    .select("id")
    .eq("payment_id", earning.paymentId)
    .eq("referrer_id", earning.referrerId)
    .eq("level", earning.level)
    .maybeSingle() as any;

  if (existing) return;

  // Record the earning row.
  await anyFrom(supabase, "referral_earnings").insert({
    referrer_id: earning.referrerId,
    referred_id: earning.referredId,
    payment_id: earning.paymentId,
    payment_amount: earning.paymentAmount,
    commission_amount: earning.commissionAmount,
    tool: earning.tool,
    level: earning.level,
    status: "credited",
  }) as any;

  // Upsert wallet — increment balance and total_earned.
  const { data: wallet } = await anyFrom(supabase, "wallets")
    .select("id, balance, total_earned")
    .eq("user_id", earning.referrerId)
    .maybeSingle() as any;

  if (wallet) {
    const currentBalance = (wallet as any).balance ?? 0;
    const currentEarned = (wallet as any).total_earned ?? 0;
    await anyFrom(supabase, "wallets")
      .update({
        balance: currentBalance + earning.commissionAmount,
        total_earned: currentEarned + earning.commissionAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", earning.referrerId) as any;
  } else {
    await anyFrom(supabase, "wallets").insert({
      user_id: earning.referrerId,
      balance: earning.commissionAmount,
      total_earned: earning.commissionAmount,
      total_withdrawn: 0,
    }) as any;
  }
}
