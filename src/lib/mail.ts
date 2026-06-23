import { resend, DEFAULT_FROM } from "./resend";

// ─── Types ────────────────────────────────────────────────────────────────

export type BrainPadiTool =
  | "Thesis"
  | "Proposal"
  | "Assignment"
  | "Exam Prep"
  | "Presentation"
  | "CV Maker"
  | "Side Hustle";

type SendResult = { success: boolean; error?: string };

// ─── Brand Palette ─────────────────────────────────────────────────────────

const BRAND = {
  paper: "#FAF8F3",
  ink: "#1A1A1A",
  inkSecondary: "#5F5E5A",
  verde: "#0F6E56",
  verdeLight: "#E1F5EE",
  verdeDark: "#04342C",
  amberBg: "#FAEEDA",
  amberText: "#856305",
  white: "#FFFFFF",
  border: "#E5E2D8",
  destructive: "#C23B3B",
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

const SITE = "https://www.mybrainpadi.com";

function toolSlug(tool: BrainPadiTool): string {
  const map: Record<BrainPadiTool, string> = {
    Thesis: "thesis",
    Proposal: "proposal",
    Assignment: "assignment",
    "Exam Prep": "exam",
    Presentation: "presentation",
    "CV Maker": "cv",
    "Side Hustle": "side-hustle",
  };
  return map[tool];
}

function wrapper(body: string): string {
  return `\
<div style="max-width:600px;margin:0 auto;background:${BRAND.white};font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};font-size:16px;line-height:1.7;padding:0;border-radius:8px;overflow:hidden">

  <!-- Header bar -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};border-bottom:2px solid ${BRAND.verde}">
    <tr>
      <td style="padding:28px 32px 20px">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:24px;font-weight:700;color:${BRAND.ink};margin:0;letter-spacing:-0.5px">MyBrainPadi</h1>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <div style="padding:36px 32px 28px">
    ${body}
  </div>

  <!-- Footer -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper}">
    <tr>
      <td style="padding:24px 32px;text-align:center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
          <tr>
            <td style="padding-bottom:12px">
              <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;font-weight:700;color:${BRAND.ink}">MyBrainPadi</span>
            </td>
          </tr>
        </table>
        <p style="margin:4px 0 0;font-size:12px;color:${BRAND.inkSecondary};line-height:1.5">
          © 2026 MyBrainPadi · <a href="${SITE}" style="color:${BRAND.verde};text-decoration:none">mybrainpadi.com</a>
        </p>
        <p style="margin:4px 0 0;font-size:11px;color:${BRAND.inkSecondary}">You're receiving this because you signed up at mybrainpadi.com</p>
      </td>
    </tr>
  </table>
</div>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px">
  <tr>
    <td style="border-radius:6px;background:${BRAND.verde};padding:0">
      <a href="${href}" style="display:inline-block;padding:13px 32px;border-radius:6px;background:${BRAND.verde};color:${BRAND.white};text-decoration:none;font-weight:700;font-size:15px;font-family:Arial,Helvetica,sans-serif;mso-hide:all">${label}</a>
    </td>
  </tr>
</table>`;
}

function secondaryCta(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 0">
  <tr>
    <td>
      <a href="${href}" style="display:inline-block;padding:11px 28px;border-radius:6px;border:1.5px solid ${BRAND.border};color:${BRAND.ink};text-decoration:none;font-weight:600;font-size:14px;font-family:Arial,Helvetica,sans-serif">${label}</a>
    </td>
  </tr>
</table>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${BRAND.ink};margin:0 0 16px;letter-spacing:-0.3px">${text}</h2>`;
}

function greeting(name: string): string {
  return `<p style="margin:0 0 12px;font-size:16px;color:${BRAND.ink}">Hi ${name},</p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;color:${BRAND.ink}">${text}</p>`;
}

function smallNote(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:${BRAND.inkSecondary};line-height:1.5">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0" />`;
}

function scoreCard(aiScore: number, plagiScore: number): string {
  const aiColor = aiScore >= 70 ? BRAND.verde : aiScore >= 40 ? BRAND.amberText : BRAND.destructive;
  const plColor = plagiScore >= 70 ? BRAND.verde : plagiScore >= 40 ? BRAND.amberText : BRAND.destructive;
  return `\
<div style="background:${BRAND.paper};border-radius:8px;padding:18px 22px;margin:20px 0;font-size:15px;border:1px solid ${BRAND.border}">
  <p style="margin:0 0 10px;font-weight:700;font-size:14px;color:${BRAND.ink};text-transform:uppercase;letter-spacing:0.5px">Quality Scores</p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td width="50%" style="padding:4px 0;vertical-align:top">
        <span style="font-size:13px;color:${BRAND.inkSecondary}">AI Humanization</span>
        <div style="margin-top:4px;height:6px;background:${BRAND.border};border-radius:3px;max-width:160px">
          <div style="width:${aiScore}%;height:6px;background:${aiColor};border-radius:3px"></div>
        </div>
        <span style="font-weight:700;font-size:15px;color:${aiColor}">${aiScore}% human</span>
      </td>
      <td width="50%" style="padding:4px 0;vertical-align:top">
        <span style="font-size:13px;color:${BRAND.inkSecondary}">Originality</span>
        <div style="margin-top:4px;height:6px;background:${BRAND.border};border-radius:3px;max-width:160px">
          <div style="width:${plagiScore}%;height:6px;background:${plColor};border-radius:3px"></div>
        </div>
        <span style="font-weight:700;font-size:15px;color:${plColor}">${plagiScore}% original</span>
      </td>
    </tr>
  </table>
</div>`;
}

function statusBadge(text: string, bgColor: string, textColor: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${bgColor};color:${textColor};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px">${text}</span>`;
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
    `${heading("Verify your email address")}
${greeting(name)}
${paragraph("Thanks for signing up! Please verify your email address to activate your MyBrainPadi account and start using all our tools.")}
${ctaButton(verificationUrl, "Verify Email")}
${smallNote("This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.")}`,
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
${greeting(name)}
${paragraph("We received a request to reset your MyBrainPadi password. Click the button below to set a new one.")}
${ctaButton(resetUrl, "Reset Password")}
${smallNote("This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your account is safe.")}`,
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
${greeting(name)}
${paragraph("MyBrainPadi is your AI-powered student toolkit. Generate thesis proposals, assignments, CVs, exam prep materials, presentations and side hustle ideas — all in minutes, powered by verified scholarly research.")}
${paragraph("We're excited to have you on board. Start exploring the tools and see what you can create.")}
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
    `${heading("Payment confirmed ✅")}
${greeting(name)}
<div style="background:${BRAND.verdeLight};border-radius:8px;padding:16px 20px;margin:0 0 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding:2px 0"><span style="font-size:14px;color:${BRAND.inkSecondary}">Product</span></td>
      <td style="padding:2px 0;text-align:right"><span style="font-weight:600;font-size:14px;color:${BRAND.ink}">${tool}</span></td>
    </tr>
    <tr>
      <td style="padding:2px 0"><span style="font-size:14px;color:${BRAND.inkSecondary}">Amount</span></td>
      <td style="padding:2px 0;text-align:right"><span style="font-weight:700;font-size:16px;color:${BRAND.verdeDark}">₦${amount}</span></td>
    </tr>
  </table>
</div>
${paragraph("Your payment has been received and your output is now being generated. We'll send you another email as soon as it's ready — no need to stay on the page.")}`,
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
${greeting(name)}
<div style="background:#FEF2F2;border-radius:8px;padding:16px 20px;margin:0 0 16px;border:1px solid #FECACA">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding:2px 0"><span style="font-size:14px;color:${BRAND.inkSecondary}">Product</span></td>
      <td style="padding:2px 0;text-align:right"><span style="font-weight:600;font-size:14px;color:${BRAND.ink}">${tool}</span></td>
    </tr>
    <tr>
      <td style="padding:2px 0"><span style="font-size:14px;color:${BRAND.inkSecondary}">Amount</span></td>
      <td style="padding:2px 0;text-align:right"><span style="font-weight:700;font-size:16px;color:${BRAND.destructive}">₦${amount}</span></td>
    </tr>
  </table>
</div>
${paragraph("Unfortunately, your payment was not successful. This could be due to insufficient funds or a temporary issue with your payment provider.")}
${ctaButton(`${SITE}/tools/${slug}`, "Try Again")}
${smallNote("If the issue continues, please contact support at hello@mybrainpadi.com")}`,
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
${greeting(name)}
${paragraph(`Your <strong>${tool}</strong> is now being processed by MyBrainPadi's AI. This usually takes a few minutes.`)}
${paragraph("You'll receive another email as soon as it's ready. No need to stay on the page — we'll let you know when it's done.")}
<div style="background:${BRAND.paper};border-radius:8px;padding:16px 20px;margin:16px 0;text-align:center;border:1px solid ${BRAND.border}">
  <span style="font-size:14px;color:${BRAND.inkSecondary}">Estimated time: <strong style="color:${BRAND.ink}">2–5 minutes</strong></span>
</div>`,
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
    `${heading("Your Thesis is ready 🎉")}
${greeting(name)}
${paragraph(`Your thesis <strong>"${thesisTitle}"</strong> has been generated and is ready for review.`)}
${scoreCard(aiScore, plagiarismScore)}
${ctaButton(downloadUrl, "View & Download Thesis")}`,
  );
}

export async function sendProposalReadyEmail({
  to,
  name,
  proposalTitle,
  downloadUrl,
  aiScore,
  plagiarismScore,
}: {
  to: string;
  name: string;
  proposalTitle: string;
  downloadUrl: string;
  aiScore: number;
  plagiarismScore: number;
}): Promise<SendResult> {
  return send(
    to,
    "Your Proposal is ready — MyBrainPadi",
    `${heading("Your Proposal is ready 🎉")}
${greeting(name)}
${paragraph(`Your proposal <strong>"${proposalTitle}"</strong> has been generated and is ready for review.`)}
${scoreCard(aiScore, plagiarismScore)}
${ctaButton(downloadUrl, "View & Download Proposal")}`,
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
    `${heading("Your Assignment is ready 🎉")}
${greeting(name)}
${paragraph(`Your assignment <strong>"${assignmentTitle}"</strong> has been generated and is ready for review.`)}
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
    `${heading("Your Exam Prep is ready 🎉")}
${greeting(name)}
${paragraph(`Your exam prep material for <strong>${subject}</strong> is ready. Review the key concepts, practice questions, and study guide we've prepared for you.`)}
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
    `${heading("Your Presentation is ready 🎉")}
${greeting(name)}
${paragraph(`Your presentation <strong>"${presentationTitle}"</strong> has been generated and is ready to download or present.`)}
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
    `${heading("Your CV is ready 🎉")}
${greeting(name)}
${paragraph("Your CV has been generated and is ready to download. It's formatted professionally and tailored to showcase your academic and professional experience.")}
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
    `${heading("Your Side Hustle Guide is ready 🎉")}
${greeting(name)}
${paragraph("Your personalised side hustle guide is ready. It includes actionable ideas, estimated earnings, first steps, and a roadmap tailored to your skills and interests.")}
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
${greeting(name)}
${paragraph(`We're sorry — your <strong>${tool}</strong> generation failed due to a server error.`)}
${paragraph("Our team has been notified and is looking into it. If the issue persists, please contact us.")}
${ctaButton("mailto:hello@mybrainpadi.com", "Contact Support")}
${smallNote("Reference this tool: " + tool)}`,
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
${greeting(name)}
${paragraph(`The section <strong>"${sectionTitle}"</strong> in your <strong>${tool}</strong> reached a maximum AI humanization score of <strong>${finalScore}%</strong> after 3 attempts and requires manual review before it can be finalised.`)}
<div style="background:${BRAND.amberBg};border-radius:8px;padding:16px 20px;margin:16px 0;border:1px solid #E8D5A3;text-align:center">
  <span style="font-size:15px;font-weight:700;color:${BRAND.amberText}">Current score: ${finalScore}% human</span>
  <span style="display:block;margin-top:2px;font-size:13px;color:${BRAND.inkSecondary}">Target: 80%+ — manual review in progress</span>
</div>
${paragraph("Our team will review it shortly. You can check the status in your dashboard.")}
${ctaButton(`${SITE}/tools/history`, "Review in Dashboard")}`,
  );
}
