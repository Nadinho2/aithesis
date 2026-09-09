import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export type PostVisibility = "all" | "university" | "department" | "course";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  author_id: string;
  university: string | null;
  body: string;
  created_at: string;
  author_name: string | null;
  author_username: string | null;
  author_department: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  score: number;
  reasons: string[];
  visibility: PostVisibility;
  is_mine: boolean;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_username: string | null;
  is_mine: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchAuthors(
  supabase: any,
  userIds: string[],
): Promise<
  Map<
    string,
    { full_name: string | null; username: string | null; department: string | null; level: string | null }
  >
> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<
    string,
    { full_name: string | null; username: string | null; department: string | null; level: string | null }
  >();
  if (!unique.length) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, department, level")
    .in("id", unique);

  if (!error) {
    for (const p of data ?? []) {
      map.set(p.id, {
        full_name: p.full_name ?? null,
        username: p.username ?? null,
        department: p.department ?? null,
        level: p.level ?? null,
      });
    }
  }

  // Backfill missing usernames from Clerk in one bulk call, then persist.
  const missing = unique.filter((id) => !map.get(id)?.username);
  if (missing.length) {
    try {
      const clerkSecretKey = runtimeEnv("CLERK_SECRET_KEY");
      if (clerkSecretKey) {
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey: clerkSecretKey });
        const res = await clerk.users.getUserList({ userId: missing, limit: missing.length });
        const patches: Array<Record<string, any>> = [];

        for (const u of res.data ?? []) {
          const username = u.username ?? null;
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null;
          const existing = map.get(u.id) ?? {
            full_name: null,
            username: null,
            department: null,
            level: null,
          };

          const patch: Record<string, any> = { id: u.id };
          if (username && !existing.username) {
            patch.username = username;
            existing.username = username;
          }
          if (fullName && !existing.full_name) {
            patch.full_name = fullName;
            existing.full_name = fullName;
          }
          map.set(u.id, existing);
          if (Object.keys(patch).length > 1) patches.push(patch);
        }

        if (patches.length) {
          await supabase.from("profiles").upsert(patches, { onConflict: "id" });
        }
      }
    } catch {
      // Clerk unavailable — keep whatever profile data we already have.
    }
  }

  return map;
}

function isVisibleTo(post: any, profile: any): boolean {
  const visibility = (post.visibility ?? "all") as PostVisibility;
  if (visibility === "all") return true;
  if (!profile?.university || post.university !== profile.university) return false;
  if (visibility === "university") return true;
  if (visibility === "department") return post.department === profile.department;
  if (visibility === "course") return post.level === profile.level;
  return false;
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export const listCommunityPosts = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ scope: z.enum(["for_you", "university", "department", "course", "all"]).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const scope = data.scope ?? "for_you";

    const { data: profile } = await supabase
      .from("profiles")
      .select("university, department, level")
      .eq("id", userId)
      .maybeSingle();

    let q = supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (scope === "university" && profile?.university) {
      q = q.eq("university", profile.university);
    } else if (scope === "department" && profile?.department) {
      q = q.eq("department", profile.department);
    } else if (scope === "course" && profile?.level) {
      q = q.eq("level", profile.level);
    } else if (scope === "all") {
      q = q.eq("visibility", "all");
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const posts = ((rows ?? []) as any[]).filter(
      (r) => scope === "all" || isVisibleTo(r, profile),
    );
    const postIds = posts.map((r) => r.id);

    let likedByMe = new Set<string>();
    const likeCounts = new Map<string, number>();
    const commentCounts = new Map<string, number>();

    if (postIds.length > 0) {
      const [myLikesRes, likeRowsRes, commentRowsRes] = await Promise.all([
        supabase
          .from("community_likes")
          .select("post_id")
          .in("post_id", postIds)
          .eq("user_id", userId),
        supabase.from("community_likes").select("post_id").in("post_id", postIds),
        supabase.from("community_comments").select("post_id").in("post_id", postIds),
      ]);

      likedByMe = new Set((myLikesRes.data ?? []).map((l: any) => l.post_id));
      for (const l of likeRowsRes.data ?? []) {
        likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1);
      }
      for (const c of commentRowsRes.data ?? []) {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
      }
    }

    const authors = await fetchAuthors(
      supabase,
      posts.map((r) => r.author_id),
    );

    const result = posts.map((r) => {
      const author = authors.get(r.author_id);
      const reasons: string[] = [];
      let score = 0;

      if (scope === "for_you") {
        if (
          profile?.university &&
          r.university &&
          r.university === profile.university
        ) {
          score += 3;
          reasons.push("Same university");
        }
        if (
          profile?.department &&
          author?.department &&
          author.department === profile.department
        ) {
          score += 3;
          reasons.push("Same department");
        }
        if (profile?.level && author?.level && author.level === profile.level) {
          score += 2;
          reasons.push("Same level");
        }
      }

      return {
        id: r.id,
        author_id: r.author_id,
        university: r.university ?? null,
        body: r.body,
        created_at: r.created_at,
        author_name: author?.full_name ?? null,
        author_username: author?.username ?? null,
        author_department: author?.department ?? null,
        like_count: likeCounts.get(r.id) ?? 0,
        comment_count: commentCounts.get(r.id) ?? 0,
        liked_by_me: likedByMe.has(r.id),
        score,
        reasons,
        visibility: r.visibility ?? "all",
        is_mine: r.author_id === userId,
      } as CommunityPost;
    });

    if (scope === "for_you") {
      result.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    return result;
  });

