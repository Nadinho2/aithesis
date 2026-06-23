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

          // Verify webhook signature if present
          if (svixId && svixTimestamp && svixSignature) {
            try {
              const { Webhook } = await import("svix");
              const wh = new Webhook(secretKey);
              const payload = wh.verify(text, {
                "svix-id": svixId,
                "svix-timestamp": svixTimestamp,
                "svix-signature": svixSignature,
              }) as any;

              const eventType = payload.type;

              // user.created — send verification email with custom link
              if (eventType === "user.created") {
                const { id, email_addresses, first_name } = payload.data ?? {};
                const email = email_addresses?.[0]?.email_address;
                if (id && email) {
                  const name = first_name ?? email.split("@")[0];
                  // Clerk sends its own verification email — we send a welcome in case they verified elsewhere
                  // For custom verification, we'd send sendVerificationEmail here
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
              }
            }
          } catch {
            // Signature verification failed — still process but log
            console.warn("[clerk-webhook] Signature verification failed");
          }
        } else {
          // No Svix headers — skip verification (dev mode or manual call)
          const payload = JSON.parse(text);
          const eventType = payload.type;
          const { id, email_addresses, first_name } = payload.data ?? {};
          const email = email_addresses?.[0]?.email_address;

          if (eventType === "user.updated" && email) {
            const verified = email_addresses?.[0]?.verification?.status === "verified";
            if (verified) {
              const name = first_name ?? email.split("@")[0];
              sendWelcomeEmail({ to: email, name });
            }
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
