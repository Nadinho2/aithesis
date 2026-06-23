/**
 * Helper to fetch a user's primary email from Clerk's backend API.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { createClerkClient } = await import("@clerk/backend");
    const secretKey =
      typeof process !== "undefined" ? process.env?.CLERK_SECRET_KEY : undefined;
    if (!secretKey) return null;
    const clerkClient = createClerkClient({ secretKey });
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses?.[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Map a product string to a BrainPadiTool type.
 */
export function productToTool(product: string): string | null {
  const map: Record<string, string> = {
    proposal: "Thesis",
    thesis: "Thesis",
    assignment: "Assignment",
    exam: "Exam Prep",
    presentation: "Presentation",
    cv: "CV Maker",
    side_hustle: "Side Hustle",
  };
  return map[product] ?? null;
}

/**
 * Fire-and-forget ready email for any tool.
 * Never throws — runs async and catches errors internally.
 */
import {
  sendThesisReadyEmail,
  sendAssignmentReadyEmail,
  sendExamPrepReadyEmail,
  sendPresentationReadyEmail,
  sendCVReadyEmail,
  sendSideHustleReadyEmail,
  sendGenerationFailedEmail,
} from "./mail";
import type { BrainPadiTool } from "./mail";

export async function notifyToolCompleted(
  userId: string,
  tool: "thesis" | "assignment" | "exam" | "presentation" | "cv" | "side_hustle",
  opts: {
    title?: string;
    downloadUrl?: string;
    aiScore?: number;
    plagiarismScore?: number;
    subject?: string;
  },
): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) return;
  const name = email.split("@")[0];

  try {
    switch (tool) {
      case "thesis":
        await sendThesisReadyEmail({
          to: email,
          name,
          thesisTitle: opts.title ?? "Your Thesis",
          downloadUrl: opts.downloadUrl ?? "",
          aiScore: opts.aiScore ?? 85,
          plagiarismScore: opts.plagiarismScore ?? 92,
        });
        break;
      case "assignment":
        await sendAssignmentReadyEmail({
          to: email,
          name,
          assignmentTitle: opts.title ?? "Your Assignment",
          downloadUrl: opts.downloadUrl ?? "",
          aiScore: opts.aiScore ?? 85,
          plagiarismScore: opts.plagiarismScore ?? 92,
        });
        break;
      case "exam":
        await sendExamPrepReadyEmail({
          to: email,
          name,
          subject: opts.subject ?? opts.title ?? "your subject",
          downloadUrl: opts.downloadUrl ?? "",
        });
        break;
      case "presentation":
        await sendPresentationReadyEmail({
          to: email,
          name,
          presentationTitle: opts.title ?? "Your Presentation",
          downloadUrl: opts.downloadUrl ?? "",
        });
        break;
      case "cv":
        await sendCVReadyEmail({
          to: email,
          name,
          downloadUrl: opts.downloadUrl ?? "",
        });
        break;
      case "side_hustle":
        await sendSideHustleReadyEmail({
          to: email,
          name,
          downloadUrl: opts.downloadUrl ?? "",
        });
        break;
    }
  } catch (err) {
    console.error(`[mail-helper] Failed to send ${tool} ready email to ${email}:`, err);
  }
}

/**
 * Fire-and-forget failure email for any tool.
 */
export async function notifyToolFailed(
  userId: string,
  tool: BrainPadiTool,
): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) return;
  const name = email.split("@")[0];

  try {
    await sendGenerationFailedEmail({ to: email, name, tool });
  } catch (err) {
    console.error(`[mail-helper] Failed to send failure email for ${tool} to ${email}:`, err);
  }
}
