import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { getPrice, type ProductType, type ThesisLevel } from "./pricing";
import { sendPaymentConfirmedEmail, sendPaymentFailedEmail } from "./mail";
import type { BrainPadiTool } from "./mail";
import { getUserEmail, productToTool } from "./mail-helper";
import { checkGenerateLimit } from "./admin-limits.functions";

function runtimeEnv(key: string): string | undefined {
  try {
    const proc = (globalThis as any).process;
    return proc?.env?.[key];
  } catch {
    return undefined;
  }
}

// --- Initialize Paystack Payment ---

const InitPaymentInput = z.object({
  product: z.enum(["proposal", "thesis", "assignment", "exam", "presentation", "cv"]),
  level: z.enum(["undergraduate", "masters", "phd"]).optional(),
  email: z.string().email(),
  callbackUrl: z.string().optional(),
});

export const initPayment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => InitPaymentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secretKey = runtimeEnv("PAYSTACK_SECRET_KEY");
    if (!secretKey) throw new Error("Payment is not configured.");

    const amount = getPrice(data.product, data.level as ThesisLevel);
    if (amount <= 0) throw new Error("Invalid product or level");

    const metadata = {
      userId,
      product: data.product,
      level: data.level ?? null,
    };

    const callbackUrl = runtimeEnv("NEXT_PUBLIC_APP_URL") || "https://mybrainpadi.com";
    const redirectUrl = data.callbackUrl
      ? data.callbackUrl
      : data.level
        ? `${callbackUrl}/dashboard?payment_verify=thesis&level=${data.level}`
        : `${callbackUrl}/dashboard?payment_verify=proposal`;

    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        amount: amount * 100, // Paystack uses kobo (cents)
        currency: "NGN",
        metadata,
        callback_url: redirectUrl,
      }),
    });

    const json = await resp.json();
    if (!json.status) throw new Error(json.message || "Payment initiation failed");

    const reference = json.data.reference;

    // Save pending transaction immediately so it persists even if the
    // post-payment callback (verifyPayment) fails due to network outage
    const { supabase } = context;
    await (supabase as any).from("transactions").insert({
      user_id: userId,
      reference,
      amount,
      currency: "NGN",
      product: data.product,
      level: data.level ?? null,
      status: "pending",
      metadata: {},
    });

    return { authorization_url: json.data.authorization_url, reference };
  });

// --- Verify Payment ---

const VerifyPaymentInput = z.object({
  reference: z.string().min(1),
});

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => VerifyPaymentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const secretKey = runtimeEnv("PAYSTACK_SECRET_KEY");
    if (!secretKey) throw new Error("Payment is not configured.");

    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const json = await resp.json();
    if (!json.status || json.data.status !== "success") {
      throw new Error("Payment verification failed");
    }

    const { metadata } = json.data;
    const amount = json.data.amount / 100; // Convert back from kobo

    // Upsert transaction (pending record was already saved in initPayment)
    // Note: used column may not exist yet. Omit it — DEFAULT false handles it.
    const { error: txError } = await (supabase as any)
      .from("transactions")
      .upsert({
        user_id: userId,
        reference: data.reference,
        amount,
        currency: "NGN",
        product: metadata.product,
        level: metadata.level || null,
        status: "completed",
        metadata: json.data,
      }, { onConflict: "reference" });

    if (txError) throw new Error("Failed to record payment");

    // Send payment confirmed email (fire-and-forget)
    const userEmail = await getUserEmail(userId);
    const toolName = productToTool(metadata.product) as BrainPadiTool | null;
    if (userEmail && toolName) {
      const userName = userEmail.split("@")[0];
      sendPaymentConfirmedEmail({
        to: userEmail,
        name: userName,
        tool: toolName,
        amount: amount.toLocaleString(),
      });

      // Credit referral commission (fire-and-forget — never block payment flow)
      import("./referral").then(({ creditReferralCommission }) =>
        creditReferralCommission({
          paymentId: data.reference,
          referredUserId: userId,
          paymentAmount: amount,
          tool: metadata.product ?? toolName,
        }).catch(() => {}),
      ).catch(() => {});
    }

    return { success: true, product: metadata.product, level: metadata.level };
  });

// --- Send payment failed email (called from Paystack webhook) ---

export const handlePaymentFailed = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ product: z.string().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const email = await getUserEmail(userId);
    if (!email) return { success: false };
    const name = email.split("@")[0];
    const tool = (productToTool(data.product ?? "") as BrainPadiTool) ?? "Thesis";
    await sendPaymentFailedEmail({
      to: email,
      name,
      tool,
      amount: "0",
    });
    return { success: true };
  });

// --- Check Access ---

const CheckAccessInput = z.object({
  product: z.enum(["proposal", "thesis", "assignment", "exam", "presentation", "cv"]),
  level: z.enum(["undergraduate", "masters", "phd"]).optional(),
});

