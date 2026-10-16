import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fulfillPayment } from "@/lib/payment.functions";
import * as crypto from "node:crypto";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

function verifyBachsSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret) return true; // Allow testing if secret not configured
  if (!signatureHeader) return false;

  let timestamp = timestampHeader;
  let signature = signatureHeader;

  // Handle v2 signature header format (e.g. t=12345,v1=abcdef...)
  if (signatureHeader.includes("t=") || signatureHeader.includes("v1=")) {
    const parts = signatureHeader.split(",");
    for (const part of parts) {
      const [key, val] = part.trim().split("=");
      if (key === "t" && !timestamp) timestamp = val;
      if (key === "v1") signature = val;
    }
  }

  const payloadToSign = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const hmac = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/bachs-webhook")({
  server: {
    handlers: {
      POST: async (ctx) => {
        const request = ctx.request;

        try {
          const rawBody = await request.text();
          const timestamp = request.headers.get("x-bachs-timestamp");
          const signature =
            request.headers.get("x-bachs-signature-v2") || request.headers.get("x-bachs-signature");
          const webhookSecret = runtimeEnv("BACHS_WEBHOOK_SECRET");

          if (webhookSecret && !verifyBachsSignature(rawBody, timestamp, signature, webhookSecret)) {
            console.warn("[bachs-webhook] Signature verification failed");
            return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          let event: any;
          try {
            event = JSON.parse(rawBody);
          } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const eventType = event.type || event.event || "";
          const eventData = event.data || event;

          // Process successful checkout and collection events
          const isSuccessfulEvent =
            eventType === "checkout.completed" ||
            eventType === "collection.succeeded" ||
            eventType === "charge.succeeded" ||
            eventData.status === "SUCCEEDED" ||
            eventData.status === "succeeded" ||
            eventData.status === "completed";

          if (isSuccessfulEvent) {
            const checkoutId =
              eventData.checkout_id ||
              eventData.id ||
              eventData.reference ||
              eventData.charge_id;

            if (!checkoutId) {
              return new Response(JSON.stringify({ received: true, note: "No reference found" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            const supabaseUrl = runtimeEnv("SUPABASE_URL");
            const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");

            if (!supabaseUrl || !supabaseKey) {
              console.error("[bachs-webhook] Supabase environment variables missing");
              return new Response(JSON.stringify({ error: "Database not configured" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }

            const supabase = createClient(supabaseUrl, supabaseKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });

            // Locate transaction
            const { data: existingTx } = await (supabase as any)
              .from("transactions")
              .select("*")
              .eq("reference", checkoutId)
              .maybeSingle();

            const metadata = eventData.metadata || existingTx?.metadata || {};
            const userId = metadata.userId || metadata.user_id || existingTx?.user_id;

            if (userId) {
              const amount = eventData.pricing?.amount
                ? Number(eventData.pricing.amount)
                : eventData.amount
                  ? Number(eventData.amount)
                  : existingTx?.amount || 0;
              const currency =
                eventData.pricing?.currency || eventData.currency || existingTx?.currency || "NGN";
              const product = metadata.product || existingTx?.product || "thesis";
              const level = metadata.level || existingTx?.level || null;

              await fulfillPayment(supabase, {
                userId,
                reference: checkoutId,
                amount,
                currency,
                product,
                level,
                rawData: eventData,
              });
            }
          }

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("[bachs-webhook] Processing error:", error);
          return new Response(JSON.stringify({ error: error.message || "Webhook error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
