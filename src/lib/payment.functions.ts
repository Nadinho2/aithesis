import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { getPrice, type ProductType, type ThesisLevel } from "./pricing";
import { sendPaymentConfirmedEmail, sendPaymentFailedEmail } from "./mail";
import type { BrainPadiTool } from "./mail";
import { getUserEmail, productToTool } from "./mail-helper";

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
  .handler(async ({ context }) => {
    const { userId } = context;
    const email = await getUserEmail(userId);
    if (!email) return { success: false };
    const name = email.split("@")[0];
    await sendPaymentFailedEmail({
      to: email,
      name,
      tool: "Thesis",
      amount: "0",
    });
    return { success: true };
  });

// --- Check Access ---

const CheckAccessInput = z.object({
  product: z.enum(["proposal", "thesis", "assignment", "exam", "presentation", "cv"]),
  level: z.enum(["undergraduate", "masters", "phd"]).optional(),
});

export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => CheckAccessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const price = getPrice(data.product, data.level as ThesisLevel);

    // For proposal/thesis: count completed transactions vs documents generated
    if (data.product === "proposal" || data.product === "thesis") {
      const txQuery = (supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .eq("product", data.product);
      if (data.level) txQuery.eq("level", data.level);
      const { count: txCount } = await txQuery;

      let usageCount = 0;
      if (data.product === "proposal") {
        const { count } = await (supabase as any)
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed");
        usageCount = count ?? 0;
      } else {
        const thesisQuery = (supabase as any)
          .from("theses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed");
        if (data.level) thesisQuery.eq("level", data.level);
        const { count } = await thesisQuery;
        usageCount = count ?? 0;
      }

      const unused = (txCount ?? 0) - usageCount;
      if (unused > 0) {
        return { allowed: true, price };
      }
    }

    // For non-document tools: count only unused (consumable) transactions
    if (["assignment", "exam", "presentation", "cv"].includes(data.product)) {
      const { count: unusedCount } = await (supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .eq("product", data.product)
        .eq("used", false);
      if ((unusedCount ?? 0) > 0) {
        return { allowed: true, price };
      }
    }

    // Check 2: Admin-allocated limit from user_limits table
    const { data: limits } = await (supabase as any)
      .from("user_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (limits) {
      if (data.product === "thesis") {
        const level = data.level ?? "undergraduate";
        const field = `thesis_available_${level}`;
        const available = (limits as any)[field] ?? 0;
        if (available > 0) {
          return { allowed: true, price };
        }
      }
      if (data.product === "proposal") {
        const available = (limits.proposal_limit ?? 0) - (limits.proposal_used ?? 0);
        if (available > 0) {
          return { allowed: true, price };
        }
      }
      if (data.product === "assignment") {
        const available = (limits as any).assignment_available ?? 0;
        if (available > 0) {
          return { allowed: true, price };
        }
      }
      if (data.product === "exam") {
        const available = (limits as any).exam_available ?? 0;
        if (available > 0) {
          return { allowed: true, price };
        }
      }
      if (data.product === "presentation") {
        const available = (limits as any).presentation_available ?? 0;
        if (available > 0) {
          return { allowed: true, price };
        }
      }
      if (data.product === "cv") {
        const available = (limits as any).cv_available ?? 0;
        if (available > 0) {
          return { allowed: true, price };
        }
      }
    }

    return { allowed: false, price };
  });

// --- Mark transaction as used (for non-document tools) ---

const MarkUsedInput = z.object({
  product: z.enum(["assignment", "exam", "presentation", "cv"]),
});

export const markTransactionUsed = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => MarkUsedInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Mark the most recent unused transaction for this product as used
    const { data: tx } = await (supabase as any)
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("product", data.product)
      .eq("status", "completed")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tx) {
      await (supabase as any)
        .from("transactions")
        .update({ used: true })
        .eq("id", tx.id);
    }
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
