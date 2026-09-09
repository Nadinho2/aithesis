/**
 * Decoupled notification dispatch.
 *
 * Feature code emits an *event*; this dispatcher fans it out to every channel
 * the user has active. Today only `email` is wired up. WhatsApp (Cloud API) and
 * in-app notifications slot in here later as extra channels — without touching
 * the feature code that emits the event.
 */

import { notifyToolCompleted, notifyToolFailed } from "./mail-helper";
import type { BrainPadiTool } from "./mail";

// ─── Event model ───────────────────────────────────────────────────────────

export type ToolName =
  | "thesis"
  | "proposal"
  | "assignment"
  | "exam"
  | "presentation"
  | "cv"
  | "side_hustle"
  | "seminar";

export type NotificationEvent =
  | {
      kind: "tool_completed";
      tool: ToolName;
      title?: string;
      downloadUrl?: string;
      aiScore?: number;
      plagiarismScore?: number;
      subject?: string;
      seminarType?: string;
    }
  | {
      kind: "tool_failed";
      tool: BrainPadiTool;
    };

// ─── Channels ──────────────────────────────────────────────────────────────

type ChannelId = "email" | "whatsapp";

type Channel = {
  id: ChannelId;
  deliver: (userId: string, event: NotificationEvent) => Promise<void>;
};

const emailChannel: Channel = {
  id: "email",
  async deliver(userId, event) {
    if (event.kind === "tool_completed") {
      await notifyToolCompleted(userId, event.tool, {
        title: event.title,
        downloadUrl: event.downloadUrl,
        aiScore: event.aiScore,
        plagiarismScore: event.plagiarismScore,
        subject: event.subject,
        seminarType: event.seminarType,
      });
    } else {
      await notifyToolFailed(userId, event.tool);
    }
  },
};

const whatsappChannel: Channel = {
  id: "whatsapp",
  async deliver() {
    // TODO(whatsapp): resolve the user's phone number and send via the WhatsApp
    // Cloud API. No-op for now — the channel is registered so feature code
    // already has a place to land when WhatsApp ships (Phase 4).
  },
};

const channels: Record<ChannelId, Channel> = {
  email: emailChannel,
  whatsapp: whatsappChannel,
};

// ─── Dispatch ──────────────────────────────────────────────────────────────

/**
 * Resolve which channels are active for a user.
 * Email is always on. WhatsApp (and later in-app) activate once we have a
 * resolved destination and the user has opted in — Phase 4.
 */
function activeChannels(_userId: string): ChannelId[] {
  return ["email"];
}

export async function dispatchNotification(
  userId: string,
  event: NotificationEvent,
): Promise<void> {
  const targets = activeChannels(userId).map((id) => channels[id]);
  await Promise.allSettled(targets.map((channel) => channel.deliver(userId, event)));
}
