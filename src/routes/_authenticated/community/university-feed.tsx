import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listCommunityPosts,
  createCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
  togglePostLike,
  listComments,
  addComment,
  updateCommunityComment,
  deleteCommunityComment,
  type CommunityPost,
  type CommunityComment,
  type PostVisibility,
} from "@/lib/community.functions";
import { getMyProfile } from "@/lib/profile.functions";
import {
  ArrowLeft,
  Send,
  Heart,
  MessageCircle,
  Users,
  Globe,
  Loader2,
  GraduationCap,
  Sparkles,
  Building2,
  BookOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/community/university-feed")({
  head: () => ({ meta: [{ title: "University Feed — Mybrainpadi" }] }),
  component: UniversityFeedPage,
});

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000;

function canEditNow(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < EDIT_WINDOW_MS;
}

function displayName(name: string | null, username: string | null): string {
  if (username) return `@${username}`;
  return name ?? "Student";
}

function avatarInitial(name: string | null, username: string | null): string {
  return (username ?? name ?? "U").charAt(0).toUpperCase();
}

function AudienceBadge({ visibility }: { visibility: PostVisibility }) {
  const meta: Record<PostVisibility, { label: string; Icon: typeof Globe }> = {
    all: { label: "Public", Icon: Globe },
    university: { label: "University", Icon: GraduationCap },
    department: { label: "Department", Icon: Building2 },
    course: { label: "Course", Icon: BookOpen },
  };
  const { label, Icon } = meta[visibility] ?? meta.all;
  return (
    <span className="inline-flex items-center gap-1 ml-2 text-ink/50">
      <Icon className="size-3" /> {label}
    </span>
  );
}

