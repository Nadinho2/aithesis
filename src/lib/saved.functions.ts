import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export type SavedItemType = "past_question" | "subject" | "study_plan" | "learning_path" | "micro_course";

export interface SavedItem {
  id: string;
  item_type: SavedItemType;
  item_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

const ITEM_TYPES = ["past_question", "subject", "study_plan", "learning_path", "micro_course"] as const;

export const getSavedItems = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("saved_items")
      .select("id, item_type, item_id, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SavedItem[];
  });

const SaveInput = z.object({
  item_type: z.enum(ITEM_TYPES),
  item_id: z.string().min(1).max(500),
  metadata: z.record(z.any()).default({}),
});

export const saveItem = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase.from("saved_items").upsert(
      {
        user_id: userId,
        item_type: data.item_type,
        item_id: data.item_id,
        metadata: data.metadata,
      },
      { onConflict: "user_id,item_type,item_id" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

const UnsaveInput = z.object({
  item_type: z.enum(ITEM_TYPES),
  item_id: z.string().min(1).max(500),
});

export const unsaveItem = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => UnsaveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_type", data.item_type)
      .eq("item_id", data.item_id);
    if (error) throw new Error(error.message);
    return { saved: false };
  });
