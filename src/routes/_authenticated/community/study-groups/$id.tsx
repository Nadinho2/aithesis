import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getStudyGroup,
  requestToJoin,
  respondToJoinRequest,
  leaveGroup,
  deleteStudyGroup,
  listGroupPosts,
  createGroupPost,
  listGroupComments,
  addGroupComment,
  listGroupFiles,
  uploadGroupFile,
  deleteGroupFile,
  inviteToGroup,
  type StudyGroupPost,
  type StudyGroupComment,
  type StudyGroupFile,
  type StudyGroupMember,
} from "@/lib/study-groups.functions";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Users,
  MessageCircle,
  Loader2,
  GraduationCap,
  Building2,
  BookOpen,
  Check,
  Clock,
  Paperclip,
  Download,
  Trash2,
  FileText,
  Plus,
  UserPlus,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useClerk } from "@clerk/clerk-react";

export const Route = createFileRoute("/_authenticated/community/study-groups/$id")({
  head: () => ({ meta: [{ title: "Study Group — Mybrainpadi" }] }),
  component: StudyGroupDetailPage,
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Tag({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-paper border border-ink/10 text-ink/60">
      <Icon className="size-3" /> {label}
    </span>
  );
}

function StudyGroupDetailPage() {
  const { id } = Route.useParams();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useClerk();
  const currentUserId = user?.id;

  const getFn = useServerFn(getStudyGroup);
  const joinFn = useServerFn(requestToJoin);
  const respondFn = useServerFn(respondToJoinRequest);
  const leaveFn = useServerFn(leaveGroup);
  const deleteFn = useServerFn(deleteStudyGroup);
  const postsFn = useServerFn(listGroupPosts);
  const createPostFn = useServerFn(createGroupPost);
  const commentsFn = useServerFn(listGroupComments);
  const addCommentFn = useServerFn(addGroupComment);
  const filesFn = useServerFn(listGroupFiles);
  const uploadFn = useServerFn(uploadGroupFile);
  const deleteFileFn = useServerFn(deleteGroupFile);
  const inviteFn = useServerFn(inviteToGroup);

  const [tab, setTab] = useState<"feed" | "members" | "files">("feed");
  const [postDraft, setPostDraft] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: detail, isLoading } = useQuery({
    queryKey: ["study-group", id],
    queryFn: () => getFn({ data: { group_id: id } }),
    refetchInterval: 15000,
  });

  const isApproved =
    detail?.my_status === "approved" || detail?.my_status === "creator";

  const { data: posts = [] } = useQuery({
    queryKey: ["study-group-posts", id],
    queryFn: () => postsFn({ data: { group_id: id } }),
    enabled: isApproved,
    refetchInterval: 20000,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["study-group-files", id],
    queryFn: () => filesFn({ data: { group_id: id } }),
    enabled: tab === "files" && isApproved,
    refetchInterval: 30000,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["study-group-comments", expandedPostId],
    queryFn: () => commentsFn({ data: { post_id: expandedPostId! } }),
    enabled: !!expandedPostId,
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["study-group", id] });
    qc.invalidateQueries({ queryKey: ["study-groups"] });
    qc.invalidateQueries({ queryKey: ["study-group-posts", id] });
    qc.invalidateQueries({ queryKey: ["study-group-files", id] });
  }

  const joinMut = useMutation({
    mutationFn: () => joinFn({ data: { group_id: id } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Request sent. The creator will review it.");
    },
    onError: (e) => toast.error(String(e)),
  });

  const respondMut = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: "approve" | "decline" }) =>
      respondFn({ data: { group_id: id, user_id: userId, action } }),
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error(String(e)),
  });

  const leaveMut = useMutation({
    mutationFn: () => leaveFn({ data: { group_id: id } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("You left the group.");
      navigate({ to: "/community/study-groups" });
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { group_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-groups"] });
      toast.success("Group deleted.");
      navigate({ to: "/community/study-groups" });
    },
    onError: (e) => toast.error(String(e)),
  });

  const postMut = useMutation({
    mutationFn: () => createPostFn({ data: { group_id: id, body: postDraft } }),
    onSuccess: () => {
      setPostDraft("");
      qc.invalidateQueries({ queryKey: ["study-group-posts", id] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const commentMut = useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      addCommentFn({ data: { post_id: postId, body } }),
    onSuccess: () => {
      setCommentDraft("");
      qc.invalidateQueries({ queryKey: ["study-group-comments"] });
      qc.invalidateQueries({ queryKey: ["study-group-posts", id] });
    },
    onError: (e) => toast.error(String(e)),
  });

  async function handleFileUpload(f: File) {
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const b64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(f);
      });
      await uploadFn({
        data: { group_id: id, file_name: f.name, mime_type: f.type || "application/octet-stream", base64: b64 },
      });
      qc.invalidateQueries({ queryKey: ["study-group-files", id] });
      toast.success("File uploaded.");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const deleteFileMut = useMutation({
    mutationFn: (fileId: string) => deleteFileFn({ data: { file_id: fileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-group-files", id] }),
    onError: (e) => toast.error(String(e)),
  });

  const inviteMut = useMutation({
    mutationFn: (email: string) => inviteFn({ data: { group_id: id, email } }),
    onSuccess: () => {
      setInviteEmail("");
      invalidateAll();
      toast.success("Invitation sent.");
    },
    onError: (e) => toast.error(String(e)),
  });

  function toggleComments(postId: string) {
    setExpandedPostId((prev) => (prev === postId ? null : postId));
    setCommentDraft("");
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-ink/60 py-20 justify-center">
        <Loader2 className="size-5 animate-spin" /> Loading group…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-ink/60">
        Study group not found.
      </div>
    );
  }

  const { group, members, pending, my_status, is_creator, member_count, invitations } = detail;

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/community/study-groups" })}
            aria-label="Back"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Study group</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{group.name}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          {!isMobile && (
            <button
              onClick={() => navigate({ to: "/community/study-groups" })}
              className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink mb-4"
            >
              <ArrowLeft className="size-4" /> All study groups
            </button>
          )}

          <div className="mb-5">
            <h1 className="font-serif text-3xl text-ink">{group.name}</h1>
            {group.description && (
              <p className="text-ink/60 text-sm mt-2 whitespace-pre-wrap">{group.description}</p>
            )}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-ink/50 mr-1">
                <Users className="size-3.5" />
                {member_count} {member_count === 1 ? "member" : "members"}
              </span>
              {group.university && <Tag icon={GraduationCap} label={group.university} />}
              {group.department && <Tag icon={Building2} label={group.department} />}
              {group.level && <Tag icon={BookOpen} label={group.level} />}
            </div>
          </div>

          <div className="mb-5 flex items-center gap-2 flex-wrap">
            {my_status === null && (
              <button
                onClick={() => joinMut.mutate()}
                disabled={joinMut.isPending}
                className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {joinMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Request to join
              </button>
            )}
            {my_status === "pending" && (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-medium bg-amber-bg text-amber-text">
                <Clock className="size-4" /> Request pending
              </span>
            )}
            {my_status === "approved" && (
              <button
                onClick={() => {
                  if (confirm("Leave this study group?")) leaveMut.mutate();
                }}
                disabled={leaveMut.isPending}
                className="px-4 py-2 border border-ink/20 text-ink/70 rounded-sm text-sm font-medium hover:bg-ink/5 transition-colors"
              >
                Leave group
              </button>
            )}
            {is_creator && (
              <button
                onClick={() => {
                  if (confirm("Delete this study group? This cannot be undone.")) deleteMut.mutate();
                }}
                disabled={deleteMut.isPending}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-sm text-sm font-medium hover:bg-red-50 transition-colors inline-flex items-center gap-2"
              >
                <Trash2 className="size-4" /> Delete group
              </button>
            )}
          </div>

          {is_creator && pending.length > 0 && (
            <div className="bg-card border border-ink/10 rounded-sm p-4 mb-5">
              <h3 className="font-medium text-ink mb-3">
                Join requests ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map((m: StudyGroupMember) => (
                  <div key={m.user_id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-ink/5 text-ink/60 flex items-center justify-center text-xs font-semibold">
                        {(m.full_name ?? "U").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-ink">{m.full_name ?? "Student"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => respondMut.mutate({ userId: m.user_id, action: "approve" })}
                        disabled={respondMut.isPending}
                        className="px-3 py-1.5 bg-verde text-white rounded-sm text-xs font-medium hover:bg-verde-dark transition-colors inline-flex items-center gap-1.5"
                      >
                        <Check className="size-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => respondMut.mutate({ userId: m.user_id, action: "decline" })}
                        disabled={respondMut.isPending}
                        className="px-3 py-1.5 border border-ink/20 text-ink/60 rounded-sm text-xs font-medium hover:bg-ink/5"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 border-b border-ink/10">
            {[
              { key: "feed", label: "Feed", icon: MessageCircle },
              { key: "members", label: "Members", icon: Users },
              { key: "files", label: "Files", icon: Paperclip },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    active
                      ? "border-verde text-verde-dark"
                      : "border-transparent text-ink/50 hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === "feed" && (
            <div className="space-y-4">
              {isApproved ? (
                <div className="bg-card border border-ink/10 rounded-sm p-4">
                  <textarea
                    value={postDraft}
                    onChange={(e) => setPostDraft(e.target.value)}
                    placeholder="Share an update, or mention @PADI for help…"
                    rows={3}
                    className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
                  />
                  <div className="flex items-center justify-end mt-3">
                    <button
                      onClick={() => postMut.mutate()}
                      disabled={postMut.isPending || !postDraft.trim()}
                      className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {postMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Post
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink/50 bg-card border border-ink/10 rounded-sm p-4">
                  Join the group to participate in the feed.
                </p>
              )}

              {posts.length === 0 ? (
                <div className="bg-card border border-ink/10 rounded-sm p-8 text-center">
                  <MessageCircle className="size-8 text-sage mx-auto mb-3" />
                  <p className="text-sm text-ink/60">No posts yet.</p>
                </div>
              ) : (
                posts.map((p: StudyGroupPost) => (
                  <div key={p.id} className="bg-card border border-ink/10 rounded-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-full bg-verde/10 text-verde-dark flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {(p.author_name ?? "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-ink">
                            {p.author_name ?? "Student"}
                          </span>
                        </div>
                        <div className="text-xs text-ink/40 mt-0.5">{timeAgo(p.created_at)}</div>
                        <p className="text-sm text-ink leading-relaxed mt-3 whitespace-pre-wrap break-words">
                          {p.body}
                        </p>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink/5">
                          <button
                            onClick={() => toggleComments(p.id)}
                            className="inline-flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink transition-colors"
                          >
                            <MessageCircle className="size-4" />
                            {p.comment_count > 0 ? p.comment_count : "Comment"}
                          </button>
                        </div>

                        {expandedPostId === p.id && (
                          <div className="mt-3 pt-3 border-t border-ink/5">
                            <div className="space-y-3 mb-3">
                              {comments.length === 0 ? (
                                <p className="text-xs text-ink/40 text-center py-2">No comments yet</p>
                              ) : (
                                comments.map((c: StudyGroupComment) => (
                                  <div key={c.id} className="flex items-start gap-2">
                                    {c.is_padi ? (
                                      <div className="size-7 rounded-full bg-verde text-white flex items-center justify-center flex-shrink-0">
                                        <Sparkles className="size-3.5" />
                                      </div>
                                    ) : (
                                      <div className="size-7 rounded-full bg-ink/5 text-ink/60 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                        {(c.author_name ?? "U").charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div
                                      className={`min-w-0 flex-1 rounded-sm px-3 py-2 ${
                                        c.is_padi
                                          ? "bg-verde/5 border border-verde/20"
                                          : "bg-paper border border-ink/5"
                                      }`}
                                    >
                                      <div className="text-xs mb-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span className={c.is_padi ? "font-semibold text-verde-dark" : "text-ink/50"}>
                                          {c.author_name ?? "Student"}
                                        </span>
                                        {c.is_padi && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-verde/10 text-verde-dark text-[10px] font-semibold">
                                            <Sparkles className="size-2.5" /> PADI
                                          </span>
                                        )}
                                        <span className="text-ink/40">· {timeAgo(c.created_at)}</span>
                                      </div>
                                      <p className="text-sm text-ink break-words whitespace-pre-wrap">{c.body}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            {isApproved && (
                              <div className="flex items-center gap-2">
                                <input
                                  value={commentDraft}
                                  onChange={(e) => setCommentDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !commentMut.isPending && commentDraft.trim()) {
                                      commentMut.mutate({ postId: p.id, body: commentDraft });
                                    }
                                  }}
                                  placeholder="Reply… mention @PADI for help"
                                  className="flex-1 bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                                />
                                <button
                                  onClick={() => commentMut.mutate({ postId: p.id, body: commentDraft })}
                                  disabled={commentMut.isPending || !commentDraft.trim()}
                                  className="px-3 py-2 bg-ink text-bone rounded-sm text-sm disabled:opacity-50 hover:bg-sage transition-colors inline-flex items-center gap-1.5"
                                >
                                  {commentMut.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Send className="size-4" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-3">
              {!isApproved ? (
                <p className="text-sm text-ink/50 bg-card border border-ink/10 rounded-sm p-4">
                  Join the group to view members.
                </p>
              ) : (
                <>
                  <div className="bg-card border border-ink/10 rounded-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="size-4 text-sage" />
                      <span className="text-sm font-medium text-ink">Invite a member</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter their email address"
                        className="flex-1 bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                      />
                      <button
                        onClick={() => inviteMut.mutate(inviteEmail)}
                        disabled={inviteMut.isPending || !inviteEmail.trim()}
                        className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {inviteMut.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Mail className="size-4" />
                        )}
                        Invite
                      </button>
                    </div>
                    <p className="text-xs text-ink/40 mt-2">
                      They'll get an email and can accept or reject from their dashboard.
                    </p>
                  </div>

                  {invitations && invitations.length > 0 && (
                    <div className="space-y-2">
                      {invitations.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="bg-card border border-ink/10 rounded-sm p-3 flex items-center gap-3"
                        >
                          <div className="size-9 rounded-full bg-ink/5 text-ink/60 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {(inv.invitee_name ?? inv.email ?? "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-ink font-medium">
                              {inv.invitee_name ?? inv.email ?? "Invited user"}
                            </div>
                            {inv.email && (
                              <div className="text-xs text-ink/40 truncate">{inv.email}</div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-bg text-amber-text text-[11px] font-medium flex-shrink-0">
                            <Clock className="size-3" /> Pending
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {members.map((m: StudyGroupMember) => (
                    <div
                      key={m.user_id}
                      className="bg-card border border-ink/10 rounded-sm p-3 flex items-center gap-3"
                    >
                      <div className="size-9 rounded-full bg-verde/10 text-verde-dark flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {(m.full_name ?? "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-ink font-medium">{m.full_name ?? "Student"}</div>
                        <div className="text-xs text-ink/40">
                          {m.role === "creator" ? "Creator" : "Member"}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === "files" && (
            <div className="space-y-4">
              {isApproved ? (
                <div className="bg-card border border-ink/10 rounded-sm p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                      Upload file
                    </button>
                    <p className="text-xs text-ink/40">Max 10 MB · files auto-delete after 4 months</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                    className="hidden"
                  />
                </div>
              ) : (
                <p className="text-sm text-ink/50 bg-card border border-ink/10 rounded-sm p-4">
                  Join the group to view and upload files.
                </p>
              )}

              {files.length === 0 ? (
                <div className="bg-card border border-ink/10 rounded-sm p-8 text-center">
                  <FileText className="size-8 text-sage mx-auto mb-3" />
                  <p className="text-sm text-ink/60">No files shared yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((f: StudyGroupFile) => (
                    <div key={f.id} className="bg-card border border-ink/10 rounded-sm p-3 flex items-center gap-3">
                      <FileText className="size-5 text-sage flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-ink font-medium truncate">{f.file_name}</div>
                        <div className="text-xs text-ink/40">
                          {formatBytes(f.size_bytes)} · {f.uploader_name ?? "Student"} · {timeAgo(f.created_at)}
                        </div>
                      </div>
                      {f.download_url && (
                        <a
                          href={f.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-ink/50 hover:text-verde-dark transition-colors"
                          title="Download"
                        >
                          <Download className="size-4" />
                        </a>
                      )}
                      {(is_creator || f.uploader_id === currentUserId) && (
                        <button
                          onClick={() => deleteFileMut.mutate(f.id)}
                          disabled={deleteFileMut.isPending}
                          className="p-2 text-ink/50 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
