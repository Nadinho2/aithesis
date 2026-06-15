import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { getPrice, type ProductType, type ThesisLevel } from "./pricing";

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
  product: z.enum(["proposal", "thesis"]),
  level: z.enum(["undergraduate", "masters", "phd"]).optional(),
  email: z.string().email(),
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

    const appUrl = runtimeEnv("NEXT_PUBLIC_APP_URL") || "https://aithesis.vercel.app";

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
        callback_url: `${appUrl}/dashboard?payment=verify`,
      }),
    });

    const json = await resp.json();
    if (!json.status) throw new Error(json.message || "Payment initiation failed");

    return { authorization_url: json.data.authorization_url, reference: json.data.reference };
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

    // Save transaction
    const { error: txError } = await (supabase as any).from("transactions").insert({
      user_id: userId,
      reference: data.reference,
      amount,
      currency: "NGN",
      product: metadata.product,
      level: metadata.level || null,
      status: "completed",
      metadata: json.data,
    });

    if (txError) throw new Error("Failed to record payment");

    return { success: true, product: metadata.product, level: metadata.level };
  });

// --- Check Access ---

const CheckAccessInput = z.object({
  product: z.enum(["proposal", "thesis"]),
  level: z.enum(["undergraduate", "masters", "phd"]).optional(),
});

export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => CheckAccessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const price = getPrice(data.product, data.level as ThesisLevel);

    // Check for a completed transaction for this product (+ level)
    const query = (supabase as any)
      .from("transactions")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", data.product);

    if (data.level) {
      query.eq("level", data.level);
    }

    const { data: txs } = await query.order("created_at", { ascending: false }).limit(1);

    return {
      allowed: (txs?.length ?? 0) > 0,
      price,
    };
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
