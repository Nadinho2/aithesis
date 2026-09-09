import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@clerk/clerk-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getMyMentorProfile,
  listMyMentorship,
  respondMentorshipRequest,
  listMessages,
  sendMessage,
  type MentorshipRequest,
  type MentorshipMessage,
} from "@/lib/mentorship.functions";
import {
  ArrowLeft,
  Loader2,
  Check,
  X,
  MessageSquare,
  UserSearch,
  Send,
  Handshake,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mentor/my-mentorship")({
  head: () => ({ meta: [{ title: "My Mentorship — Mybrainpadi" }] }),
  component: MyMentorshipPage,
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-bg text-amber-text",
    accepted: "bg-verde-light text-verde-dark",
    declined: "bg-ink/10 text-ink/60",
    completed: "bg-ink/10 text-ink/60",
    cancelled: "bg-ink/10 text-ink/60",
  };
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? "bg-ink/10 text-ink/60"}`}
    >
      {status}
    </span>
  );
}

function MyMentorshipPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId } = useAuth();

  const mentorProfileFn = useServerFn(getMyMentorProfile);
  const listFn = useServerFn(listMyMentorship);
  const respondFn = useServerFn(respondMentorshipRequest);
  const listMsgFn = useServerFn(listMessages);
  const sendMsgFn = useServerFn(sendMessage);

  const [activeRequest, setActiveRequest] = useState<MentorshipRequest | null>(null);
  const [draft, setDraft] = useState("");

  const { data: myMentor } = useQuery({
    queryKey: ["my-mentor-profile"],
    queryFn: () => mentorProfileFn(),
  });

  const { data: m = { outgoing: [], incoming: [], connections: [] }, isLoading } =
    useQuery({
      queryKey: ["my-mentorship"],
      queryFn: () => listFn(),
    });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["mentorship-messages", activeRequest?.id],
    queryFn: () => listMsgFn({ data: { request_id: activeRequest!.id } }),
    enabled: !!activeRequest,
    refetchInterval: activeRequest ? 5000 : false,
  });

  const respondMut = useMutation({
    mutationFn: (v: { request_id: string; action: "accept" | "decline" }) =>
      respondFn({ data: v }),
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["my-mentorship"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const sendMut = useMutation({
    mutationFn: () => sendMsgFn({ data: { request_id: activeRequest!.id, body: draft } }),
    onSuccess: () => {
      setDraft("");
      refetchMessages();
    },
    onError: (e) => toast.error(String(e)),
  });

  const otherName = activeRequest
    ? activeRequest.mentee_id === userId
      ? activeRequest.mentor_name
      : activeRequest.mentee_name
    : null;

  const hasAnything =
    !!myMentor || m.outgoing.length > 0 || m.incoming.length > 0 || m.connections.length > 0;

  const incomingPending = m.incoming.filter((r: MentorshipRequest) => r.status === "pending");

  // ─── Thread view ─────────────────────────────────────────
  if (activeRequest) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 sm:px-6 py-3 border-b border-ink/10 bg-white flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setActiveRequest(null)}
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-ink truncate">
              {otherName ?? "Conversation"}
            </h2>
            {activeRequest.topic && (
              <p className="text-xs text-muted-foreground truncate">{activeRequest.topic}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-ink/50 mt-8">
              No messages yet — say hello to start the conversation.
            </p>
          ) : (
            messages.map((msg: MentorshipMessage) => {
              const mine = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-sm text-sm ${
                      mine ? "bg-ink text-bone" : "bg-card border border-ink/10 text-ink"
                    }`}
                  >
                    {!mine && (
                      <div className="text-[10px] font-bold text-verde-dark mb-0.5">
                        {msg.sender_name ?? "Them"}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-ink/10 bg-white flex-shrink-0 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && draft.trim() && !sendMut.isPending) {
                sendMut.mutate();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          />
          <button
            onClick={() => sendMut.mutate()}
            disabled={sendMut.isPending || !draft.trim()}
            className="size-10 rounded-sm bg-ink text-bone flex items-center justify-center hover:bg-sage transition-colors disabled:opacity-50"
            aria-label="Send"
          >
            {sendMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard view ──────────────────────────────────────
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
            <h2 className="font-serif text-lg font-bold text-ink">Mentor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">My mentorship</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Mentorship
            </div>
            <h1 className="font-serif text-3xl text-ink">My Mentorship</h1>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-ink/60 py-12 justify-center">
              <Loader2 className="size-5 animate-spin" /> Loading…
            </div>
          ) : !hasAnything ? (
            <div className="bg-card border border-ink/10 rounded-sm p-8 text-center">
              <Handshake className="size-8 text-sage mx-auto mb-3" />
              <h2 className="font-serif text-xl text-ink mb-1">Start your journey</h2>
              <p className="text-sm text-ink/60 mb-5 max-w-md mx-auto">
                Find a mentor to guide you, or offer your own experience as a mentor.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/mentor/find"
                  className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2"
                >
                  <UserSearch className="size-4" /> Find a mentor
                </Link>
                <Link
                  to="/mentor/become-a-mentor"
                  className="px-4 py-2 border border-ink/20 text-ink rounded-sm text-sm font-medium hover:bg-ink/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Handshake className="size-4" /> Become a mentor
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Mentor status */}
              {myMentor && (
                <section className="bg-card border border-ink/10 rounded-sm p-5">
                  <h2 className="font-serif text-lg text-ink mb-2">Your mentor profile</h2>
                  <div className="flex items-center gap-3 mb-3">
                    <StatusBadge status={myMentor.status} />
                    <p className="text-xs text-ink/60">
                      {myMentor.status === "pending" &&
                        "Your application is awaiting admin approval."}
                      {myMentor.status === "approved" &&
                        "You're listed in the mentor directory."}
                      {myMentor.status === "rejected" &&
                        "Your application was declined. You can re-apply with an updated profile."}
                      {myMentor.status === "paused" && "Your profile is paused."}
                    </p>
                  </div>
                  <div className="text-sm text-ink/70">
                    <p className="font-medium">{myMentor.headline}</p>
                    {myMentor.bio && (
                      <p className="text-xs text-ink/60 mt-1 line-clamp-3">{myMentor.bio}</p>
                    )}
                  </div>
                  <Link
                    to="/mentor/become-a-mentor"
                    className="inline-block mt-3 text-xs font-medium text-verde-dark hover:underline"
                  >
                    Edit profile
                  </Link>
                </section>
              )}

              {/* Incoming requests (as mentor) */}
              {myMentor && incomingPending.length > 0 && (
                <section>
                  <h2 className="font-serif text-lg text-ink mb-3">
                    Incoming requests ({incomingPending.length})
                  </h2>
                  <div className="space-y-3">
                    {incomingPending.map((r: MentorshipRequest) => (
                      <div
                        key={r.id}
                        className="bg-card border border-ink/10 rounded-sm p-4"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="font-medium text-ink text-sm">
                            {r.mentee_name ?? "A student"}
                          </p>
                          <StatusBadge status={r.status} />
                        </div>
                        {r.topic && (
                          <p className="text-sm text-verde-dark font-medium mb-1">{r.topic}</p>
                        )}
                        {r.message && (
                          <p className="text-xs text-ink/60 whitespace-pre-wrap mb-3">{r.message}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              respondMut.mutate({ request_id: r.id, action: "accept" })
                            }
                            disabled={respondMut.isPending}
                            className="px-3 py-1.5 bg-verde text-white rounded-sm text-xs font-medium hover:bg-verde-dark transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="size-3.5" /> Accept
                          </button>
                          <button
                            onClick={() =>
                              respondMut.mutate({ request_id: r.id, action: "decline" })
                            }
                            disabled={respondMut.isPending}
                            className="px-3 py-1.5 border border-ink/20 text-ink rounded-sm text-xs font-medium hover:bg-ink/5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <X className="size-3.5" /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Connections */}
              {m.connections.length > 0 && (
                <section>
                  <h2 className="font-serif text-lg text-ink mb-3">
                    Connections ({m.connections.length})
                  </h2>
                  <div className="space-y-3">
                    {m.connections.map((r: MentorshipRequest) => {
                      const name = r.mentee_id === userId ? r.mentor_name : r.mentee_name;
                      const role = r.mentee_id === userId ? "Mentor" : "Mentee";
                      return (
                        <button
                          key={r.id}
                          onClick={() => setActiveRequest(r)}
                          className="w-full text-left bg-card border border-ink/10 rounded-sm p-4 hover:border-verde/40 transition-colors flex items-center gap-3"
                        >
                          <div className="size-10 rounded-full bg-verde/10 text-verde-dark flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {(name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink text-sm">{name ?? "Connection"}</p>
                            <p className="text-xs text-ink/50 truncate">
                              {role}
                              {r.topic ? ` · ${r.topic}` : ""}
                            </p>
                          </div>
                          <MessageSquare className="size-4 text-ink/40 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Outgoing requests (as mentee) */}
              {m.outgoing.length > 0 && (
                <section>
                  <h2 className="font-serif text-lg text-ink mb-3">My requests</h2>
                  <div className="space-y-3">
                    {m.outgoing.map((r: MentorshipRequest) => (
                      <div key={r.id} className="bg-card border border-ink/10 rounded-sm p-4">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="font-medium text-ink text-sm">
                            {r.mentor_name ?? "Mentor"}
                          </p>
                          <StatusBadge status={r.status} />
                        </div>
                        {r.topic && <p className="text-xs text-ink/60">{r.topic}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
