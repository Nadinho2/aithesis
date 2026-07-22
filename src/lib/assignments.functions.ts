import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { enqueueJob } from "./queue";
import { getUserEmail } from "./mail-helper";
import { sendProcessingStartedEmail } from "./mail";
import { parseUploadedFile } from "./upload.server";
import { buildAssignmentDocx, toBase64 } from "./docx.server";

// ─── Input validation ──────────────────────────────────────────────────────

const AssignmentInput = z.object({
  question: z.string().min(10).max(10000),
  include_references: z.boolean().default(true),
  citation_style: z.enum(["apa_7", "harvard"]).default("apa_7"),
  word_count_target: z.number().int().min(1500).max(15000).default(3000),
  academic_level: z.enum(["undergraduate", "masters", "phd"]).default("undergraduate"),
  grading_target: z.enum(["A", "B", "C"]).default("B"),
  assignment_type: z.enum(["essay", "problem_solving"]).default("essay"),
  subject: z.enum(["mathematics", "science", "programming", "general"]).optional(),
  file_base64: z.string().optional(),
  file_mime: z.string().optional(),
  file_name: z.string().optional(),
});

// ─── Server functions ──────────────────────────────────────────────────────

export const generateAssignment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AssignmentInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Parse uploaded file
    let fileText = "";
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      fileText = parsed.text;
    }

    const fullQuestion = [data.question, fileText].filter(Boolean).join("\n\n");

    // Send processing-started email (fire-and-forget)
    const userEmail = await getUserEmail(userId);
    if (userEmail) {
      sendProcessingStartedEmail({
        to: userEmail,
        name: userEmail.split("@")[0],
        tool: "Assignment",
      }).catch(() => {});
    }

    // Enqueue background job for queue worker
    await enqueueJob("assignment", {
      userId,
      data: {
        question: fullQuestion,
        include_refs: data.include_references,
        citation_style: data.citation_style,
        word_count_target: data.word_count_target,
        academic_level: data.academic_level,
        grading_target: data.grading_target,
        file_text: fileText || undefined,
        assignment_type: data.assignment_type,
        subject: data.subject,
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

    return { success: true, message: "Your assignment is being generated in the background. Check your history soon!" };
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
