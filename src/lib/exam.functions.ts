import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { parseUploadedFile } from "./upload.server";

export const ExamQuestionType = z.enum(["objectives", "theory", "both"]);

const ExamInput = z.object({
  subject_notes: z.string().min(10).max(20000),
  total_questions: z.number().int().min(5).max(50).default(20),
  question_type: ExamQuestionType.default("both"),
  theory_count: z.number().int().min(1).max(30).optional(),
  objectives_count: z.number().int().min(1).max(30).optional(),
  file_base64: z.string().optional(),
  file_mime: z.string().optional(),
  file_name: z.string().optional(),
  image_base64: z.string().optional(),
});

export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => ExamInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    let notes = data.subject_notes;
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      notes += "\n\n--- Uploaded content ---\n\n" + parsed.text;
    }

    // Validate both-mode splits
    if (data.question_type === "both") {
      const tc = data.theory_count ?? Math.floor(data.total_questions / 2);
      const oc = data.objectives_count ?? Math.ceil(data.total_questions / 2);
      if (tc + oc !== data.total_questions) {
        throw new Error(`Theory (${tc}) + Objectives (${oc}) must equal ${data.total_questions}.`);
      }
    }

    const objectiveCount =
      data.question_type === "objectives"
        ? data.total_questions
        : data.question_type === "both"
          ? (data.objectives_count ?? Math.ceil(data.total_questions / 2))
          : 0;
    const theoryCount =
      data.question_type === "theory"
        ? data.total_questions
        : data.question_type === "both"
          ? (data.theory_count ?? Math.floor(data.total_questions / 2))
          : 0;

    const systemPrompt = `You are an exam preparation assistant. Generate exam questions based on the provided notes.
${objectiveCount > 0 ? `Generate ${objectiveCount} multiple-choice objectives (4 options each, mark the correct answer).` : ""}
${theoryCount > 0 ? `Generate ${theoryCount} theory questions.` : ""}
Return ONLY valid JSON (no markdown, no code fences):
{ objectives: [{ question, options: [A,B,C,D], answer: "A" }], theory: [{ question, marks: number }] }`;

    const raw = await callAI(undefined as any, {
      model: "deepseek-v4-pro",
      system: systemPrompt,
      user: notes,
    });

    let cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    const parsed = JSON.parse(cleaned);

    // Store in DB
    if (supabase) {
      await supabase.from("exams").insert({
        user_id: userId,
        subject_notes: notes,
        total_questions: data.total_questions,
        question_type: data.question_type,
        questions: parsed,
        status: "completed",
      }).catch(() => {});
    }

    return parsed;
  });
