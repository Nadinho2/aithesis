import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { notifyToolCompleted } from "./mail-helper";
import { parseUploadedFile } from "./upload.server";

export const ExamQuestionType = z.enum(["objectives", "theory", "both"]);

const ExamInput = z.object({
  subject_notes: z.string().min(10).max(20000),
  total_questions: z.number().int().min(5).max(100).default(20),
  question_type: ExamQuestionType.default("both"),
  theory_count: z.number().int().min(1).max(100).optional(),
  objectives_count: z.number().int().min(1).max(100).optional(),
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
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

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

    const systemPrompt = `You are an experienced Nigerian university lecturer creating an examination paper based on the provided notes.

EXAM STRUCTURE:
${objectiveCount > 0 ? `SECTION A: OBJECTIVE QUESTIONS (${objectiveCount} questions)
- Multiple choice with 4 options each (A-D)
- Each question tests a distinct concept from the notes
- Avoid trick questions — test understanding, not memory
- Distractors must be plausible but clearly wrong to someone who studied
- Include a brief explanation for why the correct answer is correct` : ""}
${theoryCount > 0 ? `
${objectiveCount > 0 ? `SECTION B: THEORY QUESTIONS (${theoryCount} questions)
` : `THEORY QUESTIONS (${theoryCount} questions)
`}- Each question should require 1-3 paragraphs to answer
- Assign marks based on complexity: simple recall (5 marks), analysis (10 marks), evaluation (15 marks)
- Questions should progress from easier to harder
- Include "Discuss", "Explain", "Analyse", "Compare and contrast" types` : ""}

GENERAL RULES:
- Questions must be clear and unambiguous
- Cover key concepts from the notes, not obscure details
- Do not repeat the same concept in multiple questions
- Language: formal academic English appropriate for university level
- Do NOT include an answer key section — answers are embedded in each question object

Return ONLY valid JSON (no markdown, no code fences):
{
  ${objectiveCount > 0 ? `objectives: [{ question: "question text", options: ["Option A text", "Option B text", "Option C text", "Option D text"], answer: "Option A text", explanation: "One sentence explaining why" }],` : ""}
  ${theoryCount > 0 ? `theory: [{ question: "question text", marks: number }]` : ""}
}
IMPORTANT: The "answer" field must contain the FULL TEXT of the correct option (e.g. "Lagos"), NOT a letter label (e.g. "A").
IMPORTANT: Each option in the "options" array must be the full text of the choice, not just a letter.`;

    const raw = await callAI(apiKey, {
      model: "deepseek-reasoner",
      max_tokens: 64000,
      system: systemPrompt,
      user: notes,
    });

    // callAI already returns a parsed object
    const parsed = raw;

    // Store in DB (fire-and-forget)
    if (supabase) {
      try {
        await supabase.from("exams").insert({
          user_id: userId,
          subject_notes: notes,
          total_questions: data.total_questions,
          question_type: data.question_type,
          questions: parsed,
          status: "completed",
        });
      } catch (e: any) {
        console.error("Failed to save exam to history:", e?.message ?? e);
      }
    }

    // Fire-and-forget email notification
    notifyToolCompleted(userId, "exam", {
      title: data.subject_notes?.slice(0, 80) ?? "Exam Prep",
      downloadUrl: `https://www.mybrainpadi.com/tools/history`,
    });

    return parsed;
  });
