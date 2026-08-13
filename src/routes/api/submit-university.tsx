import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const clerkSecretKey = runtimeEnv("CLERK_SECRET_KEY");
  if (!clerkSecretKey) return null;

  let sessionToken = request.headers.get("authorization");
  if (sessionToken?.startsWith("Bearer ")) sessionToken = sessionToken.slice(7);
  if (!sessionToken) return null;

  const { verifyToken } = await import("@clerk/backend");
  try {
    const payload = await verifyToken(sessionToken, { secretKey: clerkSecretKey });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/submit-university")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          const request = ctx.request;
          const body = await request.json();
          const { universityName, department, chapterStructure, email } = body;

          if (!universityName || !department || !chapterStructure) {
            return new Response(
              JSON.stringify({ success: false, error: "All fields are required: universityName, department, chapterStructure" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Require an authenticated user (Clerk session token).
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const supabaseUrl = runtimeEnv("SUPABASE_URL");
          const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
          if (!supabaseUrl || !supabaseKey) {
            return new Response(
              JSON.stringify({ success: false, error: "Server configuration error" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { error } = await supabase.from("university_submissions").insert({
            university_name: universityName,
            department,
            chapter_structure: chapterStructure,
            email: email || null,
            submitted_by: userId,
            status: "pending",
          });

          if (error) {
            return new Response(
              JSON.stringify({ success: false, error: "Failed to save submission" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          // Notify admin
          try {
            const { notifyAdminUniversitySubmitted } = await import("@/lib/mail-helper");
            await notifyAdminUniversitySubmitted(universityName, department, chapterStructure, email || null);
          } catch {
            // notification is best-effort
          }

          return new Response(
            JSON.stringify({ success: true, message: "Thank you! We'll review and add your university soon." }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid request" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
