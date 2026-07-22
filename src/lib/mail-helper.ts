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
    proposal: "Proposal",
    thesis: "Thesis",
    assignment: "Assignment",
    exam: "Exam Prep",
    presentation: "Presentation",
    cv: "CV Maker",
    side_hustle: "Side Hustle",
    seminar: "Seminar",
    seminar_journal: "Seminar",
    seminar_departmental: "Seminar",
    seminar_postgraduate: "Seminar",
    seminar_technical: "Seminar",
    seminar_book_review: "Seminar",
  };
  return map[product] ?? null;
}

/**
 * Fire-and-forget ready email for any tool.
 * Never throws — runs async and catches errors internally.
 */
import {
  sendThesisReadyEmail, sendProposalReadyEmail, sendAssignmentReadyEmail,
  sendExamPrepReadyEmail, sendPresentationReadyEmail, sendCVReadyEmail,
  sendSideHustleReadyEmail, sendSeminarReadyEmail, sendGenerationFailedEmail,
} from "./mail";
import type { BrainPadiTool } from "./mail";

export async function notifyToolCompleted(
  userId: string,
  tool: "thesis" | "proposal" | "assignment" | "exam" | "presentation" | "cv" | "side_hustle" | "seminar",
  opts: {
    title?: string;
    downloadUrl?: string;
    aiScore?: number;
    plagiarismScore?: number;
    subject?: string;
    seminarType?: string;
  },
): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) return;
  const name = email.split("@")[0];

  try {
    switch (tool) {
      case "proposal":
        await sendProposalReadyEmail({
          to: email,
          name,
          proposalTitle: opts.title ?? "Your Proposal",
          downloadUrl: opts.downloadUrl ?? "",
          aiScore: opts.aiScore ?? 85,
          plagiarismScore: opts.plagiarismScore ?? 92,
        });
        break;
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
      case "seminar":
        await sendSeminarReadyEmail({
          to: email,
          name,
          seminarTitle: opts.title ?? "Your Seminar Paper",
          seminarType: opts.seminarType ?? "Seminar",
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

/**
 * Notify admin about a new university submission.
 */
export async function notifyAdminUniversitySubmitted(
  universityName: string,
  department: string,
  chapterStructure: string,
  email: string | null,
): Promise<void> {
  const adminEmail = process?.env?.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[mail-helper] ADMIN_EMAIL not set — skipping submission notification");
    return;
  }

  const { Resend } = await import("resend");
  const resendApiKey = process?.env?.RESEND_API_KEY;
  if (!resendApiKey) return;

  const resend = new Resend(resendApiKey);

  try {
    const { data: sent } = await resend.emails.send({
      from: "BrainPadi <notifications@brainpadi.com>",
      to: [adminEmail],
      subject: `New University Submission: ${universityName}`,
      html: `
        <h2>New University Structure Request</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">University</td><td style="padding:8px;border:1px solid #ddd">${universityName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Department</td><td style="padding:8px;border:1px solid #ddd">${department}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Chapter Structure</td><td style="padding:8px;border:1px solid #ddd">${chapterStructure}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Submitter Email</td><td style="padding:8px;border:1px solid #ddd">${email ?? "Not provided"}</td></tr>
        </table>
        <p><a href="https://mybrainpadi.com/admin" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">View in Admin Panel</a></p>
      `,
    });
  } catch (err) {
    console.error("[mail-helper] Failed to send admin submission notification:", err);
  }
}
