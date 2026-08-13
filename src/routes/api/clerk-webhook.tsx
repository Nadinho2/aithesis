import { createFileRoute } from "@tanstack/react-router";
import { sendWelcomeEmail, sendVerificationEmail } from "@/lib/mail";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/api/clerk-webhook")({
  server: {
    handlers: {
      POST: async (ctx) => {
        const request = ctx.request;
        try {
          const secretKey = runtimeEnv("CLERK_SECRET_KEY");
          if (!secretKey) {
            return new Response(JSON.stringify({ error: "Clerk not configured" }), { status: 500 });
          }

          const text = await request.text();
          const svixId = request.headers.get("svix-id");
          const svixTimestamp = request.headers.get("svix-timestamp");
          const svixSignature = request.headers.get("svix-signature");

          // Fail closed: reject requests missing Svix signature headers.
          // Without verification anyone could forge a webhook and trigger
          // email / referral side effects.
          if (!svixId || !svixTimestamp || !svixSignature) {
            return new Response(JSON.stringify({ error: "Missing signature headers" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          let payload: any;
          try {
            const { Webhook } = await import("svix");
            const wh = new Webhook(secretKey);
            payload = wh.verify(text, {
              "svix-id": svixId,
              "svix-timestamp": svixTimestamp,
              "svix-signature": svixSignature,
            });
          } catch {
            console.warn("[clerk-webhook] Signature verification failed");
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const eventType = payload.type;

          // user.created — track referral attribution (catches every signup:
          // password, OAuth, magic link). The ref code is passed via
          // unsafeMetadata during signup on the client.
          if (eventType === "user.created") {
            const { id, unsafe_metadata } = payload.data ?? {};
            const refCode = unsafe_metadata?.ref_code;
            if (id && refCode) {
              import("../../lib/referral").then(({ trackReferral }) =>
                trackReferral(id, String(refCode)).catch(() => {}),
              );
            }
          }

          // user.updated — check if email was just verified, then send welcome
          if (eventType === "user.updated") {
            const { id, email_addresses, first_name } = payload.data ?? {};
            const email = email_addresses?.[0]?.email_address;
            const verified = email_addresses?.[0]?.verification?.status === "verified";
            if (id && email && verified) {
              const name = first_name ?? email.split("@")[0];
              // Fire-and-forget welcome email
              sendWelcomeEmail({ to: email, name });
              // Create referral code for new user (fire-and-forget)
              import("../../lib/referral").then(({ createReferralCodeForUser }) =>
                createReferralCodeForUser(id).catch(() => {}),
              );
            }
          }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.error("[clerk-webhook] Error:", err?.message ?? String(err));
        return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
      }
      },
    },
  },
});
