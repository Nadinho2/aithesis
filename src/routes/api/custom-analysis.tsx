import { createFileRoute } from "@tanstack/react-router";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/api/custom-analysis")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          const body = (await ctx.request.json()) as {
            title: string;
            scenarioText: string;
            fields: string[];
          };

          const { title, scenarioText, fields } = body;

          // ── Validation ──
          if (!title || typeof title !== "string" || !title.trim()) {
            return new Response(
              JSON.stringify({ error: "Title is required." }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (title.length > 100) {
            return new Response(
              JSON.stringify({ error: "Title must be 100 characters or fewer." }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!scenarioText || typeof scenarioText !== "string" || !scenarioText.trim()) {
            return new Response(
              JSON.stringify({ error: "Scenario text is required." }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (scenarioText.length > 2000) {
            return new Response(
              JSON.stringify({ error: "Scenario text must be 2,000 characters or fewer." }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!fields || !Array.isArray(fields) || fields.length < 1) {
            return new Response(
              JSON.stringify({ error: "At least 1 field is required." }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (fields.length > 10) {
            return new Response(
              JSON.stringify({ error: "Maximum 10 fields allowed." }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          for (const f of fields) {
            if (typeof f !== "string" || !f.trim()) {
              return new Response(
                JSON.stringify({ error: "Each field name must be non-empty." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
            if (f.length > 60) {
              return new Response(
                JSON.stringify({ error: "Each field name must be 60 characters or fewer." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          // ── Auth: extract user ID from Clerk session ──
          const cookieHeader = ctx.request.headers.get("cookie") ?? "";
          const sessionMatch = cookieHeader.match(/(?:__session|__clerk_db_jwt)=([^;]+)/);
          const sessionToken = sessionMatch?.[1] ?? null;

          if (!sessionToken) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          const { verifyToken } = await import("@clerk/backend");
          const clerkSecretKey = runtimeEnv("CLERK_SECRET_KEY");
          if (!clerkSecretKey) {
            return new Response(
              JSON.stringify({ error: "Server misconfiguration" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          let userId: string;
          try {
            const payload = await verifyToken(sessionToken, { secretKey: clerkSecretKey });
            userId = payload.sub;
          } catch {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;

          // ── Insert pending record ──
          const initialFields = fields.map((f) => ({ name: f, answer: "" }));

          const { data: record, error: insertError } = await db
            .from("custom_analyses")
            .insert({
              user_id: userId,
              title: title.trim(),
              scenario_text: scenarioText.trim(),
              fields: initialFields,
              status: "pending",
            })
            .select("id")
            .single();

          if (insertError || !record) {
            console.error("[custom-analysis] Insert error:", insertError);
            return new Response(
              JSON.stringify({ error: "Failed to save analysis record." }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const recordId = record.id;

          // ── Generate analysis ──
          const { generateCustomAnalysis } = await import("@/lib/jobs/generateCustomAnalysis");
          const result = await generateCustomAnalysis({
            scenarioText: scenarioText.trim(),
            fields: fields.map((f) => f.trim()),
          });

          if (result.success && result.results) {
            // Update record with results
            await db
              .from("custom_analyses")
              .update({
                fields: result.results,
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("id", recordId);

            return new Response(
              JSON.stringify({ success: true, id: recordId, results: result.results }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          } else {
            // Update record as failed
            await db
              .from("custom_analyses")
              .update({ status: "failed" })
              .eq("id", recordId);

            return new Response(
              JSON.stringify({ success: false, error: result.error || "Generation failed." }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        } catch (err: any) {
          console.error("[custom-analysis API] Error:", err?.message ?? String(err));
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
