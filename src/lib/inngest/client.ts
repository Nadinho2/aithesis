import { Inngest } from "inngest";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

export const inngest = new Inngest({
  id: "mybrainpadi",
  eventKey: runtimeEnv("INNGEST_EVENT_KEY") ?? undefined,
});
