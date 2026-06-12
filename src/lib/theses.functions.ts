import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchScholarlyRefs, formatAPA, type ScholarlyRef } from "./scholarly.server";
import { buildThesisDocx, toBase64 } from "./docx.server";
import { scrubAITells, scrubObject, countWords, countWordsDeep, trimToExactWords, callAI } from "./ai-utils.server";

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
    target_words: z.number().int().min(6000).max(15000).default(8000),
  })
  .refine((d) => d.topic_id || d.manual, { message: "topic_id or manual required" });

const ChapterSchema = z.object({
  chapter_1_introduction: z.string(),
  chapter_2_literature_review: z.string(),
  chapter_3_methodology: z.string(),
  chapter_4_results_findings: z.string(),
  chapter_5_discussion_conclusion: z.string(),
});

const ThesisSchema = z.object({
  abstract: z.string(),
  chapters: ChapterSchema,
});

export const generateThesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek AI is not configured.");

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

    const target = data.target_words;
    const query = `${topicCtx.title} ${topicCtx.area_of_interest ?? ""}`.trim();
    const refs = await fetchScholarlyRefs(query, 8);
    if (refs.length === 0) throw new Error("No scholarly references could be retrieved. Please try again.");

    const refContext = refs
      .slice(0, 30)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.authors.slice(0, 3).join(", ")}${r.authors.length > 3 ? " et al." : ""} (${r.year ?? "n.d."}). "${r.title}". ${r.venue ?? r.source}. ${r.abstract ? "Abstract: " + r.abstract : ""}`,
      )
      .join("\n\n");

    // Distribute target words across chapters
    const abstractTarget = Math.round(target * 0.04); // ~4%
    const chapterTargets = {
      chapter_1_introduction: Math.round(target * 0.15),
      chapter_2_literature_review: Math.round(target * 0.32),
      chapter_3_methodology: Math.round(target * 0.18),
      chapter_4_results_findings: Math.round(target * 0.20),
      chapter_5_discussion_conclusion: Math.round(target * 0.15),
    };

    const systemPrompt = `You are a senior academic writing a full ${data.level} thesis. Every word must read as authored by a human researcher and must pass plagiarism and AI-detection screening.

