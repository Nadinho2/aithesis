import { Resend } from "resend";

function runtimeEnv(key: string): string | undefined {
  try {
    const proc = globalThis as any;
    return proc.process?.env?.[key];
  } catch {
    return undefined;
  }
}

const apiKey = runtimeEnv("RESEND_API_KEY");
if (!apiKey) {
  console.warn("[resend] RESEND_API_KEY is not set — emails will not be sent.");
}

export const resend = apiKey ? new Resend(apiKey) : null;

export const DEFAULT_FROM = "MyBrainPadi <hello@mybrainpadi.com>";
