/**
 * Referral system utilities — code generation, tracking, and commission crediting.
 *
 * All amounts are in naira (not kobo). Only convert to kobo when sending to Paystack API.
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
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return (existing as any).code;

  // Generate unique code
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
}

// ─── C) Get referral code for user ────────────────────────────────────────

export async function getReferralCodeForUser(userId: string): Promise<string | null> {
  const supabase = await getClient();
  const { data } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? (data as any).code : null;
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
    const { data: referrer } = await supabase
      .from("referral_codes")
      .select("user_id")
      .eq("code", refCode.toUpperCase())
      .maybeSingle();

    if (!referrer) return; // Code not found — silently return

    const referrerId = (referrer as any).user_id;
    if (referrerId === referredUserId) return; // No self-referral

    // Insert relationship (upsert — a user can only be referred once)
    await supabase
      .from("referral_relationships")
      .upsert(
        { referrer_id: referrerId, referred_id: referredUserId },
        { onConflict: "referred_id", ignoreDuplicates: true },
      );
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

    // Look up who referred this user
    const { data: rel } = await supabase
      .from("referral_relationships")
      .select("referrer_id")
      .eq("referred_id", referredUserId)
      .maybeSingle();

    if (!rel) return; // User was not referred — silently return

    const referrerId = (rel as any).referrer_id;
    const commissionAmount = Math.floor(paymentAmount * 0.2); // 20% in naira

    // Record the earning
    await supabase.from("referral_earnings").insert({
      referrer_id: referrerId,
      referred_id: referredUserId,
      payment_id: paymentId,
      payment_amount: paymentAmount,
      commission_amount: commissionAmount,
      tool,
      status: "credited",
    });

    // Upsert wallet — increment balance and total_earned
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance, total_earned")
      .eq("user_id", referrerId)
      .maybeSingle();

    if (wallet) {
      const currentBalance = (wallet as any).balance ?? 0;
      const currentEarned = (wallet as any).total_earned ?? 0;
      await supabase
        .from("wallets")
        .update({
          balance: currentBalance + commissionAmount,
          total_earned: currentEarned + commissionAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", referrerId);
    } else {
      await supabase.from("wallets").insert({
        user_id: referrerId,
        balance: commissionAmount,
        total_earned: commissionAmount,
        total_withdrawn: 0,
      });
    }
  } catch (err) {
    console.error("[referral] creditReferralCommission error:", err);
    // Never throw — commission failure must never crash the payment flow
  }
}