const CreatePostInput = z.object({
  body: z.string().min(1).max(2000),
  visibility: z.enum(["all", "university", "department", "course"]).default("all"),
});

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CreatePostInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("university, department, level")
      .eq("id", userId)
      .maybeSingle();

    if (data.visibility === "university" && !profile?.university) {
      throw new Error("Set your university before posting to it.");
    }
    if (data.visibility === "department" && !profile?.department) {
      throw new Error("Set your department before posting to it.");
    }
    if (data.visibility === "course" && !profile?.level) {
      throw new Error("Set your course/level before posting to it.");
    }

    const row = {
      author_id: userId,
      university: profile?.university ?? null,
      department: profile?.department ?? null,
      level: profile?.level ?? null,
      body: data.body.trim(),
      visibility: data.visibility,
    };

    const { error } = await supabase.from("community_posts").insert(row);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const updateCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ post_id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: post, error } = await supabase
      .from("community_posts")
      .select("author_id, created_at")
      .eq("id", data.post_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post not found.");
    if (post.author_id !== userId) throw new Error("You can only edit your own posts.");
    if (Date.now() - new Date(post.created_at).getTime() > 6 * 60 * 60 * 1000) {
      throw new Error("You can only edit a post within 6 hours of posting.");
    }

    const { error: upErr } = await supabase
      .from("community_posts")
      .update({ body: data.body.trim() })
      .eq("id", data.post_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

export const deleteCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: post } = await supabase
      .from("community_posts")
      .select("author_id")
      .eq("id", data.post_id)
      .maybeSingle();
    if (!post) throw new Error("Post not found.");
    if (post.author_id !== userId) throw new Error("You can only delete your own posts.");

    const { error } = await supabase.from("community_posts").delete().eq("id", data.post_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ─── Likes ──────────────────────────────────────────────────────────────────

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: existing } = await supabase
      .from("community_likes")
      .select("post_id")
      .eq("post_id", data.post_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("community_likes")
        .delete()
        .eq("post_id", data.post_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { liked: false };
    }

    const { error } = await supabase
      .from("community_likes")
      .insert({ post_id: data.post_id, user_id: userId });
    if (error) throw new Error(error.message);
    return { liked: true };
  });

// ─── Comments ───────────────────────────────────────────────────────────────

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: rows, error } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", data.post_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const authors = await fetchAuthors(
      supabase,
      (rows ?? []).map((r: any) => r.author_id),
    );

    return (rows ?? []).map(
      (r: any) =>
        ({
          id: r.id,
          post_id: r.post_id,
          author_id: r.author_id,
          body: r.body,
          created_at: r.created_at,
          author_name: authors.get(r.author_id)?.full_name ?? null,
          author_username: authors.get(r.author_id)?.username ?? null,
          is_mine: r.author_id === userId,
        }) as CommunityComment,
    );
  });

const AddCommentInput = z.object({
  post_id: z.string().uuid(),
  body: z.string().min(1).max(1000),
});

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AddCommentInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { error } = await supabase.from("community_comments").insert({
      post_id: data.post_id,
      author_id: userId,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const updateCommunityComment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ comment_id: z.string().uuid(), body: z.string().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: comment } = await supabase
      .from("community_comments")
      .select("author_id, created_at")
      .eq("id", data.comment_id)
      .maybeSingle();
    if (!comment) throw new Error("Comment not found.");
    if (comment.author_id !== userId) throw new Error("You can only edit your own comments.");
    if (Date.now() - new Date(comment.created_at).getTime() > 6 * 60 * 60 * 1000) {
      throw new Error("You can only edit a comment within 6 hours of posting.");
    }

    const { error } = await supabase
      .from("community_comments")
      .update({ body: data.body.trim() })
      .eq("id", data.comment_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const deleteCommunityComment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ comment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: comment } = await supabase
      .from("community_comments")
      .select("author_id")
      .eq("id", data.comment_id)
      .maybeSingle();
    if (!comment) throw new Error("Comment not found.");
    if (comment.author_id !== userId) throw new Error("You can only delete your own comments.");

    const { error } = await supabase.from("community_comments").delete().eq("id", data.comment_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