// ─── Count unused transactions for a product/level ───
// Returns number of unused credits. Falls back to counting ALL completed
// transactions if the `used` column doesn't exist yet in production.
async function countUnusedTx(supabase: any, userId: string, product: string, level?: string): Promise<number> {
  try {
    let query = (supabase as any)
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", product)
      .eq("used", false);
    if (level) query = query.eq("level", level);
    const { count, error } = await query;

    // Column exists → return unused count
    if (!error) return count ?? 0;

    // Column missing → fallback: count ALL completed transactions
    // (user hasn't run the ALTER TABLE migration yet)
    const { count: fallbackCount } = await (supabase as any)
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", product);
    return fallbackCount ?? 0;
  } catch {
    return 0;
  }
}

// ─── Mark oldest unused transaction as used ───
// Graceful: if `used` column doesn't exist, the query errors, and we return false —
// credit won't be consumed, but at least generation won't break.
async function consumeTransaction(supabase: any, userId: string, product: string, level?: string): Promise<boolean> {
  try {
    let selectQ = (supabase as any)
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", product)
      .eq("used", false)
      .order("created_at", { ascending: true })
      .limit(1);
    if (level) selectQ = selectQ.eq("level", level);
    const { data: tx } = await selectQ.maybeSingle();
    if (!tx) return false;

    const { error } = await (supabase as any)
      .from("transactions")
      .update({ used: true })
      .eq("id", tx.id);
    return !error;
  } catch {
    return false;
  }
}

export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => CheckAccessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const price = getPrice(data.product, data.level as ThesisLevel);

    // Count unused completed transactions for this product/level
    const unused = await countUnusedTx(context.supabase, userId, data.product, data.level as string | undefined);
    if (unused > 0) return { allowed: true, price };

    // Fallback 1: user just paid via Paystack but hook hasn't fired yet (pending < 3 min)
    try {
      const freshCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { count: recentPending } = await (context.supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .eq("product", data.product)
        .gte("created_at", freshCutoff);
      if ((recentPending ?? 0) > 0) return { allowed: true, price };
    } catch { /* ignore */ }

    // Fallback 2: admin-assigned free credits in user_limits
    try {
      const canGen = await checkGenerateLimit(context.supabase, userId, data.product, data.level as string | undefined);
      if (canGen) return { allowed: true, price };
    } catch { /* ignore */ }

    return { allowed: false, price };
  });

// --- Debug: raw access check (for the billing page debug panel) ---

export const debugAccess = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => CheckAccessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const unused = await countUnusedTx(context.supabase, userId, data.product, data.level as string | undefined);

    // Also get raw transaction counts for debugging
    let allCompleted = 0;
    let allUnused = 0;
    try {
      const { count: c1 } = await (context.supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("product", data.product)
        .eq("status", "completed");
      allCompleted = c1 ?? 0;
      const { count: c2 } = await (context.supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("product", data.product)
        .eq("status", "completed")
        .eq("used", false);
      allUnused = c2 ?? 0;
    } catch { /* ignore */ }

    return {
      product: data.product,
      level: data.level ?? null,
      allCompleted,
      allUnused,
      unused: unused,
      isAllowed: unused > 0,
    };
  });

// --- Debug: transaction state (for the billing page debug panel) ---

export const debugTxState = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: txns } = await (supabase as any)
      .from("transactions")
      .select("id, reference, product, level, status, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Also get completed doc counts
    const { count: proposalDocs } = await (supabase as any)
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    const { count: ugThesisDocs } = await (supabase as any)
      .from("theses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("level", "undergraduate");
    const { count: msThesisDocs } = await (supabase as any)
      .from("theses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("level", "masters");
    const { count: phdThesisDocs } = await (supabase as any)
      .from("theses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("level", "phd");

    return {
      transactions: txns ?? [],
      completedDocs: {
        proposal: proposalDocs ?? 0,
        thesis_undergraduate: ugThesisDocs ?? 0,
        thesis_masters: msThesisDocs ?? 0,
        thesis_phd: phdThesisDocs ?? 0,
      },
      sessionStorage: {
        return_path: typeof process !== "undefined" ? undefined : null,
      },
    };
  });

// --- Mark transaction as used (for non-document tools) ---

const MarkUsedInput = z.object({
  product: z.enum(["assignment", "exam", "presentation", "cv"]),
});

export const markTransactionUsed = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => MarkUsedInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const consumed = await consumeTransaction(context.supabase, userId, data.product);
    if (!consumed) {
      // No paid transaction found — try admin free credits
      const { incrementUsage } = await import("./admin-limits.functions");
      await incrementUsage(context.supabase, userId, data.product);
    }
    return { ok: true };
  });

// --- Get payment history ---

export const getPaymentHistory = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  });
