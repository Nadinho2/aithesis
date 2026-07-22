import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { enqueueJob } from "./queue";
import { getUserEmail } from "./mail-helper";
import { sendProcessingStartedEmail } from "./mail";

const SeminarInput = z.object({
  seminar_type: z.enum([
    "seminar_journal",
    "seminar_departmental",
    "seminar_postgraduate",
    "seminar_technical",
    "seminar_book_review",
  ]),
  title: z.string().min(5).max(300),
  academic_level: z.enum(["undergraduate", "postgraduate", "phd"]),
  target_words: z.number().int().min(1000).max(10000),
  num_sub_themes: z.number().int().min(2).max(4).optional(),
  book_author: z.string().optional(),
  author_name: z.string().optional(),
  institution: z.string().optional(),
});

export const generateSeminar = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SeminarInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Send processing-started email (fire-and-forget)
    const userEmail = await getUserEmail(userId);
    if (userEmail) {
      sendProcessingStartedEmail({
        to: userEmail,
        name: userEmail.split("@")[0],
        tool: "Seminar",
      }).catch(() => {});
    }

    // Enqueue background job for queue worker
    await enqueueJob("seminar", {
      userId,
      data: {
        seminar_type: data.seminar_type,
        title: data.title,
        academic_level: data.academic_level,
        target_words: data.target_words,
        topic: data.title,
        num_sub_themes: data.num_sub_themes,
        book_author: data.book_author,
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

    return { success: true, message: "Your seminar paper is being generated. You'll receive an email when it's ready." };
  });
