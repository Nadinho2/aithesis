import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { fetchScholarlyRefs, formatAPA } from "./scholarly.server";
import { buildThesisDocx, toBase64 } from "./docx.server";
import { getUserEmail } from "./mail-helper";
import { checkGenerateLimit, incrementUsage } from "./admin-limits.functions";
import { enqueueJob } from "./queue";

const ManualTopic = z.object({
  title: z.string().min(5).max(300),
  problem_statement: z.string().min(20).max(4000),
  research_gap: z.string().min(10).max(2000),
  objectives: z.array(z.string().min(2).max(400)).min(1).max(10),
  department: z.string().max(120).optional().default(""),
  area_of_interest: z.string().max(200).optional().default(""),
  country: z.string().max(80).optional().default(""),
  research_type: z.string().max(80).optional().default(""),
});

const GenerateInput = z
  .object({
    topic_id: z.string().uuid().optional(),
    manual: ManualTopic.optional(),
    level: z.enum(["undergraduate", "masters", "phd"]).default("undergraduate"),
    target_words: z.number().int().min(6000).max(80000).default(8000),
    citation_style: z.enum(["apa_7", "harvard"]).default("apa_7"),
  })
  .refine((d) => d.topic_id || d.manual, { message: "topic_id or manual required" });

export const generateThesis = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Payment check — if user has any completed transaction for this thesis level, allow.
    const { count: txCount } = await (supabase as any)
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", "thesis")
      .eq("level", data.level);
    const isPaid = (txCount ?? 0) > 0;

    // Limit check (non-paid only)
    if (!isPaid) {
      const canGen = await checkGenerateLimit(supabase, userId, "thesis", data.level);
      if (!canGen) throw new Error("Generation limit reached. Upgrade your plan to continue.");
    }

    // Build topic context
    let topicCtx: any;
    if (data.topic_id) {
      const { data: topic, error } = await supabase
        .from("topics")
        .select("*")
        .eq("id", data.topic_id)
        .maybeSingle();
      if (error || !topic) throw new Error("Topic not found");
      topicCtx = {
        title: topic.title,
        problem_statement: topic.problem_statement,
        research_gap: topic.research_gap,
        objectives: topic.objectives ?? [],
        department: topic.department,
        area_of_interest: topic.area_of_interest,
        country: topic.country,
        research_type: topic.research_type,
        id: topic.id,
      };
    } else {
      const m = data.manual!;
      topicCtx = {
        title: m.title,
        problem_statement: m.problem_statement,
        research_gap: m.research_gap,
        objectives: m.objectives,
        department: m.department || null,
        area_of_interest: m.area_of_interest || null,
        country: m.country || null,
        research_type: m.research_type || null,
        id: null,
      };
    }

    // Fetch references
    const query = `${topicCtx.title} ${topicCtx.area_of_interest ?? ""}`.trim();
    const refs = await fetchScholarlyRefs(query, 8);
    if (refs.length === 0) throw new Error("No scholarly references could be retrieved.");

    // Processing started email
    const processingEmail = await getUserEmail(userId);
    if (processingEmail) {
      const { sendProcessingStartedEmail } = await import("./mail");
      sendProcessingStartedEmail({
        to: processingEmail,
        name: processingEmail.split("@")[0],
        tool: "Thesis",
      });
    }

    // Enqueue background job for queue worker
    await enqueueJob("thesis", {
      userId,
      data: {
        level: data.level,
        target_words: data.target_words,
        citation_style: data.citation_style,
        topicCtx,
        refs: refs.slice(0, 30),
        isPaid,
      },
    });

    // Trigger GitHub Actions worker (fire-and-forget)
    const ghPat = typeof process !== "undefined" ? process.env?.GH_PAT : undefined;
    if (ghPat) {
      fetch("https://api.github.com/repos/Nadinho2/aithesis/dispatches", {
        method: "POST",
        headers: { Authorization: `Bearer ${ghPat}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
        body: JSON.stringify({ event_type: "process-queue" }),
      }).catch(() => {});
    }

    // Increment usage
    if (!isPaid) {
      await incrementUsage(supabase, userId, "thesis", data.level);
    }

    return { success: true, message: "Your thesis is being generated. You'll receive an email when it's ready." };
  });

export const getThesis = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thesis } = await supabase
      .from("theses")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (!thesis) throw new Error("Thesis not found.");
    return { thesis };
  });

export const listTheses = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("theses")
      .select("id, title, level, word_count, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteThesis = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("theses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportThesisDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: thesis } = await supabase
      .from("theses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!thesis) throw new Error("Thesis not found.");

    const buffers = await buildThesisDocx(thesis as any);
    const base64 = await toBase64(buffers);
    return { base64, filename: `${thesis.title?.replace(/\s+/g, "_").slice(0, 60) ?? "thesis"}.docx` };
  });
