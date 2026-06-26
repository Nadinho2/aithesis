/**
 * Sequential thesis chapter generation pipeline.
 *
 * Generates chapters one at a time, passing a running context summary
 * from all previously generated chapters to each new chapter call.
 * This prevents AI hallucination and incoherence after Chapter 3 by
 * ensuring every chapter knows what was established earlier.
 */
import { callAIText } from "@/lib/ai-utils.server";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChapterDef {
  key: string;
  label: string;
  order: number;
  target: number;
  subSections: string[];
  instructions?: string;
}

export interface GeneratedChapter {
  key: string;
  chapterTitle: string;
  order: number;
  content: string;
}

export interface PipelinePayload {
  topic: string;
  documentTitle: string;
  level: "undergraduate" | "masters" | "phd";
  citationStyle: "apa_7" | "harvard";
  topicContext: string;
  activeChapters: ChapterDef[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const thesisLevelLabel = (level: string): string =>
  level === "undergraduate" ? "Undergraduate" : level === "masters" ? "Master's" : "PhD";

const citationLabel = (style: string): string =>
  style === "harvard" ? "Harvard" : "APA 7th";

const baseRules = `Write natural academic English as a human researcher would. Vary sentence length and structure.
RULES:
- Never use phrases like "This chapter explores", "It is noteworthy", "In conclusion, it can be said", "This study aims to", "The following", "It is important to note".
- Use only 1-2 key citations per section — focus on depth, not quantity.
- Never invent citations.
- Write in clear paragraphs, not bullet points.
- For numbers above 999, use commas (1,500 not 1500).
- For equations, use plain text like: Mean = Σx/n, SD = √[Σ(x-x̄)²/(n-1)], t = (x̄₁-x̄₂)/SE, χ² = Σ(O-E)²/E, F = MSB/MSW, r = 0.76.`;

/**
 * Build the system prompt for a specific chapter.
 */
function buildSystemPrompt(payload: PipelinePayload, chapter: ChapterDef): string {
  const level = thesisLevelLabel(payload.level);
  const cite = citationLabel(payload.citationStyle);

  return `You are an experienced Nigerian academic writing a completed research thesis at ${level} level. Write ${chapter.label} for a study titled '${payload.documentTitle}' on '${payload.topic}' conducted at a Nigerian university.

CRITICAL RULES FOR THESIS:
- Use past tense for methodology and findings: 'this study examined', 'data was collected', 'the researcher found'
- Use present tense for literature review and established facts: 'communication is', 'scholars argue'
- Write approximately ${chapter.target} words
- Use ${cite} referencing style
- Include in-text citations: (Surname, Year)
- Sub-sections required in order: ${chapter.subSections.join(", ")}
- Output the chapter text only — no markdown, no headers, no preamble, no conclusion summary at the end

${chapter.instructions ?? ""}

${baseRules}`;
}

/**
 * Build the previous-chapters context block to append to the system prompt.
 */
export function buildPreviousContext(generatedChapters: GeneratedChapter[], payload: PipelinePayload): string {
  if (generatedChapters.length === 0) return "";

  const summaries = generatedChapters
    .map(
      (c) => `
${c.chapterTitle}:
- Topic established: ${payload.topic}
- Title: ${payload.documentTitle}
- Key content summary: ${c.content.slice(0, 800)}...`
    )
    .join("\n");

  return `

CONTEXT FROM PREVIOUSLY GENERATED CHAPTERS:
${summaries}

You must remain 100% consistent with everything established in the chapters above. Do not introduce new variables, new population figures, new study locations, or new research instruments that were not mentioned in Chapter One or Chapter Three.`;
}

/**
 * Build chapter-specific rules block for Chapter 4.
 */
export function buildChapterFourRules(): string {
  return `

CHAPTER FOUR SPECIFIC RULES:

This chapter presents and analyses data based EXACTLY on:
- The research questions stated in Chapter One
- The hypotheses stated in Chapter One
- The methodology described in Chapter Three
- The sample size calculated in Chapter Three

DATA TABLES:
Where data is presented in tabular form, format every table using this exact markdown structure:

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

Every table must have:
- A table number and title above it: 'Table 4.1: Distribution of Respondents by Gender'
- A clear header row
- Consistent column alignment
- A brief interpretation paragraph immediately after each table

HYPOTHESES TESTING:
For each hypothesis, follow this format exactly:
- State the null hypothesis (H01, H02 etc.)
- State the statistical test used (as specified in Chapter Three)
- Present the result in a table
- State the decision: 'Since the p-value of X is less/greater than 0.05, the null hypothesis is rejected/accepted'

NUMBERS:
- Use the exact sample size from Chapter Three consistently
- Do not introduce new variables not in Chapter One
- Percentage calculations must add up to 100%
- All figures must be plausible and internally consistent`;
}

/**
 * Build chapter-specific rules block for Chapter 5.
 */
export function buildChapterFiveRules(): string {
  return `

CHAPTER FIVE SPECIFIC RULES:

This chapter draws conclusions ONLY from what was found in Chapter Four. Do not introduce new information.

- Summary of Findings must list each finding as a numbered point corresponding to each research question
- Conclusion must flow directly from the findings — do not restate the background or problem
- Recommendations must be specific and actionable, linked to each finding
- Do not use phrases like 'this study has shown that communication is important' — be specific: 'This study found that internal communication accounted for 55% variance in employee job satisfaction (r=0.68, p<0.05), suggesting that...'
- Contributions to Knowledge (if in sections) must state what this study adds that existing literature did not cover`;
}

// ─── Main Generation Pipeline ─────────────────────────────────────────────

/**
 * Generate thesis chapters sequentially, passing context from all previously
 * generated chapters to each new chapter.  This eliminates AI hallucination
 * and incoherence after Chapter 3.
 *
 * @param payload     Pipeline payload with topic context and chapter definitions
 * @param apiKey      DeepSeek API key
 * @returns           Array of GeneratedChapter objects
 */
export async function generateChapters(
  payload: PipelinePayload,
  apiKey: string
): Promise<GeneratedChapter[]> {
  const generatedChapters: GeneratedChapter[] = [];

  for (let i = 0; i < payload.activeChapters.length; i++) {
    const chapter = payload.activeChapters[i];
    try {
      // Build the base system prompt for this chapter
      let systemPrompt = buildSystemPrompt(payload, chapter);

      // Append context from all previously generated chapters
      systemPrompt += buildPreviousContext(generatedChapters, payload);

      // Append chapter-specific rules
      if (chapter.order === 4) {
        systemPrompt += buildChapterFourRules();
      } else if (chapter.order === 5) {
        systemPrompt += buildChapterFiveRules();
      }

      const subSectionList = chapter.subSections.join(", ");
      const userMessage = `${payload.topicContext}\n\nWrite ${chapter.label} now — approximately ${chapter.target} words. Follow the numbered sub-section structure exactly: ${subSectionList}`;

      const content = await callAIText(apiKey, {
        model: "deepseek-chat",
        max_tokens: 64000,
        system: systemPrompt,
        user: userMessage,
      });

      generatedChapters.push({
        key: chapter.key,
        chapterTitle: chapter.label,
        order: chapter.order,
        content,
      });

      // 500ms delay between chapter calls to avoid rate limits
      if (i < payload.activeChapters.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (e) {
      console.error(`[pipeline] Failed to generate ${chapter.label}:`, e);
      generatedChapters.push({
        key: chapter.key,
        chapterTitle: chapter.label,
        order: chapter.order,
        content: "",
      });
    }
  }

  return generatedChapters;
}
