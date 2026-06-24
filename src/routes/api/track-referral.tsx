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
    const { referredUserId, refCode } = body;

    if (!referredUserId || !refCode) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing referredUserId or refCode" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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

    // Look up the referral code
    const { data: referrer } = await supabase
      .from("referral_codes")
      .select("user_id")
      .eq("code", refCode.toUpperCase())
      .maybeSingle();

    if (!referrer) {
      return new Response(
        JSON.stringify({ success: true, message: "Referral code not found" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const referrerId = (referrer as any).user_id;
    if (referrerId === referredUserId) {
      return new Response(
        JSON.stringify({ success: true, message: "Cannot self-refer" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Insert relationship (upsert — a user can only be referred once)
    await supabase
      .from("referral_relationships")
      .upsert(
        { referrer_id: referrerId, referred_id: referredUserId },
        { onConflict: "referred_id", ignoreDuplicates: true },
      );

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
}
