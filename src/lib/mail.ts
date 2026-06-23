import { resend, DEFAULT_FROM } from "./resend";

// ─── Types ────────────────────────────────────────────────────────────────

export type BrainPadiTool =
  | "Thesis"
  | "Assignment"
  | "Exam Prep"
  | "Presentation"
  | "CV Maker"
  | "Side Hustle";

type SendResult = { success: boolean; error?: string };

// ─── Helpers ───────────────────────────────────────────────────────────────

const SITE = "https://www.mybrainpadi.com";

function toolSlug(tool: BrainPadiTool): string {
  const map: Record<BrainPadiTool, string> = {
    Thesis: "thesis",
    Assignment: "assignment",
    "Exam Prep": "exam",
    Presentation: "presentation",
    "CV Maker": "cv",
    "Side Hustle": "side-hustle",
  };
  return map[tool];
}

function footer(): string {
  return `<hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 16px" />
<p style="margin:0;font-size:12px;color:#888888;">© 2026 MyBrainPadi · <a href="${SITE}" style="color:#888888;text-decoration:none;">mybrainpadi.com</a> · You're receiving this because you signed up at mybrainpadi.com</p>`;
}

function wrapper(body: string): string {
  return `<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.6;padding:32px 24px">${body}${footer()}</div>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;font-size:16px;margin-top:24px">${label}</a>`;
}

function heading(text: string): string {
  return `<h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 16px">${text}</h1>`;
}

function scoreCard(aiScore: number, plagiScore: number): string {
  return `<div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:15px">
<p style="margin:4px 0"><strong>AI Humanization Score:</strong> ${aiScore}% human</p>
<p style="margin:4px 0"><strong>Plagiarism Score:</strong> ${plagiScore}% original</p>
</div>`;
}

// ─── Send helper ───────────────────────────────────────────────────────────

async function send(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  if (!resend) {
    console.warn(`[mail] Resend not configured — skipped email to ${to}: "${subject}"`);
    return { success: false, error: "Resend is not configured" };
  }
  try {
    await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html: wrapper(html),
    });
    return { success: true };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[mail] Failed to send "${subject}" to ${to}:`, msg);
    return { success: false, error: msg };
  }
}

// ─── 14 Send Functions ─────────────────────────────────────────────────────

export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
}: {
  to: string;
  name: string;
  verificationUrl: string;
}): Promise<SendResult> {
  return send(
    to,
    "Verify your MyBrainPadi account",
    `${heading("Verify your email")}
<p>Hi ${name},</p>
<p>Thanks for signing up! Please verify your email address to activate your MyBrainPadi account.</p>
${ctaButton(verificationUrl, "Verify Email")}
<p style="margin-top:20px;font-size:14px;color:#666">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>`,
  );
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<SendResult> {
  return send(
    to,
    "Reset your MyBrainPadi password",
    `${heading("Reset your password")}
<p>Hi ${name},</p>
<p>We received a request to reset your MyBrainPadi password. Click the button below to set a new one.</p>
${ctaButton(resetUrl, "Reset Password")}
<p style="margin-top:20px;font-size:14px;color:#666">This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your account is safe.</p>`,
  );
}

export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}): Promise<SendResult> {
  return send(
    to,
    "Welcome to MyBrainPadi 🎓",
    `${heading("Welcome to MyBrainPadi 🎓")}
<p>Hi ${name},</p>
<p>MyBrainPadi is your AI-powered student toolkit. Generate thesis proposals, assignments, CVs, exam prep materials, presentations and side hustle ideas — all in minutes.</p>
<p>We're excited to have you on board. Start exploring the tools and see what you can create.</p>
${ctaButton(`${SITE}/tools`, "Explore Tools")}`,
  );
}

export async function sendPaymentConfirmedEmail({
  to,
  name,
  tool,
  amount,
}: {
  to: string;
  name: string;
  tool: BrainPadiTool;
  amount: string;
}): Promise<SendResult> {
  return send(
    to,
    `Payment confirmed — ${tool} | MyBrainPadi`,
    `${heading("Payment confirmed")}
<p>Hi ${name},</p>
<p>Your payment of <strong>₦${amount}</strong> for <strong>${tool}</strong> has been received.</p>
<p>Your output is now being generated. We'll send you another email when it's ready.</p>`,
  );
}

export async function sendPaymentFailedEmail({
  to,
  name,
  tool,
  amount,
}: {
  to: string;
  name: string;
  tool: BrainPadiTool;
  amount: string;
}): Promise<SendResult> {
  const slug = toolSlug(tool);
  return send(
    to,
    `Payment unsuccessful — ${tool} | MyBrainPadi`,
    `${heading("Payment unsuccessful")}
<p>Hi ${name},</p>
<p>Unfortunately, your payment of <strong>₦${amount}</strong> for <strong>${tool}</strong> was not successful.</p>
<p>This could be due to insufficient funds or a temporary issue with your payment provider. Please try again.</p>
${ctaButton(`${SITE}/tools/${slug}`, "Try Again")}`,
  );
}

export async function sendProcessingStartedEmail({
  to,
  name,
  tool,
}: {
  to: string;
  name: string;
  tool: BrainPadiTool;
}): Promise<SendResult> {
  return send(
    to,
    `We're working on your ${tool} ⚙️`,
    `${heading("We're working on it ⚙️")}
<p>Hi ${name},</p>
<p>Your <strong>${tool}</strong> is now being processed by MyBrainPadi's AI. This usually takes a few minutes.</p>
<p>You'll receive another email as soon as it's ready. No need to stay on the page.</p>`,
  );
}

