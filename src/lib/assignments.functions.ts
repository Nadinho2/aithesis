import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { fetchScholarlyRefs, formatByStyle, sortReferences } from "./scholarly.server";
import { parseUploadedFile } from "./upload.server";
import { buildAssignmentDocx, toBase64 } from "./docx.server";

const AssignmentInput = z.object({
  question: z.string().min(10).max(10000),
  include_references: z.boolean().default(true),
  citation_style: z.enum(["apa_7", "harvard"]).default("apa_7"),
  file_base64: z.string().optional(),
  file_mime: z.string().optional(),
  file_name: z.string().optional(),
});

export const generateAssignment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AssignmentInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    // Parse uploaded file if provided
    let fileText = "";
    let fileImages: string[] = [];
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      fileText = parsed.text;
      fileImages = parsed.images;
    }

    const fullQuestion = [data.question, fileText].filter(Boolean).join("\n\n--- Uploaded content ---\n\n");

    // Fetch scholarly references
    const refs = data.include_references
      ? await fetchScholarlyRefs(fullQuestion.slice(0, 300), 8)
      : [];

    // Build AI prompt
    const styleLabel = data.citation_style === "harvard" ? "Harvard" : "APA 7";
    const refContext = refs.map((r) => formatByStyle(r, data.citation_style)).join("\n");

    const systemPrompt = `You are an academic writing assistant. Write a thorough, well-structured answer to the student's assignment question.

${data.include_references
  ? `CITATION RULES (${styleLabel} style):
- Only cite the references provided below. Never invent sources.
- Use inline citations: (Author, Year) for ${styleLabel}.
- Synthesise multiple sources — argue, compare, identify gaps.
- Include a reference list at the end.`
  : `RULES:
- Do NOT include any citations or references.
- Write in your own words with original analysis.`}

RULES:
- Plain text only — NO markdown syntax.
- Use clear section headings on their own lines.
- Vary sentence length naturally.
- Be specific and concrete.
- If the question asks for examples, provide them.`;

    const userPrompt = `Assignment question:\n${fullQuestion}\n\n${refContext ? `Scholarly references:\n${refContext}` : ""}`;

    const raw = await callAI(undefined as any, {
      model: "deepseek-v4-pro",
      system: systemPrompt,
      user: userPrompt,
    });

    // Clean markdown wrapping
    const answer = raw
      .replace(/^```(?:markdown)?\s*\n?/im, "")
      .replace(/\n?```\s*$/im, "")
      .trim();

    // Store in DB
    if (supabase) {
      await supabase.from("assignments").insert({
        user_id: userId,
        question: fullQuestion,
        answer,
        references_list: refs,
        include_references: data.include_references,
        citation_style: data.citation_style,
        word_count: answer.split(/\s+/).length,
        status: "completed",
      }).catch(() => {});
    }

    return { answer, references: data.include_references ? sortReferences(refs) : [] };
  });

export const exportAssignmentDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ title: z.string(), answer: z.string(), references: z.any() }).parse(i),
  )
  .handler(async ({ data }) => {
    const bytes = await buildAssignmentDocx({
      title: data.title,
      answer: data.answer,
      references: data.references ?? [],
    });
    return toBase64(bytes);
  });
