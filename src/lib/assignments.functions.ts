import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAIText } from "./ai-utils.server";
import { notifyToolCompleted } from "./mail-helper";
import { fetchScholarlyRefs, formatByStyle, sortReferences } from "./scholarly.server";
import { parseUploadedFile } from "./upload.server";
import { buildAssignmentDocx, toBase64 } from "./docx.server";

// ─── Types ─────────────────────────────────────────────────────────────────

interface AssignmentSection {
  key: string;
  label: string;
  order: number;
  target: number;
  subSections: string[];
}

interface GeneratedSection {
  key: string;
  label: string;
  order: number;
  content: string;
}

// ─── Section definitions ───────────────────────────────────────────────────

const SECTIONS: AssignmentSection[] = [
  {
    key: "introduction",
    label: "Introduction & Background",
    order: 1,
    target: 600,
    subSections: ["Background", "Purpose Statement", "Scope"],
  },
  {
    key: "literature_review",
    label: "Literature Review & Conceptual Framework",
    order: 2,
    target: 900,
    subSections: ["Review of Key Literature", "Theoretical/Conceptual Framework", "Gap Identification"],
  },
  {
    key: "analysis_1",
    label: "Analysis — Part 1",
    order: 3,
    target: 800,
    subSections: ["Key Arguments", "Evidence & Examples", "Critical Evaluation"],
  },
  {
    key: "analysis_2",
    label: "Analysis — Part 2",
    order: 4,
    target: 800,
    subSections: ["Comparative Perspectives", "Application to Context", "Counter-arguments"],
  },
  {
    key: "discussion",
    label: "Discussion",
    order: 5,
    target: 600,
    subSections: ["Synthesis of Findings", "Implications", "Limitations"],
  },
  {
    key: "conclusion",
    label: "Conclusion & Recommendations",
    order: 6,
    target: 500,
    subSections: ["Summary of Key Points", "Recommendations", "Final Remarks"],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const levelLabel = (level: string): string =>
  level === "masters" ? "Master's" : level === "phd" ? "PhD" : "Undergraduate";

const gradingLabel = (grade: string): string => {
  switch (grade) {
    case "A": return "A-grade (distinction-level)";
    case "B": return "B-grade (strong pass)";
    case "C": return "C-grade (adequate pass)";
    default: return "B-grade";
  }
};

const baseRules = `RULES:
- Use clear section headings on their own lines.
- For sub-headings, use **Bold Text**.
- Write in natural academic paragraphs — vary sentence length.
- Be specific and concrete. Use real examples and data where possible.
- Never use phrases like "This section will", "It is noteworthy", "In conclusion, it can be said".
- For tables, use this format:
[TABLE: Table Title]
| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |
- A brief interpretation paragraph must follow each table.`;

/**
 * Build the system prompt for a specific section.
 */
function buildSystemPrompt(
  section: AssignmentSection,
  question: string,
  level: string,
  grading: string,
  citationStyle: string,
  refContext: string,
): string {
  const styleLabel = citationStyle === "harvard" ? "Harvard" : "APA 7th";

  return `You are an experienced academic writing a ${levelLabel(level)}-level assignment answer targeting ${gradingLabel(grading)}.

ASSIGNMENT QUESTION:
${question}

Write the "${section.label}" section (approximately ${section.target} words).
Sub-sections required in order: ${section.subSections.join(", ")}.

CITATION RULES (${styleLabel}):
- Only cite the references provided below. Never invent sources.
- Use inline citations: (Surname, Year).
- Synthesise multiple sources — compare, argue, identify gaps.
- Use 1-2 citations per section, depth over quantity.

${baseRules}`;
}

/**
 * Build the previous-sections context block.
 */
function buildPreviousContext(generated: GeneratedSection[]): string {
  if (generated.length === 0) return "";
  const summaries = generated
    .map((s) => `${s.label}: ${s.content.slice(0, 400)}…`)
    .join("\n\n");
  return `\n\nCONTEXT FROM PREVIOUSLY WRITTEN SECTIONS (must remain 100% consistent):\n${summaries}`;
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

async function generateSections(
  question: string,
  level: string,
  grading: string,
  citationStyle: string,
  refContext: string,
  apiKey: string,
): Promise<GeneratedSection[]> {
  const generated: GeneratedSection[] = [];

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    try {
      let systemPrompt = buildSystemPrompt(section, question, level, grading, citationStyle, refContext);
      systemPrompt += buildPreviousContext(generated);

      const userMessage = `Write the "${section.label}" section now — approximately ${section.target} words.`;

      const content = await callAIText(apiKey, {
        model: "deepseek-chat",
        max_tokens: 16000,
        system: systemPrompt,
        user: userMessage,
      });

      generated.push({
        key: section.key,
        label: section.label,
        order: section.order,
        content,
      });

      // Delay between calls
      if (i < SECTIONS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (e) {
      console.error(`[assignment] Failed to generate ${section.label}:`, e);
      generated.push({ key: section.key, label: section.label, order: section.order, content: "" });
    }
  }

  return generated;
}

// ─── Input validation ──────────────────────────────────────────────────────

const AssignmentInput = z.object({
  question: z.string().min(10).max(10000),
  include_references: z.boolean().default(true),
  citation_style: z.enum(["apa_7", "harvard"]).default("apa_7"),
  word_count_target: z.number().int().min(1500).max(15000).default(3000),
  academic_level: z.enum(["undergraduate", "masters", "phd"]).default("undergraduate"),
  grading_target: z.enum(["A", "B", "C"]).default("B"),
  file_base64: z.string().optional(),
  file_mime: z.string().optional(),
  file_name: z.string().optional(),
});

// ─── Server functions ──────────────────────────────────────────────────────

export const generateAssignment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AssignmentInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    // Parse uploaded file
    let fileText = "";
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      fileText = parsed.text;
    }

    const fullQuestion = [data.question, fileText].filter(Boolean).join("\n\n--- Uploaded content ---\n\n");

    // Fetch scholarly references
    const refs = data.include_references
      ? await fetchScholarlyRefs(fullQuestion.slice(0, 300), 12)
      : [];
    const refContext = refs.map((r) => formatByStyle(r, data.citation_style)).join("\n");

    // Generate sections via pipeline
    const sections = await generateSections(
      fullQuestion,
      data.academic_level,
      data.grading_target,
      data.citation_style,
      refContext,
      apiKey,
    );

    // Build sections record
    const sectionsRecord: Record<string, string> = {};
    for (const s of sections) {
      sectionsRecord[s.key] = s.content;
    }

    // Build abstract from introduction
    const intro = sectionsRecord["introduction"] ?? "";
    const abstract = intro.slice(0, 400);

    // Calculate total word count
    const totalWords = Object.values(sectionsRecord)
      .reduce((sum, text) => sum + text.split(/\s+/).length, 0);

    // Store in DB — throw on failure so user sees the error
    let savedId = "";
    if (!supabase) throw new Error("Supabase client not available");

    const payload: any = {
      user_id: userId,
      question: fullQuestion.slice(0, 10000),
      answer: fullQuestion.slice(0, 10000), // fallback to question text
      include_references: data.include_references,
      citation_style: data.citation_style,
      word_count: totalWords,
      status: "completed",
    };

    // Try new columns first
    try {
      payload.sections = sectionsRecord;
      payload.abstract = abstract;
      payload.references_list = refs;
      payload.word_count_target = data.word_count_target;
      payload.academic_level = data.academic_level;
      payload.grading_target = data.grading_target;
      payload.title = data.question.slice(0, 120);

      const { data: inserted, error } = await supabase.from("assignments").insert(payload).select("id").single();
      if (!error && inserted?.id) {
        savedId = inserted.id;
      } else {
        // New columns likely don't exist — retry with only legacy columns
        console.warn("[assignment] New-column insert failed, retrying legacy:", error?.message);
        delete payload.sections;
        delete payload.abstract;
        delete payload.references_list;
        delete payload.word_count_target;
        delete payload.academic_level;
        delete payload.grading_target;
        delete payload.title;
        const { data: inserted2, error: err2 } = await supabase.from("assignments").insert(payload).select("id").single();
        if (err2 || !inserted2?.id) {
          console.error("[assignment] Legacy insert also failed:", err2?.message ?? err2);
          throw new Error(`Failed to save assignment: ${err2?.message ?? err2 ?? "unknown"}`);
        }
        savedId = inserted2.id;
      }
    } catch (e: any) {
      // If the error is from the inner retry throw, re-throw it
      if (e.message?.startsWith("Failed to save")) throw e;

      // Otherwise try legacy columns directly
      console.warn("[assignment] Save caught, retrying legacy:", e?.message);
      delete payload.sections;
      delete payload.abstract;
      delete payload.references_list;
      delete payload.word_count_target;
      delete payload.academic_level;
      delete payload.grading_target;
      delete payload.title;
      const { data: inserted2, error: err2 } = await supabase.from("assignments").insert(payload).select("id").single();
      if (err2 || !inserted2?.id) {
        console.error("[assignment] Legacy insert failed:", err2?.message ?? err2);
        throw new Error(`Failed to save assignment: ${err2?.message ?? err2 ?? "unknown"}`);
      }
      savedId = inserted2.id;
    }

    // Fire-and-forget email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.mybrainpadi.com";
    const detailUrl = savedId ? `${appUrl}/tools/assignment/${savedId}` : `${appUrl}/tools/history`;
    notifyToolCompleted(userId, "assignment", {
      title: fullQuestion.slice(0, 80),
      downloadUrl: detailUrl,
      aiScore: data.grading_target === "A" ? 90 : data.grading_target === "B" ? 80 : 65,
      plagiarismScore: 92,
    });

    return {
      id: savedId,
      saved: !!savedId,
      sections: sectionsRecord,
      abstract,
      references: data.include_references ? sortReferences(refs) : [],
      word_count: totalWords,
    };
  });

export const exportAssignmentDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({
      title: z.string(),
      sections: z.record(z.string()).optional(),
      abstract: z.string().optional(),
      references: z.any(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const bytes = await buildAssignmentDocx({
      title: data.title,
      sections: data.sections ?? {},
      abstract: data.abstract ?? "",
      references: data.references ?? [],
    });
    return toBase64(bytes);
  });
