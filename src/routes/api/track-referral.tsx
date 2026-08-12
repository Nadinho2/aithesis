import { createFileRoute } from "@tanstack/react-router";
import { trackReferral } from "@/lib/referral";

export const Route = createFileRoute("/api/track-referral")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          const body = await ctx.request.json();
          const { referredUserId, refCode } = body;

          if (!referredUserId || !refCode) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing referredUserId or refCode" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          await trackReferral(referredUserId, refCode);

          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[track-referral] Error:", err);
          return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
