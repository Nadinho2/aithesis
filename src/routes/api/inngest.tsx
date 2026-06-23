import { createFileRoute } from "@tanstack/react-router";
import { inngest } from "@/lib/inngest/client";
import { generateThesisJob, generateProposalJob } from "@/lib/inngest/functions";
import { serve } from "inngest/next";

// Inngest serves its functions at this endpoint.
// Inngest calls back here to run background jobs.

const handler = serve({
  client: inngest,
  functions: [generateThesisJob, generateProposalJob],
});

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async (ctx) => {
        // Inngest uses GET for health checks / dev server UI
        return new Response("Inngest handler ready", { status: 200 });
      },
      POST: async (ctx) => {
        try {
          // The Inngest serve handler expects a standard Request and returns a Response
          const response = await handler(ctx.request as any, undefined as any);
          return response;
        } catch (err: any) {
          console.error("[inngest] Handler error:", err?.message ?? String(err));
          return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
