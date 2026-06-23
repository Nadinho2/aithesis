import { createFileRoute } from "@tanstack/react-router";
import { inngest } from "@/lib/inngest/client";
import { generateThesisJob, generateProposalJob } from "@/lib/inngest/functions";
import { serve } from "inngest/edge";

const inngestHandler = serve({
  client: inngest,
  functions: [generateThesisJob, generateProposalJob],
});

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async (ctx) => inngestHandler(ctx.request),
      POST: async (ctx) => inngestHandler(ctx.request),
    },
  },
});
