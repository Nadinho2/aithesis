import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";

export const listChats = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;

    const { data, error } = await supabase
      .from("chats")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("listChats error:", error);
      return [];
    }

    return (data ?? []) as { id: string; title: string; updated_at: string }[];
  });

export const getChatMessages = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => ({ chatId: input as string }))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as any;
    const { chatId } = data as { chatId: string };

    const { data: msgs, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("getChatMessages error:", error);
      return [];
    }

    return (msgs ?? []) as {
      id: string;
      chat_id: string;
      role: string;
      content: string;
      created_at: string;
    }[];
  });