export async function sendThesisReadyEmail({
  to,
  name,
  thesisTitle,
  downloadUrl,
  aiScore,
  plagiarismScore,
}: {
  to: string;
  name: string;
  thesisTitle: string;
  downloadUrl: string;
  aiScore: number;
  plagiarismScore: number;
}): Promise<SendResult> {
  return send(
    to,
    "Your Thesis is ready — MyBrainPadi",
    `${heading("Your Thesis is ready")}
<p>Hi ${name},</p>
<p>Your thesis <strong>"${thesisTitle}"</strong> has been generated.</p>
${scoreCard(aiScore, plagiarismScore)}
${ctaButton(downloadUrl, "View & Download Thesis")}`,
  );
}

export async function sendAssignmentReadyEmail({
  to,
  name,
  assignmentTitle,
  downloadUrl,
  aiScore,
  plagiarismScore,
}: {
  to: string;
  name: string;
  assignmentTitle: string;
  downloadUrl: string;
  aiScore: number;
  plagiarismScore: number;
}): Promise<SendResult> {
  return send(
    to,
    "Your Assignment is ready — MyBrainPadi",
    `${heading("Your Assignment is ready")}
<p>Hi ${name},</p>
<p>Your assignment <strong>"${assignmentTitle}"</strong> has been generated.</p>
${scoreCard(aiScore, plagiarismScore)}
${ctaButton(downloadUrl, "View & Download Assignment")}`,
  );
}

export async function sendExamPrepReadyEmail({
  to,
  name,
  subject,
  downloadUrl,
}: {
  to: string;
  name: string;
  subject: string;
  downloadUrl: string;
}): Promise<SendResult> {
  return send(
    to,
    `Your Exam Prep for ${subject} is ready — MyBrainPadi`,
    `${heading("Your Exam Prep is ready")}
<p>Hi ${name},</p>
<p>Your exam prep material for <strong>${subject}</strong> is ready.</p>
${ctaButton(downloadUrl, "View Exam Prep")}`,
  );
}

export async function sendPresentationReadyEmail({
  to,
  name,
  presentationTitle,
  downloadUrl,
}: {
  to: string;
  name: string;
  presentationTitle: string;
  downloadUrl: string;
}): Promise<SendResult> {
  return send(
    to,
    "Your Presentation is ready — MyBrainPadi",
    `${heading("Your Presentation is ready")}
<p>Hi ${name},</p>
<p>Your presentation <strong>"${presentationTitle}"</strong> has been generated.</p>
${ctaButton(downloadUrl, "View & Download Presentation")}`,
  );
}

export async function sendCVReadyEmail({
  to,
  name,
  downloadUrl,
}: {
  to: string;
  name: string;
  downloadUrl: string;
}): Promise<SendResult> {
  return send(
    to,
    "Your CV is ready — MyBrainPadi",
    `${heading("Your CV is ready")}
<p>Hi ${name},</p>
<p>Your CV has been generated and is ready to download.</p>
${ctaButton(downloadUrl, "Download Your CV")}`,
  );
}

export async function sendSideHustleReadyEmail({
  to,
  name,
  downloadUrl,
}: {
  to: string;
  name: string;
  downloadUrl: string;
}): Promise<SendResult> {
  return send(
    to,
    "Your Side Hustle Guide is ready — MyBrainPadi",
    `${heading("Your Side Hustle Guide is ready")}
<p>Hi ${name},</p>
<p>Your personalised side hustle guide is ready to explore.</p>
${ctaButton(downloadUrl, "View Your Guide")}`,
  );
}

export async function sendGenerationFailedEmail({
  to,
  name,
  tool,
}: {
  to: string;
  name: string;
  tool: BrainPadiTool;
}): Promise<SendResult> {
  return send(
    to,
    `Something went wrong — ${tool} | MyBrainPadi`,
    `${heading("Something went wrong")}
<p>Hi ${name},</p>
<p>We're sorry — your <strong>${tool}</strong> generation failed due to a server error.</p>
<p>Our team has been notified. If the issue persists, please contact us at <a href="mailto:hello@mybrainpadi.com" style="color:#4F46E5;">hello@mybrainpadi.com</a>.</p>
${ctaButton("mailto:hello@mybrainpadi.com", "Contact Support")}`,
  );
}

export async function sendHumanizationFailedEmail({
  to,
  name,
  tool,
  sectionTitle,
  finalScore,
}: {
  to: string;
  name: string;
  tool: BrainPadiTool;
  sectionTitle: string;
  finalScore: number;
}): Promise<SendResult> {
  return send(
    to,
    `Manual review needed — ${tool} | MyBrainPadi`,
    `${heading("Manual review needed")}
<p>Hi ${name},</p>
<p>The section <strong>"${sectionTitle}"</strong> in your <strong>${tool}</strong> reached a maximum AI humanization score of <strong>${finalScore}%</strong> after 3 attempts and requires manual review before it can be finalised.</p>
<p>Our team will review it shortly. You can check the status in your dashboard.</p>
${ctaButton(`${SITE}/tools/history`, "Review in Dashboard")}`,
  );
}
