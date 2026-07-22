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
  documentType?: string;
  academicLevel?: string;
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

const mathKeywords = [
  "math", "mathematics", "statistics", "probability",
  "calculus", "algebra", "binomial", "distribution",
  "integration", "differentiation", "matrix", "vector",
  "regression", "hypothesis", "variance", "standard deviation",
  "normal distribution", "poisson", "correlation", "geometry",
  "trigonometry", "logarithm", "sequence", "series",
];

const scienceKeywords = [
  "physics", "chemistry", "biology", "biochemistry",
  "microbiology", "organic", "inorganic", "thermodynamics",
  "mechanics", "genetics", "ecology", "anatomy",
];

const codeKeywords = [
  "programming", "algorithm", "code", "software",
  "database", "python", "java", "javascript", "c++",
  "data structure", "network", "operating system",
];

/**
 * Classify a topic into a subject category for assignment generation.
 */
function detectSubjectCategory(topic: string): string {
  const lower = topic.toLowerCase();
  if (mathKeywords.some((kw) => lower.includes(kw))) return "mathematics";
  if (scienceKeywords.some((kw) => lower.includes(kw))) return "science";
  if (codeKeywords.some((kw) => lower.includes(kw))) return "technical";
  return "humanities";
}

/**
 * Build the system prompt for a specific chapter.
 */
function buildSystemPrompt(payload: PipelinePayload, chapter: ChapterDef): string {
  const level = thesisLevelLabel(payload.level);
  const cite = citationLabel(payload.citationStyle);

  // Subject-aware assignment prompts
  if (payload.documentType === "assignment") {
    const category = detectSubjectCategory(payload.topic);
    const academicLevel = payload.academicLevel
      ? (payload.academicLevel === "masters" ? "Master's" : payload.academicLevel === "phd" ? "PhD" : "Undergraduate")
      : level;

    switch (category) {
      case "mathematics":
        return `You are an expert Nigerian university mathematics lecturer writing a model answer for a ${academicLevel} level assignment.

THE QUESTION IS: ${payload.topic}

CRITICAL RULES — MATHEMATICS FORMAT:
- Begin by clearly restating each part of the question (a), (b), (c), (d) as a sub-heading
- For EACH part, follow this exact structure:

  GIVEN:
  State all given values clearly (e.g. n = 20, p = 0.05, q = 0.95)

  FORMULA:
  Write the full formula to be applied, clearly stated in words and mathematical notation:
  e.g. P(X = r) = C(n,r) × p^r × q^(n-r)

  SUBSTITUTION:
  Show every substitution step explicitly — do not skip steps:
  e.g. P(X = 3) = C(20,3) × (0.05)^3 × (0.95)^17

  CALCULATION:
  Show each arithmetic step. Calculate C(n,r), powers, and products separately before combining:
  e.g. C(20,3) = 20! / (3! × 17!) = 1140
       (0.05)^3 = 0.000125
       (0.95)^17 = 0.4181
       P(X = 3) = 1140 × 0.000125 × 0.4181 = 0.0596

  ANSWER:
  State the final answer clearly and in context:
  e.g. Therefore, the probability that exactly 3 bulbs are defective is 0.0596 or approximately 5.96%

- All numerical answers must be accurate to 4 decimal places
- For cumulative probabilities, show each individual probability first then sum them
- For mean and standard deviation: show formula then calculation then answer
- For applied/interpretation questions (part d type): state the numerical answer first, then give a practical recommendation in 2-3 sentences
- Do not write an abstract, introduction, or literature review
- Do not use markdown bold (**) or italic (*) syntax — write plain text only, use CAPS for emphasis where needed
- Output the full worked solution only — no preamble`;

      case "science":
        return `You are an expert Nigerian university science lecturer writing a model answer for a ${academicLevel} level assignment.

THE QUESTION IS: ${payload.topic}

CRITICAL RULES — SCIENCE FORMAT:
- Restate each question part as a clear sub-heading
- Show all formulae before substituting values
- Include units in every calculation and final answer
- Diagrams: describe them in text e.g. '[DIAGRAM: Label the parts of a cell here]'
- Show balanced equations for chemistry questions
- State laws or principles being applied before using them
- Final answers must be clearly labelled and boxed in text: e.g. ANSWER: Velocity = 25 m/s
- Do not write an abstract or literature review
- Do not use markdown syntax — plain text only
- Output the full worked solution only — no preamble`;

      case "technical":
        return `You are an expert Nigerian university computer science lecturer writing a model answer for a ${academicLevel} level assignment.

THE QUESTION IS: ${payload.topic}

CRITICAL RULES — TECHNICAL FORMAT:
- Restate each question part as a clear sub-heading
- For algorithm questions: write step-by-step pseudocode first, then explain each step in plain English
- For code questions: write clean, commented code with explanation of logic below it
- For theory questions: define terms first, then explain, then give a real-world example
- For database questions: write SQL queries with explanation of each clause
- Do not use markdown bold (**) — plain text only (code blocks are acceptable)
- Output the full answer only — no preamble`;

      case "humanities":
      default:
        break; // fall through to default thesis-style prompt
    }
  }

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
Where data is presented in tabular form, format every table using this exact structure:

[TABLE: Table 4.1 Distribution of Respondents by Gender]
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

CRITICAL: Every table MUST start with a [TABLE: Title] tag on its own line. The table rows follow immediately after on separate lines. No extra text between the tag line and the table. A brief interpretation paragraph MUST follow each table.

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
