import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildTopicsDocx, toBase64 } from "./docx.server";

const GenerateInput = z.object({
  department: z.string().min(2).max(120),
  course: z.string().max(120).optional().default(""),
  area_of_interest: z.string().min(2).max(200),
  country: z.string().max(80).optional().default(""),
  research_type: z.string().max(80).optional().default(""),
  count: z.number().int().min(1).max(7).default(5),
});

const TopicSchema = z.object({
  title: z.string(),
  problem_statement: z.string(),
  research_gap: z.string(),
  objectives: z.array(z.string()).default([]),
  novelty_score: z.number().min(0).max(10),
  feasibility_score: z.number().min(0).max(10),
  category: z.string().optional().default(""),
});

const TopicsResponse = z.object({ topics: z.array(TopicSchema).min(1).max(7) });

export const generateTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek AI is not configured.");

    const systemPrompt = `You are a senior academic research advisor. Generate exactly ${data.count} ORIGINAL, specific, and feasible research topics tailored to the inputs.
Each topic must have a precise problem statement (2-3 sentences), an identified research gap (1-2 sentences), 3 SMART objectives, a novelty score (1-10), and a feasibility score (1-10).
Avoid generic or vague topics. Prefer specific contexts, populations, methods, or technologies. Do not invent citations — only topic descriptions.
Return STRICT JSON matching the provided schema. No markdown, no commentary.`;

    const userPrompt = `Department: ${data.department}
Course: ${data.course || "(unspecified)"}
Area of interest: ${data.area_of_interest}
Country / context: ${data.country || "(unspecified)"}
Research type: ${data.research_type || "(unspecified)"}

Generate exactly ${data.count} topics now.`;

    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_topics",
              description: "Submit the generated research topics",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        problem_statement: { type: "string" },
                        research_gap: { type: "string" },
                        objectives: { type: "array", items: { type: "string" } },
                        novelty_score: { type: "number" },
                        feasibility_score: { type: "number" },
                        category: { type: "string" },
                      },
                      required: [
                        "title",
                        "problem_statement",
                        "research_gap",
                        "objectives",
                        "novelty_score",
                        "feasibility_score",
                      ],
                    },
                  },
                },
                required: ["topics"],
              },
            },
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
      throw new Error(`DeepSeek API error ${resp.status}: ${text}`);
    }

    const payload = await resp.json();
    const msg = payload?.choices?.[0]?.message;
    let args: any;
    if (msg?.tool_calls?.[0]?.function?.arguments) {
      args = JSON.parse(msg.tool_calls[0].function.arguments);
    } else if (msg?.content) {
      const json = msg.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      try { args = JSON.parse(json); } catch {}
    }
    if (!args) throw new Error("AI did not return topics.");
    const parsed = TopicsResponse.parse(args);

    const { data: gen, error: genErr } = await supabase
      .from("topic_generations")
      .insert({
        user_id: userId,
        department: data.department,
        course: data.course || null,
        area_of_interest: data.area_of_interest,
        country: data.country || null,
        research_type: data.research_type || null,
        topic_count: parsed.topics.length,
      })
      .select()
      .single();
    if (genErr) throw new Error(genErr.message);

    const rows = parsed.topics.map((t) => ({
      user_id: userId,
      generation_id: gen.id,
      title: t.title,
      problem_statement: t.problem_statement,
      research_gap: t.research_gap,
      objectives: t.objectives,
      novelty_score: t.novelty_score,
      feasibility_score: t.feasibility_score,
      department: data.department,
      area_of_interest: data.area_of_interest,
      country: data.country || null,
      research_type: data.research_type || null,
      category: t.category || null,
      saved: true,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("topics")
      .insert(rows)
      .select();
    if (insErr) throw new Error(insErr.message);

    return { generation_id: gen.id, topics: inserted };
  });

export const listTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        generation_id: z.string().uuid().optional(),
        saved_only: z.boolean().optional().default(false),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("topics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.generation_id) q = q.eq("generation_id", data.generation_id);
    if (data.saved_only) q = q.eq("saved", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const toggleSaveTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), saved: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("topics")
      .update({ saved: data.saved })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("topics").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("topics").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("topic_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const exportTopicsDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("topics")
      .select("*")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("No topics found");
    const first = rows[0];
    const bytes = await buildTopicsDocx({
      meta: {
        department: first.department,
        area_of_interest: first.area_of_interest,
        country: first.country,
        research_type: first.research_type,
      },
      topics: rows.map((t: any) => ({
        title: t.title,
        problem_statement: t.problem_statement,
        research_gap: t.research_gap,
        objectives: t.objectives ?? [],
        novelty_score: t.novelty_score,
        feasibility_score: t.feasibility_score,
      })),
    });
    const filename =
      rows.length === 1
        ? `${rows[0].title.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 100)}.docx`
        : `topics-${rows.length}.docx`;
    return {
      base64: toBase64(bytes),
      filename,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  });
