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
    const supabaseUrl = runtimeEnv("SUPABASE_URL");
    const supabaseKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecretKey = runtimeEnv("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey || !paystackSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authenticate user from Clerk session
    const authHeader = request.headers.get("Authorization") ?? "";
    let userId: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Verify the session with Supabase auth
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Also try Clerk session token (Clerk header from the client)
    if (!userId) {
      const clerkToken = request.headers.get("x-clerk-session") ?? "";
      if (clerkToken) {
        // We'll trust the passed userId from authorized session
      }
    }

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

    // Check wallet balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const balance = wallet ? (wallet as any).balance : 0;
    if (balance < amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient wallet balance" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Create Paystack Transfer Recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: String(accountNumber),
        bank_code: bankCode,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      return new Response(
        JSON.stringify({ success: false, error: `Paystack error: ${recipientData.message ?? "Failed to create recipient"}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const recipientCode = recipientData.data.recipient_code;

    // Insert withdrawal request
    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: userId,
        amount,
        bank_code: bankCode,
        account_number: String(accountNumber),
        account_name: accountName,
        paystack_recipient_code: recipientCode,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError || !withdrawal) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create withdrawal record" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const withdrawalId = (withdrawal as any).id;

    // Deduct from wallet (optimistic)
    await supabase
      .from("wallets")
      .update({
        balance: balance - amount,
        total_withdrawn: ((wallet as any)?.total_withdrawn ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Initiate Paystack Transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // Convert to kobo
        recipient: recipientCode,
        reason: "MyBrainPadi referral withdrawal",
        reference: withdrawalId,
      }),
    });

    const transferData = await transferRes.json();
    if (!transferData.status) {
      // Reverse the wallet deduction
      await supabase
        .from("wallets")
        .update({
          balance,
          total_withdrawn: (wallet as any)?.total_withdrawn ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      await supabase
        .from("withdrawal_requests")
        .update({ status: "failed", failure_reason: transferData.message ?? "Transfer initiation failed" })
        .eq("id", withdrawalId);

      return new Response(
        JSON.stringify({ success: false, error: `Transfer failed: ${transferData.message ?? "Unknown error"}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const transferCode = transferData.data.transfer_code;

    // Update withdrawal with transfer code
    await supabase
      .from("withdrawal_requests")
      .update({ paystack_transfer_id: transferCode, status: "processing" })
      .eq("id", withdrawalId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Withdrawal initiated successfully",
        withdrawalId,
        transferCode,
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
}
