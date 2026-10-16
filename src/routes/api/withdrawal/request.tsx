import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

function getHeader(headers: Headers, name: string): string | null {
  return headers.get(name) ?? null;
}

function extractSessionFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const name of ["__session", "__clerk_db_jwt"]) {
    const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const clerkSecretKey = runtimeEnv("CLERK_SECRET_KEY");
  if (!clerkSecretKey) return null;

  let sessionToken = getHeader(request.headers, "x-clerk-session-token");
  if (!sessionToken) {
    const authHeader = getHeader(request.headers, "authorization");
    if (authHeader?.startsWith("Bearer ")) sessionToken = authHeader.slice(7);
  }
  if (!sessionToken) {
    sessionToken = extractSessionFromCookies(getHeader(request.headers, "cookie"));
  }
  if (!sessionToken) return null;

  const { verifyToken } = await import("@clerk/backend");
  try {
    const payload = await verifyToken(sessionToken, { secretKey: clerkSecretKey });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/withdrawal/request")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          const request = ctx.request;
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

          // Authenticate user from Clerk session token
          const userId = await getUserIdFromRequest(request);

          if (!userId) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = await request.json();
          const { amount, bankCode, accountNumber, accountName } = body;

          // Validation
          const errors: string[] = [];
          if (!amount || typeof amount !== "number" || amount < 5000) {
            errors.push("Minimum withdrawal is ₦5,000");
          }
          if (!bankCode) errors.push("Bank code is required");
          if (!accountNumber || !/^\d{10}$/.test(String(accountNumber))) {
            errors.push("Account number must be exactly 10 digits");
          }
          if (!accountName) errors.push("Account name is required");

          if (errors.length > 0) {
            return new Response(
              JSON.stringify({ success: false, error: errors.join("; ") }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Atomically deduct the wallet balance. Returns NULL on insufficient
          // funds, preventing concurrent requests from overdrawing the wallet.
          const { data: newBalance, error: deductError } = await supabase
            .rpc("deduct_wallet", { p_user_id: userId, p_amount: amount });

          if (deductError || newBalance === null) {
            return new Response(
              JSON.stringify({ success: false, error: "Insufficient wallet balance" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Insert withdrawal request
          const { data: withdrawal, error: insertError } = await supabase
            .from("withdrawal_requests")
            .insert({
              user_id: userId,
              amount,
              bank_code: bankCode,
              account_number: String(accountNumber),
              account_name: accountName,
              status: "pending",
            })
            .select("id")
            .single();

          if (insertError || !withdrawal) {
            // Roll back the deduction we just made.
            await supabase.rpc("refund_wallet", { p_user_id: userId, p_amount: amount });
            return new Response(
              JSON.stringify({ success: false, error: "Failed to create withdrawal record" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const withdrawalId = (withdrawal as any).id;

          return new Response(
            JSON.stringify({
              success: true,
              message: "Withdrawal request submitted successfully and queued for payment.",
              withdrawalId,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("[withdrawal/request] Error:", err);
          return new Response(
            JSON.stringify({ success: false, error: err?.message ?? "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
