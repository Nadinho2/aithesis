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

          const previousMessages = (prevMessages ?? [])
            .filter((m: any) => m.role && typeof m.content === "string" && m.content.trim().length > 0)
            .map((m: any) => ({
              role: m.role,
              content: m.content.trim(),
            }));

          // Fetch the chat's scoped context (e.g. Ask PADI past question)
          const { data: chatRow } = await db
            .from("chats")
            .select("context")
            .eq("id", chatId)
            .maybeSingle();
          const chatContext = (chatRow?.context ?? {}) as Record<string, any>;

          // Step 4: Call DeepSeek API
          const deepseekKey = runtimeEnv("DEEPSEEK_API_KEY");
          if (!deepseekKey) {
            return new Response(JSON.stringify({ error: "AI service not configured." }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          let aiResponse: string;
          let replyText = "";
          let suggestion: any = null;
          try {
            const baseSystemPrompt =
              "You are a helpful, encouraging study assistant for Nigerian university students on MyBrainPadi. Explain concepts clearly and simply, as if teaching a student who is still learning. Use short paragraphs. When explaining academic concepts, ground examples in real-world or Nigerian context where natural. Do not use markdown bold or italic syntax, write in plain text. Keep responses focused and not overly long unless the student asks for detail. If asked something outside academic or career topics, gently redirect to how you can help with their studies or career.";

            let systemPrompt = baseSystemPrompt;
            if (chatContext?.kind === "past_question") {
              const opts = Array.isArray(chatContext.options) ? chatContext.options : [];
              const optionsBlock = opts.length
                ? `\nOptions:\n${opts
                    .map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${o}`)
                    .join("\n")}`
                : "";
              systemPrompt =
                baseSystemPrompt +
                `\n\nThe student is asking about a specific past question they just attempted. Use this context so they do not need to re-explain it:` +
                `\nQuestion: ${chatContext.question}` +
                optionsBlock +
                `\nCorrect answer: ${chatContext.answer}` +
                (chatContext.explanation ? `\nStatic explanation: ${chatContext.explanation}` : "") +
                (chatContext.subject ? `\nSubject: ${chatContext.subject}` : "") +
                (chatContext.course ? `\nCourse: ${chatContext.course}` : "") +
                `\n\nThey have already attempted the question, so it is fine to explain the correct answer and why other options are wrong. Tailor your answer to their specific confusion.`;
            }

            systemPrompt +=
              `\n\nRouting: if the student's need clearly maps to a tool on the platform, you may suggest it, but only when it genuinely helps. Never be pushy or salesy. ` +
              `Available tools and their pre-fill keys: ` +
              `topic-discovery (find or develop a research topic): area_of_interest, department, course. ` +
              `thesis (draft a full thesis): title, area_of_interest, department, level (one of undergraduate, masters, phd). ` +
              `proposal (draft a research proposal): title, area_of_interest, department, level (one of undergraduate, masters, phd). ` +
              `cv (tailor a CV to a job): job_title, job_description. ` +
              `side-hustle (discover a side hustle): skills, interests. ` +
              `Reply with a JSON object only, in this exact shape: {"reply": string, "suggestion": null} ` +
              `or {"reply": string, "suggestion": {"tool": "...", "label": "short button label", "prefill": { ...only the relevant keys above... }}}. ` +
              `"suggestion" must be null unless a route genuinely fits. Keep "label" to four words or fewer.`;

            const messagesForDebug = [
              { role: "system", content: systemPrompt.slice(0, 80) + "..." },
              ...previousMessages,
            ];

            const deepseekResp = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${deepseekKey}`,
              },
              body: JSON.stringify({
                model: "deepseek-v4-flash",
                temperature: 0.7,
                max_tokens: 1000,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemPrompt },
                  ...previousMessages,
                ],
              }),
            });

            if (!deepseekResp.ok) {
              const errText = await deepseekResp.text();
              console.error("DeepSeek API error:", deepseekResp.status, errText);
              console.error("Messages sent:", JSON.stringify(messagesForDebug).slice(0, 500));
              return new Response(
                JSON.stringify({ error: `AI service error: ${errText.slice(0, 200)}` }),
                { status: 502, headers: { "Content-Type": "application/json" } }
              );
            }

            const payload = await deepseekResp.json();
            aiResponse = payload?.choices?.[0]?.message?.content;

            // V4 model defaults to thinking ON — fallback to reasoning_content
            if (!aiResponse || aiResponse.trim().length === 0) {
              aiResponse = payload?.choices?.[0]?.message?.reasoning_content;
            }

            if (!aiResponse) {
              console.error("DeepSeek V4 empty response:", JSON.stringify(payload).slice(0, 500));
              throw new Error("Empty response from AI");
            }

            // Parse the JSON reply + optional routing suggestion
            try {
              const parsed = JSON.parse(aiResponse);
              const reply = parsed && typeof parsed.reply === "string" ? parsed.reply.trim() : "";
              replyText = reply || aiResponse;
              if (parsed && parsed.suggestion && typeof parsed.suggestion === "object") {
                suggestion = parsed.suggestion;
              }
            } catch {
              // Model returned plain text; treat the whole thing as the reply
              replyText = aiResponse;
            }
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
            .insert({ chat_id: chatId, role: "assistant", content: replyText, suggestion });

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
            JSON.stringify({ chatId, message: replyText, suggestion }),
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
