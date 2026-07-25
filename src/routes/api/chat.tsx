import { createFileRoute } from "@tanstack/react-router";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          const body = (await ctx.request.json()) as { chatId: string | null; message: string };
          const { chatId: incomingChatId, message } = body;

          if (!message || typeof message !== "string" || !message.trim()) {
            return new Response(JSON.stringify({ error: "Message is required." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Extract user ID from Clerk session
          const cookieHeader = ctx.request.headers.get("cookie") ?? "";
          const sessionMatch = cookieHeader.match(/(?:__session|__clerk_db_jwt)=([^;]+)/);
          const sessionToken = sessionMatch?.[1] ?? null;

          if (!sessionToken) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { verifyToken } = await import("@clerk/backend");
          const clerkSecretKey = runtimeEnv("CLERK_SECRET_KEY");
          if (!clerkSecretKey) {
            return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          let userId: string;
          try {
            const payload = await verifyToken(sessionToken, { secretKey: clerkSecretKey });
            userId = payload.sub;
          } catch {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;

          // ── Rate limit: check user has chat credits ──
          const { checkGenerateLimit } = await import("@/lib/admin-limits.functions");
          const canChat = await checkGenerateLimit(db, userId, "chat");
          if (!canChat) {
            return new Response(
              JSON.stringify({ error: "Chat credit exhausted. Purchase more from Billing.", code: "PAYMENT_REQUIRED" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          let chatId = incomingChatId;

          // Step 1: Create chat if new
          if (!chatId) {
            const title = message.trim().slice(0, 40).replace(/\s+\S*$/, "");
            const { data: newChat, error: createError } = await db
              .from("chats")
              .insert({ user_id: userId, title: title || "New chat" })
              .select("id")
              .single();

            if (createError || !newChat) {
              console.error("Failed to create chat:", createError);
              return new Response(JSON.stringify({ error: "Failed to create chat." }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
            chatId = newChat.id;
          }

          // Step 2: Insert user message
          const { error: userMsgError } = await db
            .from("chat_messages")
            .insert({ chat_id: chatId, role: "user", content: message.trim() });

          if (userMsgError) {
            console.error("Failed to insert user message:", userMsgError);
          }

          // Step 3: Fetch last 10 messages for context
          const { data: prevMessages } = await db
            .from("chat_messages")
            .select("role, content")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })
            .limit(10);

          const previousMessages = (prevMessages ?? []).map((m: any) => ({
            role: m.role,
            content: m.content,
          }));

          // Step 4: Call DeepSeek API
          const deepseekKey = runtimeEnv("DEEPSEEK_API_KEY");
          if (!deepseekKey) {
            return new Response(JSON.stringify({ error: "AI service not configured." }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          let aiResponse: string;
          try {
            const systemPrompt =
              "You are a helpful, encouraging study assistant for Nigerian university students on MyBrainPadi. Explain concepts clearly and simply, as if teaching a student who is still learning. Use short paragraphs. When explaining academic concepts, ground examples in real-world or Nigerian context where natural. Do not use markdown bold or italic syntax — write in plain text. Keep responses focused and not overly long unless the student asks for detail. If asked something outside academic or career topics, gently redirect to how you can help with their studies or career.";

            const deepseekResp = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${deepseekKey}`,
              },
              body: JSON.stringify({
                model: "deepseek-chat",
                temperature: 0.7,
                max_tokens: 1000,
                messages: [
                  { role: "system", content: systemPrompt },
                  ...previousMessages,
                ],
              }),
            });

            if (!deepseekResp.ok) {
              const errText = await deepseekResp.text();
              console.error("DeepSeek API error:", deepseekResp.status, errText);
              throw new Error(`DeepSeek API error ${deepseekResp.status}`);
            }

            const payload = await deepseekResp.json();
            aiResponse = payload?.choices?.[0]?.message?.content;
            if (!aiResponse) throw new Error("Empty response from AI");
          } catch (err: any) {
            console.error("DeepSeek call failed:", err?.message ?? err);
            return new Response(
              JSON.stringify({ error: "Couldn't get a response. Try again." }),
              { status: 502, headers: { "Content-Type": "application/json" } }
            );
          }

          // Step 5: Insert assistant response
          const { error: assistantMsgError } = await db
            .from("chat_messages")
            .insert({ chat_id: chatId, role: "assistant", content: aiResponse });

          if (assistantMsgError) {
            console.error("Failed to insert assistant message:", assistantMsgError);
          }

          // Step 6: Update chat updated_at
          await db
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chatId);

          // Step 7: Decrement chat credit after successful generation
          const { incrementUsage } = await import("@/lib/admin-limits.functions");
          incrementUsage(db, userId, "chat").catch(() => {});

          // Step 8: Return response
          return new Response(
            JSON.stringify({ chatId, message: aiResponse }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[chat API] Error:", err?.message ?? String(err));
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