function PostCard({
  post,
  expanded,
  comments,
  commentDraft,
  onToggle,
  onLike,
  likePending,
  onCommentDraft,
  onComment,
  commentPending,
  onEditPost,
  onDeletePost,
  onEditComment,
  onDeleteComment,
  showUniversity,
  showReasons,
}: {
  post: CommunityPost;
  expanded: boolean;
  comments: CommunityComment[];
  commentDraft: string;
  onToggle: () => void;
  onLike: () => void;
  likePending: boolean;
  onCommentDraft: (v: string) => void;
  onComment: () => void;
  commentPending: boolean;
  onEditPost: (postId: string, body: string) => void;
  onDeletePost: (postId: string) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  showUniversity: boolean;
  showReasons: boolean;
}) {
  const [editingPost, setEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState(post.body);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");

  const editable = post.is_mine && canEditNow(post.created_at);

  function startEditPost() {
    setPostDraft(post.body);
    setEditingPost(true);
  }

  function startEditComment(c: CommunityComment) {
    setEditingCommentId(c.id);
    setCommentEditDraft(c.body);
  }

  return (
    <div className="bg-card border border-ink/10 rounded-sm p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-verde/10 text-verde-dark flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {avatarInitial(post.author_name, post.author_username)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-ink">
              {displayName(post.author_name, post.author_username)}
            </span>
            {post.author_department && (
              <span className="text-xs text-ink/40">· {post.author_department}</span>
            )}
          </div>
          <div className="text-xs text-ink/40 mt-0.5">
            {timeAgo(post.created_at)}
            {showUniversity && post.university && (
              <span className="inline-flex items-center gap-1 ml-2 text-ink/50">
                <GraduationCap className="size-3" /> {post.university}
              </span>
            )}
            {!showUniversity && <AudienceBadge visibility={post.visibility} />}
          </div>
        </div>

        {post.is_mine && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {editable && (
              <button
                onClick={startEditPost}
                aria-label="Edit post"
                className="size-7 rounded-sm flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 transition-colors"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => onDeletePost(post.id)}
              aria-label="Delete post"
              className="size-7 rounded-sm flex items-center justify-center text-ink/40 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {showReasons && post.reasons.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {post.reasons.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-bg text-amber-text"
            >
              <Sparkles className="size-3" /> {r}
            </span>
          ))}
        </div>
      )}

      {editingPost ? (
        <div className="mt-3">
          <textarea
            value={postDraft}
            onChange={(e) => setPostDraft(e.target.value)}
            rows={3}
            className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              onClick={() => setEditingPost(false)}
              className="px-3 py-1.5 text-sm text-ink/60 hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onEditPost(post.id, postDraft);
                setEditingPost(false);
              }}
              disabled={!postDraft.trim()}
              className="px-3 py-1.5 bg-ink text-bone rounded-sm text-sm disabled:opacity-50 hover:bg-sage transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink leading-relaxed mt-3 whitespace-pre-wrap break-words">
          {post.body}
        </p>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink/5">
        <button
          onClick={onLike}
          disabled={likePending}
          className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
            post.liked_by_me ? "text-verde-dark" : "text-ink/50 hover:text-ink"
          }`}
        >
          <Heart className={`size-4 ${post.liked_by_me ? "fill-current" : ""}`} />
          {post.like_count > 0 ? post.like_count : "Like"}
        </button>
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink transition-colors"
        >
          <MessageCircle className="size-4" />
          {post.comment_count > 0 ? post.comment_count : "Comment"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink/5">
          <div className="space-y-3 mb-3">
            {comments.length === 0 ? (
              <p className="text-xs text-ink/40 text-center py-2">No comments yet</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="size-7 rounded-full bg-ink/5 text-ink/60 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {avatarInitial(c.author_name, c.author_username)}
                  </div>
                  <div className="min-w-0 flex-1 bg-paper border border-ink/5 rounded-sm px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-ink/50 mb-0.5 flex-1">
                        {displayName(c.author_name, c.author_username)} · {timeAgo(c.created_at)}
                      </div>
                      {c.is_mine && (
                        <div className="flex items-center gap-1">
                          {canEditNow(c.created_at) && (
                            <button
                              onClick={() => startEditComment(c)}
                              aria-label="Edit comment"
                              className="size-6 rounded-sm flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 transition-colors"
                            >
                              <Pencil className="size-3" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteComment(c.id)}
                            aria-label="Delete comment"
                            className="size-6 rounded-sm flex items-center justify-center text-ink/40 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="mt-1">
                        <input
                          value={commentEditDraft}
                          onChange={(e) => setCommentEditDraft(e.target.value)}
                          className="w-full bg-paper border border-ink/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-sage"
                        />
                        <div className="flex items-center justify-end gap-2 mt-1.5">
                          <button
                            onClick={() => setEditingCommentId(null)}
                            className="text-xs text-ink/60 hover:text-ink transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              onEditComment(c.id, commentEditDraft);
                              setEditingCommentId(null);
                            }}
                            disabled={!commentEditDraft.trim()}
                            className="px-2.5 py-1 bg-ink text-bone rounded-sm text-xs disabled:opacity-50 hover:bg-sage transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink break-words">{c.body}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={commentDraft}
              onChange={(e) => onCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !commentPending && commentDraft.trim()) {
                  onComment();
                }
              }}
              placeholder="Write a comment…"
              className="flex-1 bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
            />
            <button
              onClick={onComment}
              disabled={commentPending || !commentDraft.trim()}
              className="px-3 py-2 bg-ink text-bone rounded-sm text-sm disabled:opacity-50 hover:bg-sage transition-colors inline-flex items-center gap-1.5"
            >
              {commentPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UniversityFeedPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listCommunityPosts);
  const createFn = useServerFn(createCommunityPost);
  const updatePostFn = useServerFn(updateCommunityPost);
  const deletePostFn = useServerFn(deleteCommunityPost);
  const likeFn = useServerFn(togglePostLike);
  const commentsFn = useServerFn(listComments);
  const addCommentFn = useServerFn(addComment);
  const updateCommentFn = useServerFn(updateCommunityComment);
  const deleteCommentFn = useServerFn(deleteCommunityComment);
  const getProfileFn = useServerFn(getMyProfile);

  const [scope, setScope] = useState<"for_you" | "university" | "department" | "course" | "all">(
    "for_you",
  );
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("all");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
  });

  const hasUniversity = !!profile?.university;
  const hasDepartment = !!profile?.department;
  const hasLevel = !!profile?.level;
  const effectiveScope: "for_you" | "university" | "department" | "course" | "all" =
    (scope === "university" && !hasUniversity) ||
    (scope === "department" && !hasDepartment) ||
    (scope === "course" && !hasLevel)
      ? "all"
      : scope;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["community-posts", effectiveScope],
    queryFn: () => listFn({ data: { scope: effectiveScope } }),
    refetchInterval: 20000,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["community-comments", expandedPostId],
    queryFn: () => commentsFn({ data: { post_id: expandedPostId! } }),
    enabled: !!expandedPostId,
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { body: draft, visibility } }),
    onSuccess: () => {
      setDraft("");
      setVisibility("all");
      qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const editPostMut = useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      updatePostFn({ data: { post_id: postId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-posts"] }),
    onError: (e) => toast.error(String(e)),
  });

  const deletePostMut = useMutation({
    mutationFn: (postId: string) => deletePostFn({ data: { post_id: postId } }),
    onSuccess: () => {
      setExpandedPostId(null);
      qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const likeMut = useMutation({
    mutationFn: (postId: string) => likeFn({ data: { post_id: postId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-posts"] }),
    onError: (e) => toast.error(String(e)),
  });

  const commentMut = useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      addCommentFn({ data: { post_id: postId, body } }),
    onSuccess: () => {
      setCommentDraft("");
      qc.invalidateQueries({ queryKey: ["community-comments"] });
      qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const editCommentMut = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateCommentFn({ data: { comment_id: commentId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-comments"] }),
    onError: (e) => toast.error(String(e)),
  });

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: string) => deleteCommentFn({ data: { comment_id: commentId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-comments"] });
      qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  function toggleComments(postId: string) {
    setExpandedPostId((prev) => (prev === postId ? null : postId));
    setCommentDraft("");
  }

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            aria-label="Back"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Community</h2>
            <p className="text-xs text-muted-foreground mt-0.5">University feed</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Community
            </div>
            <h1 className="font-serif text-3xl text-ink">University Feed</h1>
            <p className="text-ink/60 text-sm mt-1">
              Share updates, ask questions, and connect with your classmates.
            </p>
          </div>

          <div className="bg-card border border-ink/10 rounded-sm p-4 mb-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share something with your university…"
              rows={3}
              className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
            />
            <div className="flex items-center justify-between mt-3 gap-3">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                className="bg-paper border border-ink/15 rounded-sm px-2 py-2 text-sm focus:outline-none focus:border-sage"
              >
                <option value="all">Everyone</option>
                {hasUniversity && <option value="university">My university</option>}
                {hasDepartment && <option value="department">My department</option>}
                {hasLevel && <option value="course">My course</option>}
              </select>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !draft.trim()}
                className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {createMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Post
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setScope("for_you")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                effectiveScope === "for_you"
                  ? "bg-verde text-white border-verde"
                  : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
              }`}
            >
              <Sparkles className="size-3.5" /> For you
            </button>
            {hasUniversity && (
              <button
                onClick={() => setScope("university")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  effectiveScope === "university"
                    ? "bg-verde text-white border-verde"
                    : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
                }`}
              >
                <Users className="size-3.5" /> My university
              </button>
            )}
            {hasDepartment && (
              <button
                onClick={() => setScope("department")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  effectiveScope === "department"
                    ? "bg-verde text-white border-verde"
                    : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
                }`}
              >
                <Building2 className="size-3.5" /> Department
              </button>
            )}
            {hasLevel && (
              <button
                onClick={() => setScope("course")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  effectiveScope === "course"
                    ? "bg-verde text-white border-verde"
                    : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
                }`}
              >
                <BookOpen className="size-3.5" /> Course
              </button>
            )}
            <button
              onClick={() => setScope("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                effectiveScope === "all"
                  ? "bg-verde text-white border-verde"
                  : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
              }`}
            >
              <Globe className="size-3.5" /> All universities
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-ink/60 py-12 justify-center">
              <Loader2 className="size-5 animate-spin" /> Loading feed…
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-8 text-center">
              <Users className="size-8 text-sage mx-auto mb-3" />
              <h2 className="font-serif text-xl text-ink mb-1">No posts yet</h2>
              <p className="text-sm text-ink/60">
                Be the first to share something with your classmates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p: CommunityPost) => (
                <PostCard
                  key={p.id}
                  post={p}
                  expanded={expandedPostId === p.id}
                  comments={(comments ?? []) as CommunityComment[]}
                  commentDraft={commentDraft}
                  onToggle={() => toggleComments(p.id)}
                  onLike={() => likeMut.mutate(p.id)}
                  likePending={likeMut.isPending}
                  onCommentDraft={setCommentDraft}
                  onComment={() => commentMut.mutate({ postId: p.id, body: commentDraft })}
                  commentPending={commentMut.isPending}
                  onEditPost={(postId, body) => editPostMut.mutate({ postId, body })}
                  onDeletePost={(postId) => deletePostMut.mutate(postId)}
                  onEditComment={(commentId, body) =>
                    editCommentMut.mutate({ commentId, body })
                  }
                  onDeleteComment={(commentId) => deleteCommentMut.mutate(commentId)}
                  showUniversity={effectiveScope === "all"}
                  showReasons={effectiveScope === "for_you"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
