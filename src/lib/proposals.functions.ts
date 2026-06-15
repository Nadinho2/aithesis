import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { fetchScholarlyRefs, formatAPA, type ScholarlyRef } from "./scholarly.server";
import { buildProposalDocx, toBase64 } from "./docx.server";
import { scrubObject, countWordsDeep, trimToExactWords, callAI } from "./ai-utils.server";

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
    target_words: z.number().int().min(2500).max(3000).default(2800),
  })
  .refine((d) => d.topic_id || d.manual, { message: "topic_id or manual required" });

const SectionSchema = z.object({
  introduction: z.string(),
  background: z.string(),
  problem_statement: z.string(),
  research_questions: z.array(z.string()),
  objectives: z.array(z.string()),
  significance: z.string(),
  scope_and_limitations: z.string(),
  literature_review: z.string(),
  methodology: z.string(),
  expected_outcomes: z.string(),
  timeline: z.string().optional().default(""),
});

const ProposalSchema = z.object({
  abstract: z.string(),
  sections: SectionSchema,
});

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek AI is not configured.");

    // Payment check — proposals cost ₦3,000
    const { data: paidTx } = await (supabase as any)
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", "proposal")
      .limit(1);
    if (!paidTx?.length) throw new Error("Payment required. Please purchase a proposal credit before generating.");

    let topicCtx: {
      title: string;
      problem_statement: string;
      research_gap: string;
      objectives: string[];
      department?: string | null;
      area_of_interest?: string | null;
      country?: string | null;
      research_type?: string | null;
      id?: string | null;
    };

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

    const isUndergrad = data.level === "undergraduate";
    const target = data.target_words;

    const query = `${topicCtx.title} ${topicCtx.area_of_interest ?? ""}`.trim();
    const refs = await fetchScholarlyRefs(query, 6);
    if (refs.length === 0) {
      throw new Error("No scholarly references could be retrieved. Please try again.");
    }

    const refContext = refs
      .slice(0, 20)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.authors.slice(0, 3).join(", ")}${r.authors.length > 3 ? " et al." : ""} (${r.year ?? "n.d."}). "${r.title}". ${r.venue ?? r.source}. ${r.abstract ? "Abstract: " + r.abstract : ""}`,
      )
      .join("\n\n");

    const timelineRule = isUndergrad
      ? "DO NOT include a Timeline section. Return an empty string for the timeline field."
      : "Include a realistic Timeline section organised by months or quarters covering the full study.";

    const systemPrompt = `You are a senior academic writing a graduate-level research proposal. Your prose must read as authored by a human researcher, not an AI assistant.

