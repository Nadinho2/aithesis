import { createFileRoute } from "@tanstack/react-router";
import { inngest } from "@/lib/inngest/client";
import { generateThesisJob, generateProposalJob } from "@/lib/inngest/functions";
import { serve } from "inngest/next";

// Inngest serves its functions at this endpoint.
// Inngest calls back here to run background jobs.

const { GET: inngestGET, POST: inngestPOST } = serve({
  client: inngest,
  functions: [generateThesisJob, generateProposalJob],
});

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async (ctx) => {
        return inngestGET(ctx.request as any, undefined as any);
      },
      POST: async (ctx) => {
        try {
          return inngestPOST(ctx.request as any, undefined as any);
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
