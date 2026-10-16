import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { getPriceFromDB, getPriceForCurrency, type ProductType, type ThesisLevel, type CurrencyType } from "./pricing";
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

function getBachsBaseUrl(secretKey: string): string {
  const custom = runtimeEnv("BACHS_API_BASE_URL");
  if (custom) return custom.replace(/\/+$/, "");
  if (secretKey.startsWith("sk_sandbox_") || secretKey.startsWith("sandbox_")) {
    return "https://sandbox-api.bachs.io";
  }
  return "https://api.bachs.io";
}

// ─── Shared Payment Fulfillment (used by verifyPayment and Bachs Webhook) ───

export async function fulfillPayment(
  supabase: any,
  params: {
    userId: string;
    reference: string;
    amount: number;
    currency?: string;
    product: string;
    level?: string | null;
    rawData?: any;
  },
) {
  const { userId, reference, amount, currency = "NGN", product, level, rawData } = params;

  // Idempotency: verify if this reference was already marked completed
  const { data: existing } = await (supabase as any)
    .from("transactions")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (existing && existing.status === "completed") {
    return { alreadyFulfilled: true };
  }

  // Upsert transaction (pending record was saved during initPayment)
  const { error: txError } = await (supabase as any)
    .from("transactions")
    .upsert(
      {
        user_id: userId,
        reference,
        amount,
        currency,
        product,
        level: level || null,
        status: "completed",
        metadata: rawData ?? {},
      },
      { onConflict: "reference" },
    );

  if (txError) throw new Error("Failed to record payment");

  // Chat: increment chat_available by 50 messages (₦500 = 50 messages)
  if (product === "chat") {
    const { data: limitData } = await (supabase as any)
      .from("user_limits")
      .select("chat_available")
      .eq("user_id", userId)
      .maybeSingle();

    const current = limitData?.chat_available ?? 0;
    await (supabase as any)
      .from("user_limits")
      .upsert(
        { user_id: userId, chat_available: current + 50, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  }

  // Credit referral commission (fire-and-forget — never block payment flow)
  import("./referral")
    .then(({ creditReferralCommission }) =>
      creditReferralCommission({
        paymentId: reference,
        referredUserId: userId,
        paymentAmount: amount,
        tool: product ?? "unknown",
      }).catch(() => {}),
    )
    .catch(() => {});

  // Send payment confirmed email (fire-and-forget)
  const userEmail = await getUserEmail(userId);
  const toolName = productToTool(product) as BrainPadiTool | null;
  if (userEmail && toolName) {
    const userName = userEmail.split("@")[0];
    sendPaymentConfirmedEmail({
      to: userEmail,
      name: userName,
      tool: toolName,
      amount: amount.toLocaleString(),
    });
  }

  return { fulfilled: true };
}

// --- Initialize Payment (Bachs Checkout) ---

const InitPaymentInput = z.object({
  product: z.enum(["proposal", "thesis", "assignment", "exam", "presentation", "cv", "seminar_journal", "seminar_departmental", "seminar_postgraduate", "seminar_technical", "seminar_book_review", "chat", "custom_analysis"]),
  level: z.enum(["undergraduate", "masters", "phd"]).optional(),
  email: z.string().email(),
  currency: z.enum(["NGN", "USD"]).optional().default("NGN"),
  callbackUrl: z.string().optional(),
});

export const initPayment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => InitPaymentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const bachsKey = runtimeEnv("BACHS_SECRET_KEY");

    if (!bachsKey) {
      throw new Error("Payment is not configured. Please configure BACHS_SECRET_KEY.");
    }

    const currency = (data.currency || "NGN") as CurrencyType;
    const amount = await getPriceForCurrency(data.product, data.level as ThesisLevel, currency);
    if (amount <= 0) throw new Error("Invalid product or level");

    const metadata = {
      userId,
      product: data.product,
      level: data.level ?? null,
      currency,
    };

    const callbackUrl = runtimeEnv("NEXT_PUBLIC_APP_URL") || "https://mybrainpadi.com";
    const redirectBase = data.callbackUrl
      ? data.callbackUrl
      : data.level
        ? `${callbackUrl}/dashboard?payment_verify=thesis&level=${data.level}`
        : `${callbackUrl}/dashboard?payment_verify=proposal`;

    const { supabase } = context;

    const baseUrl = getBachsBaseUrl(bachsKey);
    const successUrl = redirectBase.includes("?")
      ? `${redirectBase}&reference={CHECKOUT_SESSION_ID}`
      : `${redirectBase}?reference={CHECKOUT_SESSION_ID}`;
    const cancelUrl = data.callbackUrl || `${callbackUrl}/billing`;

    const resp = await fetch(`${baseUrl}/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bachsKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        pricing: {
          amount: String(amount),
          currency: currency,
        },
        customer: {
          email: data.email,
        },
        metadata,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const errorMsg = json.message || json.error || resp.statusText || "Bachs payment initiation failed";
      throw new Error(errorMsg);
    }

    const checkoutId = json.checkout_id || json.id || json.data?.checkout_id || json.data?.id;
    const checkoutUrl = json.checkout_url || json.url || json.data?.checkout_url || json.data?.url;

    if (!checkoutId || !checkoutUrl) {
      throw new Error("Invalid response received from Bachs checkout API");
    }

    await (supabase as any).from("transactions").insert({
      user_id: userId,
      reference: checkoutId,
      amount,
      currency,
      product: data.product,
      level: data.level ?? null,
      status: "pending",
      metadata: json,
    });

    return { authorization_url: checkoutUrl, reference: checkoutId };
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
    const bachsKey = runtimeEnv("BACHS_SECRET_KEY");

    if (!bachsKey) throw new Error("Payment is not configured. Please configure BACHS_SECRET_KEY.");

    // 1. Check if transaction was already completed (e.g., by Bachs webhook)
    const { data: existingTx } = await (supabase as any)
      .from("transactions")
      .select("*")
      .eq("reference", data.reference)
      .maybeSingle();

    if (existingTx && existingTx.status === "completed") {
      if (existingTx.user_id !== userId) {
        throw new Error("Payment does not belong to this user");
      }
      return { success: true, product: existingTx.product, level: existingTx.level };
    }

    // 2. Verify with Bachs.io API
    try {
      const baseUrl = getBachsBaseUrl(bachsKey);
      const resp = await fetch(`${baseUrl}/v1/checkout-sessions/${encodeURIComponent(data.reference)}`, {
        headers: {
          Authorization: `Bearer ${bachsKey}`,
          Accept: "application/json",
        },
      });

      if (resp.ok) {
        const json = await resp.json().catch(() => ({}));
        const session = json.data ?? json;
        const status = (session.status || "").toLowerCase();
        const isSuccess =
          status === "completed" ||
          status === "succeeded" ||
          status === "paid" ||
          session.payment_status === "paid" ||
          session.charge?.status === "succeeded";

        if (isSuccess) {
          const metadata = session.metadata || existingTx?.metadata || {};
          const amount = session.pricing?.amount
            ? Number(session.pricing.amount)
            : session.amount
              ? Number(session.amount)
              : existingTx?.amount || 0;
          const currency = session.pricing?.currency || session.currency || "NGN";

          if (metadata.userId && metadata.userId !== userId) {
            throw new Error("Payment does not belong to this user");
          }
          if (existingTx && existingTx.user_id !== userId) {
            throw new Error("Payment does not belong to this user");
          }

          await fulfillPayment(supabase, {
            userId,
            reference: data.reference,
            amount,
            currency,
            product: metadata.product || existingTx?.product,
            level: metadata.level || existingTx?.level || null,
            rawData: session,
          });

          return {
            success: true,
            product: metadata.product || existingTx?.product,
            level: metadata.level || existingTx?.level,
          };
        }
      }
    } catch (err) {
      console.warn("[verifyPayment] Bachs verification check error:", err);
    }

    throw new Error("Payment verification failed. If you were debited, your transaction will be credited shortly.");
  });

// --- Send payment failed email ---

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
  product: z.enum(["proposal", "thesis", "assignment", "exam", "presentation", "cv", "seminar_journal", "seminar_departmental", "seminar_postgraduate", "seminar_technical", "seminar_book_review", "chat", "custom_analysis"]),
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

    const { data: updated, error } = await (supabase as any)
      .from("transactions")
      .update({ used: true })
      .eq("id", tx.id)
      .eq("used", false)
      .select("id");
    return !error && Array.isArray(updated) && updated.length > 0;
  } catch {
    return false;
  }
}

export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => CheckAccessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const price = await getPriceFromDB(data.product, data.level as ThesisLevel);

    // Count unused completed transactions for this product/level
    const unused = await countUnusedTx(context.supabase, userId, data.product, data.level as string | undefined);
    if (unused > 0) return { allowed: true, price };

    // Fallback 1: user just paid via Bachs but webhook hasn't fired yet (pending < 3 min)
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
  product: z.enum(["assignment", "exam", "presentation", "cv", "seminar_journal", "seminar_departmental", "seminar_postgraduate", "seminar_technical", "seminar_book_review", "chat", "custom_analysis"]),
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