OUTPUT FORMAT — STRICT:
- Plain text only. NEVER use markdown syntax. NO asterisks (* or **), NO underscores for emphasis, NO backticks, NO hashes (#) for headings, NO hyphen bullets at line starts.
- Do NOT bold, italicise, or otherwise emphasise words. Emphasis is conveyed through prose, not formatting marks.
- Separate paragraphs with a single blank line. Paragraphs should be 3–6 sentences; do NOT produce 800-word walls of text.
- Put every subheading (e.g. "1.1 Background to the Study", "3.2 Population and Sample", "Definition of Terms") on its OWN line with a blank line above and below it. Do not embed subheading labels inside paragraph prose.

ORIGINALITY & HUMAN-VOICE RULES (absolute):
- Compose entirely in your own words. NEVER copy any phrasing from the reference abstracts.
- Vary sentence length aggressively; mix short declarative sentences with longer analytical ones.
- Use concrete, specific details: actual numbers, named methods, locations, instruments, dates.
- Insert occasional hedged claims ("appears to", "suggests that", "remains contested") rather than absolute pronouncements.
- BANNED PHRASES (do not use any of these): "in today's world", "delve into", "navigate the landscape", "it is important to note", "plays a pivotal/crucial/vital role", "a testament to", "in the realm of", "ever-evolving", "tapestry", "myriad", "harness the power of", "unlock the potential", "furthermore it is worth noting", "needless to say", "at the end of the day", "game-changer", "cutting-edge", "state-of-the-art", "paradigm shift", "dive deep into", "underscores the importance of".
- Do NOT begin any paragraph with "In summary", "In conclusion", "Furthermore," or "Moreover,".
- At most two em-dashes per chapter.

CITATION RULES — STRICT APA 7th EDITION:
- Use ONLY the provided references. NEVER invent authors, years, journals, or DOIs.
- Inline: (Author, Year); (Author & Author, Year); (First et al., Year) for 3+ authors.
- Across the thesis, synthesise at least 20 references; argue, compare, and identify gaps — never summarise sources sequentially.
- Reference list is rendered programmatically; do NOT output a bibliography.

STRUCTURE (5 chapters):
- Chapter 1: Introduction (background, problem statement, research questions, objectives, scope, significance, definitions) — target ${chapterTargets.chapter_1_introduction} words.
- Chapter 2: Literature Review (thematic synthesis, theoretical framework, gap identification) — target ${chapterTargets.chapter_2_literature_review} words.
- Chapter 3: Methodology (research design, population/sample, sampling technique, instruments, data collection procedure, data analysis techniques, validity/reliability, ethics) — target ${chapterTargets.chapter_3_methodology} words.
- Chapter 4: Results / Findings (presented as if data were collected; include realistic-sounding tables described in prose, descriptive and inferential analysis results) — target ${chapterTargets.chapter_4_results_findings} words.
- Chapter 5: Discussion, Conclusion & Recommendations (interpret findings against literature, implications, limitations, recommendations, suggestions for further research) — target ${chapterTargets.chapter_5_discussion_conclusion} words.
- Abstract: ~${abstractTarget} words.

TOTAL TARGET: EXACTLY ${target} words across abstract + all five chapters.

Use clear sub-headings inside each chapter (e.g. "1.1 Background to the Study", "1.2 Statement of the Problem") rendered as plain text lines.

Return STRICT JSON matching this exact schema:

{
  "abstract": "full abstract text",
  "chapters": {
    "chapter_1_introduction": "full chapter 1 text",
    "chapter_2_literature_review": "full chapter 2 text",
    "chapter_3_methodology": "full chapter 3 text",
    "chapter_4_results_findings": "full chapter 4 text",
    "chapter_5_discussion_conclusion": "full chapter 5 text"
  }
}`;

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

Write the complete five-chapter thesis now — TOTAL EXACTLY ${target} words.`;

    let parsed = ThesisSchema.parse(
      await callAI(apiKey, {
        model: "deepseek-v4-pro",
        system: systemPrompt,
        user: userPrompt,
      }),
    );
    parsed = scrubObject(parsed) as typeof parsed;

    // Multi-pass exact word enforcement.
    let total = countWordsDeep(parsed);
    let attempts = 0;
    while (total < target && attempts < 3) {
      attempts++;
      const diff = target - total;
      const shortfalls: string[] = [];
      const targets = chapterTargets as Record<string, number>;
      for (const [k, t] of Object.entries(targets)) {
        const actual = countWords((parsed.chapters as any)[k]);
        if (actual < t) shortfalls.push(`${k}: have ${actual}, need ${t}`);
      }
      try {
        const refine = await callAI(apiKey, {
          model: "deepseek-v4-pro",
          system: systemPrompt,
          user: `Your draft is ${total} words. Target is EXACTLY ${target} (SHORT by ${diff}).
Expand under-length chapters with additional substantive content (extra paragraphs of analysis, more synthesised citations, more concrete methodological/empirical detail). Keep all existing arguments and citations; add depth, do not pad. Re-submit the COMPLETE thesis.

UNDER-LENGTH CHAPTERS:
${shortfalls.join("\n") || "(distribute additions across chapter 2 and chapter 4)"}

PREVIOUS DRAFT:
${JSON.stringify(parsed)}`,
        });
        const refined = ThesisSchema.parse(refine);
        const scrubbed = scrubObject(refined) as typeof parsed;
        const newTotal = countWordsDeep(scrubbed);
        if (newTotal > total) {
          parsed = scrubbed;
          total = newTotal;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    if (total > target) {
      parsed = trimThesisToExact(parsed, target);
      total = countWordsDeep(parsed);
    }

    const referencesList = refs.map((r) => ({ ...r, apa: formatAPA(r) }));

    const { data: created, error: insErr } = await supabase
      .from("theses")
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
        chapters: parsed.chapters,
        references_list: referencesList,
        word_count: total,
        target_words: target,
        status: "draft",
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return { thesis: created };
  });

function trimThesisToExact(t: z.infer<typeof ThesisSchema>, target: number): z.infer<typeof ThesisSchema> {
  const cloned = JSON.parse(JSON.stringify(t)) as typeof t;
  let total = countWordsDeep(cloned);
  const order = [
    "chapter_5_discussion_conclusion",
    "chapter_4_results_findings",
    "chapter_2_literature_review",
    "chapter_1_introduction",
    "chapter_3_methodology",
  ];
  for (const k of order) {
    if (total <= target) break;
    const v = (cloned.chapters as any)[k];
    if (typeof v !== "string" || !v) continue;
    const words = v.trim().split(/\s+/);
    const excess = total - target;
    if (words.length > excess + 80) {
      (cloned.chapters as any)[k] = trimToExactWords(v, words.length - excess);
      total = countWordsDeep(cloned);
    }
  }
  if (total > target && cloned.abstract) {
    const abs = cloned.abstract.trim().split(/\s+/);
    const excess = total - target;
    cloned.abstract = trimToExactWords(cloned.abstract, Math.max(60, abs.length - excess));
  }
  return cloned;
}

export const getThesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.from("theses").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Thesis not found");
    return row;
  });

export const listTheses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("theses")
      .select("id,title,level,word_count,target_words,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteThesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("theses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportThesisDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.from("theses").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Thesis not found");
    const bytes = await buildThesisDocx({
      title: row.title,
      level: row.level,
      department: row.department,
      area_of_interest: row.area_of_interest,
      country: row.country,
      abstract: row.abstract,
      word_count: row.word_count,
      chapters: row.chapters as any,
      references_list: (row.references_list as any) ?? [],
    });
    const filename = sanitize(`${row.title}-thesis.docx`);
    return { base64: toBase64(bytes), filename, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  });

export type ThesisReference = ScholarlyRef & { apa: string };

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 120);
}
