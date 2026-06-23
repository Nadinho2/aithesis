/**
 * Unified AI provider abstraction.
 * Supports DeepSeek and Gemini with the same interface.
 *
 * Model naming convention:
 *   deepseek-chat       → DeepSeek V3 (JSON mode supported)
 *   deepseek-reasoner   → DeepSeek R1 (no JSON mode, has reasoning tags)
 *   gemini-2.5-flash    → Gemini 2.5 Flash (JSON mode via mime_type)
 *   gemini-2.5-pro      → Gemini 2.5 Pro (JSON mode via mime_type)
 */

type ProviderMsg = { role: string; content: string };
type ProviderOpts = {
  model: string;
  system: string;
  user: string;
  max_tokens?: number;
  jsonMode?: boolean;
};

type ProviderResult = {
  content: string;
  /** Whether the response came from deepseek-reasoner (for tag stripping) */
  isReasoner: boolean;
};

// ─── Env helpers ───────────────────────────────────────────────────────────

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

// ─── DeepSeek ──────────────────────────────────────────────────────────────

async function callDeepSeek(
  apiKey: string,
  opts: ProviderOpts,
): Promise<ProviderResult> {
  const isReasoner = opts.model === "deepseek-reasoner";
  const body: Record<string, any> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  // Only enforce JSON mode when explicitly requested (callAI), not for plain text (callAIText)
  if (!isReasoner && opts.jsonMode) body.response_format = { type: "json_object" };
  if (opts.max_tokens) body.max_tokens = opts.max_tokens;

  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429)
      throw new Error("Rate limit exceeded. Please try again shortly.");
    throw new Error(`DeepSeek API error ${resp.status}: ${text}`);
  }

  const payload = await resp.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Did not receive a response.");
  return { content, isReasoner };
}

// ─── Gemini ────────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  opts: ProviderOpts,
): Promise<ProviderResult> {
  // Map our shorthand names to Gemini API model IDs
  const modelMap: Record<string, string> = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
  };
  const apiModel = modelMap[opts.model] ?? opts.model;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;

  const contents: any[] = [{ role: "user", parts: [{ text: opts.user }] }];
  const generationConfig: Record<string, any> = {};

  if (opts.max_tokens) generationConfig.maxOutputTokens = opts.max_tokens;

  const body: Record<string, any> = {
    contents,
    generationConfig,
  };

  // System instruction — Gemini uses a separate top-level field
  if (opts.system) {
    body.systemInstruction = {
      role: "user",
      parts: [{ text: opts.system }],
    };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429)
      throw new Error("Rate limit exceeded. Please try again shortly.");
    throw new Error(`Gemini API error ${resp.status}: ${text}`);
  }

  const payload = await resp.json();

  // Check for blocked content
  if (payload.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request: ${payload.promptFeedback.blockReason}`,
    );
  }

  const candidate = payload?.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    const finishReason = candidate?.finishReason ?? "unknown";
    if (finishReason === "SAFETY") {
      throw new Error(
        "Gemini blocked the response due to safety filters. Try rephrasing your prompt.",
      );
    }
    throw new Error(
      `Gemini returned no content (finishReason: ${finishReason})`,
    );
  }

  const content = candidate.content.parts.map((p: any) => p.text ?? "").join("\n");
  if (!content) throw new Error("Did not receive a response.");
  return { content, isReasoner: false };
}

// ─── Router ────────────────────────────────────────────────────────────────

function detectProvider(model: string): "deepseek" | "gemini" {
  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("deepseek-")) return "deepseek";
  // Default to deepseek for backward compatibility
  return "deepseek";
}

/**
 * Low-level call to any supported AI provider.
 * Returns raw content string + metadata.
 */
export async function callProvider(
  apiKey: string | undefined,
  opts: ProviderOpts,
): Promise<ProviderResult> {
  const provider = detectProvider(opts.model);

  let key = apiKey;
  if (!key) {
    key =
      provider === "gemini"
        ? runtimeEnv("GEMINI_API_KEY")
        : runtimeEnv("DEEPSEEK_API_KEY");
  }
  if (!key) {
    throw new Error(
      `Missing API key for provider "${provider}". Set ${provider === "gemini" ? "GEMINI_API_KEY" : "DEEPSEEK_API_KEY"} env var.`,
    );
  }

  switch (provider) {
    case "gemini":
      return callGemini(key, opts);
    case "deepseek":
    default:
      return callDeepSeek(key, opts);
  }
}

/**
 * Extract JSON from raw content (handles both DeepSeek R1 and standard models).
 */
export function extractJSON(content: string): any {
  let cleaned = content.trim();
  // Strip reasoning tags (deepseek-reasoner)
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, "").trim();
  // Strip markdown fences
  cleaned = cleaned.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  // Find first { or [ to locate JSON
  const start = cleaned.indexOf("{") >= 0 ? cleaned.indexOf("{") : cleaned.indexOf("[");
  if (start === -1) throw new Error("No JSON found in response.");
  const end =
    cleaned.lastIndexOf("}") >= 0
      ? cleaned.lastIndexOf("}") + 1
      : cleaned.lastIndexOf("]") + 1;
  if (end <= start) throw new Error("Malformed JSON in response.");
  return JSON.parse(cleaned.slice(start, end));
}

/**
 * Strip reasoning tags from text content (for non-JSON responses from reasoner models).
 */
export function stripReasoningTags(content: string): string {
  return content.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, "").trim();
}