OUTPUT FORMAT — STRICT:
- Plain text only. NEVER use markdown syntax. NO asterisks (* or **), NO underscores for emphasis, NO backticks, NO hashes (#) for headings, NO hyphen bullets at line starts.
- Do NOT bold, italicise, or otherwise emphasise words. Emphasis is conveyed through prose, not formatting marks.
- Separate paragraphs with a single blank line. Each paragraph should be 3–6 sentences; do NOT produce 500-word walls of text.
- Where a subheading is appropriate (e.g. "Significance to Policymakers", "Definition of Terms"), put the subheading on its OWN line with a blank line above and below it. Do not embed subheading labels inside paragraph prose.

WRITING RULES — absolute:
- Write entirely in your own words. NEVER copy phrasing from the reference abstracts.
- Vary sentence length naturally; mix concise sentences with longer analytical ones.
- Use specific, concrete details (numbers, methods, locations, examples) over generic statements.
- Avoid AI-detector flags: "in today's world", "delve into", "navigate the landscape", "it is important to note", "plays a pivotal/crucial role", "a testament to", "in the realm of", "ever-evolving", "tapestry", "myriad", "harness the power of", "unlock the potential", "furthermore it is worth noting".
- Do NOT begin sections with "In summary" or "In conclusion".
- Limit em-dashes to at most two per section.
- Even, scholarly third-person voice. Occasional "we propose" / "we expect" allowed only in methodology.

CITATION RULES — STRICT APA 7th EDITION:
- Use ONLY the provided references. Do NOT invent authors, years, journals, or DOIs.
- Inline: (Author, Year); (Author & Author, Year); (First et al., Year) for 3+.
- Synthesize at least 12 references across background and literature review — argue, compare, identify gaps; do not summarize one-by-one.
- Reference list is rendered programmatically, do not output a bibliography.

DOCUMENT REQUIREMENTS:
- TOTAL TARGET: EXACTLY ${target} words across all sections combined (abstract + every section).
- Distribute words deliberately. Literature review and background should be the longest.
- Methodology must specify: research design, population and sample, sampling technique, instruments, data collection, data analysis, validity/reliability, ethical considerations.
- ${timelineRule}

Return STRICT JSON matching this exact schema:

{
  "abstract": "full abstract text",
  "sections": {
    "introduction": "full introduction text",
    "background": "full background text",
    "problem_statement": "full problem statement text",
    "research_questions": ["RQ1", "RQ2"],
    "objectives": ["Obj1", "Obj2"],
    "significance": "full significance text",
    "scope_and_limitations": "full scope text",
    "literature_review": "full literature review text",
    "methodology": "full methodology text",
    "expected_outcomes": "full outcomes text",
    "timeline": "timeline text or empty string if undergraduate"
  }
}

No markdown, no commentary.`;

    const userPrompt = `RESEARCH TOPIC: ${topicCtx.title}

PROBLEM: ${topicCtx.problem_statement}
RESEARCH GAP: ${topicCtx.research_gap}
OBJECTIVES: ${topicCtx.objectives.join("; ")}
DEPARTMENT: ${topicCtx.department ?? ""}
CONTEXT/COUNTRY: ${topicCtx.country ?? "Not specified"}
RESEARCH TYPE: ${topicCtx.research_type ?? "Not specified"}
ACADEMIC LEVEL: ${data.level}

VERIFIED SCHOLARLY REFERENCES (cite these only):
${refContext}

Write the proposal now — TOTAL EXACTLY ${target} words.`;

    let parsed = ProposalSchema.parse(
      await callAI(apiKey, {
        model: "deepseek-v4-pro",
        system: systemPrompt,
        user: userPrompt,
      }),
    );

    // Undergraduate: drop timeline entirely
    if (isUndergrad) parsed.sections.timeline = "";

    parsed = scrubObject(parsed) as typeof parsed;

    // Word count enforcement — multi-pass expansion if under, then deterministic trim to EXACT.
    let total = countWordsDeep(parsed);
    let attempts = 0;
    while (total < target && attempts < 1) {
      attempts++;
      const diff = target - total;
      try {
        const refine = await callAI(apiKey, {
          model: "deepseek-v4-pro",
          system: systemPrompt,
          user: `Your previous draft was ${total} words. The target is EXACTLY ${target} words (currently SHORT by ${diff}).
Expand the proposal by adding approximately ${diff} more words of substantive analytical content distributed across literature_review, background, and methodology. Preserve all existing arguments, structure, and citations — add depth, do not pad with filler. Re-submit the COMPLETE updated proposal.

PREVIOUS DRAFT (JSON):
${JSON.stringify(parsed)}`,
        });
        const refined = ProposalSchema.parse(refine);
        if (isUndergrad) refined.sections.timeline = "";
        const scrubbed = scrubObject(refined) as typeof parsed;
        const newTotal = countWordsDeep(scrubbed);
        if (newTotal > total) {
          parsed = scrubbed;
          total = newTotal;
        } else {
          break; // no progress; stop looping
        }
      } catch {
        break;
      }
    }

    if (total > target) {
      parsed = trimProposalToExact(parsed, target);
      total = countWordsDeep(parsed);
    }

    const referencesList = refs.map((r) => ({ ...r, apa: formatAPA(r) }));

    const { data: created, error: insErr } = await supabase
      .from("proposals")
      .insert({
        user_id: userId,
        topic_id: topicCtx.id,
        title: topicCtx.title,
        level: data.level,
        department: topicCtx.department ?? null,
        area_of_interest: topicCtx.area_of_interest ?? null,
        country: topicCtx.country ?? null,
        research_type: topicCtx.research_type ?? null,
        abstract: parsed.abstract,
        sections: parsed.sections,
        references_list: referencesList,
        word_count: total,
        status: "draft",
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return { proposal: created };
  });

function trimProposalToExact(p: z.infer<typeof ProposalSchema>, target: number): z.infer<typeof ProposalSchema> {
  // Trim longest text sections first until total equals target.
  const cloned = JSON.parse(JSON.stringify(p)) as typeof p;
  let total = countWordsDeep(cloned);
  const trimOrder = [
    "timeline",
    "expected_outcomes",
    "scope_and_limitations",
    "significance",
    "background",
    "literature_review",
  ];
  for (const key of trimOrder) {
    if (total <= target) break;
    const v = (cloned.sections as any)[key];
    if (typeof v !== "string" || !v) continue;
    const words = v.trim().split(/\s+/);
    const excess = total - target;
    if (words.length > excess + 20) {
      (cloned.sections as any)[key] = trimToExactWords(v, words.length - excess);
      total = countWordsDeep(cloned);
    }
  }
  // Final hard trim of abstract if still over.
  if (total > target && cloned.abstract) {
    const abs = cloned.abstract.trim().split(/\s+/);
    const excess = total - target;
    cloned.abstract = trimToExactWords(cloned.abstract, Math.max(40, abs.length - excess));
  }
  return cloned;
}

export const getProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Proposal not found");
    return row;
  });

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("proposals")
      .select("id,title,level,word_count,created_at,topic_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportProposalDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Proposal not found");
    const bytes = await buildProposalDocx({
      title: row.title,
      level: row.level,
      department: row.department,
      area_of_interest: row.area_of_interest,
      country: row.country,
      abstract: row.abstract,
      word_count: row.word_count,
      sections: row.sections as any,
      references_list: (row.references_list as any) ?? [],
    });
    const filename = sanitizeFilename(`${row.title}-proposal.docx`);
    return { base64: toBase64(bytes), filename, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  });

export type ProposalReference = ScholarlyRef & { apa: string };

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 120);
}
