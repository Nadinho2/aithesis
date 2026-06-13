import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { fetchScholarlyRefs, formatAPA, type ScholarlyRef } from "./scholarly.server";
import { buildThesisDocx, toBase64 } from "./docx.server";
import { scrubAITells, scrubObject, countWords, countWordsDeep, trimToExactWords, callAI, callAIText } from "./ai-utils.server";

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
  .middleware([requireClerkAuth])
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

    const baseRules = `OUTPUT FORMAT — STRICT:
- Plain text only. NEVER use markdown syntax. NO asterisks (* or **), NO underscores for emphasis, NO backticks, NO hashes (#) for headings, NO hyphen bullets at line starts.
- Do NOT bold, italicise, or otherwise emphasise words.
- Separate paragraphs with a single blank line. Paragraphs should be 3–6 sentences.
- Put every subheading on its OWN line with a blank line above and below it.

ORIGINALITY & HUMAN-VOICE RULES (absolute):
- Compose entirely in your own words. NEVER copy any phrasing from the reference abstracts.
- Vary sentence length aggressively; mix short declarative sentences with longer analytical ones.
- Use concrete, specific details: actual numbers, named methods, locations, instruments, dates.
- Insert occasional hedged claims ("appears to", "suggests that", "remains contested").
- BANNED PHRASES: "in today's world", "delve into", "navigate the landscape", "it is important to note", "plays a pivotal/crucial/vital role", "a testament to", "in the realm of", "ever-evolving", "tapestry", "myriad", "harness the power of", "unlock the potential", "furthermore it is worth noting", "needless to say", "game-changer", "cutting-edge", "state-of-the-art", "paradigm shift", "dive deep into", "underscores the importance of".
- Do NOT begin any paragraph with "In summary", "In conclusion", "Furthermore," or "Moreover,".
- At most two em-dashes per chapter.

CITATION RULES — STRICT APA 7th EDITION:
- Use ONLY the provided references. NEVER invent authors, years, journals, or DOIs.
- Inline: (Author, Year); (Author & Author, Year); (First et al., Year) for 3+ authors.
- Reference list is rendered programmatically; do NOT output a bibliography.

TABLES & FIGURES:
When you present tabular data, embed it as:
[TABLE: Table X: Caption]
| Header 1 | Header 2 | Header 3 |
| Cell 1,1 | Cell 1,2 | Cell 1,3 |
| Cell 2,1 | Cell 2,2 | Cell 2,3 |

Each table starts with [TABLE: caption] on its own line, has pipe-delimited rows, and closes with ] on its own line after all rows.

For figures:
[FIGURE: Figure X: Caption]
Prose describing the figure, key values, and trends.

Place tables ONLY in Chapter 4 (Results) and Chapter 3 (Methodology). At most 3 tables and 2 figures total.

Output the chapter text as plain text — NOT wrapped in any format like JSON or markdown.`;

    const topicContext = `RESEARCH TOPIC: ${topicCtx.title}
PROBLEM: ${topicCtx.problem_statement}
RESEARCH GAP: ${topicCtx.research_gap}
OBJECTIVES: ${topicCtx.objectives.join("; ")}
DEPARTMENT: ${topicCtx.department ?? ""}
CONTEXT/COUNTRY: ${topicCtx.country ?? "Not specified"}
RESEARCH TYPE: ${topicCtx.research_type ?? "Not specified"}
ACADEMIC LEVEL: ${data.level}

VERIFIED SCHOLARLY REFERENCES (cite these only):
${refContext}`;

    const chapterDefs: { key: string; label: string; instructions: string; target: number }[] = [
      { key: "chapter_1_introduction", label: "Chapter 1: Introduction", instructions: "Background to the study, statement of the problem, research questions, objectives, scope and delimitations, significance, and definition of terms.", target: chapterTargets.chapter_1_introduction },
      { key: "chapter_2_literature_review", label: "Chapter 2: Literature Review", instructions: "Thematic synthesis of related literature, theoretical/conceptual framework, and identification of the research gap. Synthesise at least 8 references, arguing themes rather than summarising one-by-one.", target: chapterTargets.chapter_2_literature_review },
      { key: "chapter_3_methodology", label: "Chapter 3: Methodology", instructions: "Research design, population and sample, sampling technique, instruments, data collection procedure, data analysis techniques, validity/reliability, and ethical considerations.", target: chapterTargets.chapter_3_methodology },
      { key: "chapter_4_results_findings", label: "Chapter 4: Results / Findings", instructions: "Presented as if data were collected. Include realistic-sounding tables described in prose, descriptive and inferential analysis results.", target: chapterTargets.chapter_4_results_findings },
      { key: "chapter_5_discussion_conclusion", label: "Chapter 5: Discussion, Conclusion & Recommendations", instructions: "Interpret findings against literature, implications, limitations, recommendations, and suggestions for further research.", target: chapterTargets.chapter_5_discussion_conclusion },
    ];

    // Generate abstract and all 5 chapters in parallel.
    const genChapter = async (key: string, label: string, instructions: string, wordTarget: number) => {
      const systemPrompt = `You are a senior academic writing ${label} of a ${data.level} thesis.

${baseRules}

Write exactly one chapter: ${label}. ${instructions}
Target: EXACTLY ${wordTarget} words.
Use sub-headings (e.g. "1.1 Background to the Study", "3.2 Population and Sample") on their own lines.

Output the chapter text directly as plain text — NOT wrapped in JSON.`;
      const userPrompt = `${topicContext}

Write ${label} now — EXACTLY ${wordTarget} words.`;
      const content = await callAIText(apiKey, { model: "deepseek-v4-flash", system: systemPrompt, user: userPrompt });
      return { key, content };
    };

    const genAbstract = async () => {
      const systemPrompt = `You are a senior academic writing the abstract of a ${data.level} thesis.

${baseRules}

Write the abstract. Target: EXACTLY ${abstractTarget} words.
Do NOT use sub-headings. The abstract is a single continuous paragraph.

Output the abstract text directly as plain text — NOT wrapped in JSON.`;
      const userPrompt = `${topicContext}

Write the abstract now — EXACTLY ${abstractTarget} words.`;
      return await callAIText(apiKey, { model: "deepseek-v4-flash", system: systemPrompt, user: userPrompt });
    };

    const [abstractResult, ...chapterResults] = await Promise.all([
      genAbstract(),
      ...chapterDefs.map((c) => genChapter(c.key, c.label, c.instructions, c.target)),
    ]);

    const abstract = abstractResult;
    const chapters: Record<string, string> = {};
    let total = 0;
    for (const cr of chapterResults) {
      chapters[cr.key] = cr.content;
      total += countWords(cr.content);
    }
    total += countWords(abstract);

    let parsed: z.infer<typeof ThesisSchema> = { abstract, chapters } as any;
    parsed = scrubObject(parsed) as typeof parsed;

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
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.from("theses").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Thesis not found");
    return row;
  });

export const listTheses = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
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
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("theses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportThesisDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
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
