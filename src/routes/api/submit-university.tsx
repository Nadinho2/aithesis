import { createClient } from "@supabase/supabase-js";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { universityName, department, chapterStructure, email } = body;

    if (!universityName || !department || !chapterStructure) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required: universityName, department, chapterStructure" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get authenticated user from Clerk session via Authorization header
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      // Clerk session token — validate with Supabase
      const supabaseUrl = runtimeEnv("SUPABASE_URL");
      const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
        userId = user?.id ?? null;
      }
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
}
