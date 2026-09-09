import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listMentors,
  recommendMentors,
  sendMentorshipRequest,
  listMyMentorship,
  type MentorCard,
  type RecommendedMentor,
} from "@/lib/mentorship.functions";
import { getMyProfile } from "@/lib/profile.functions";
import {
  ArrowLeft,
  Search,
  Loader2,
  UserSearch,
  GraduationCap,
  MapPin,
  Clock,
  Send,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mentor/find")({
  head: () => ({ meta: [{ title: "Find a Mentor — Mybrainpadi" }] }),
  component: FindMentorPage,
});

function MentorCardView({
  mentor,
  reasons = [],
  requested,
  onRequest,
}: {
  mentor: MentorCard;
  reasons?: string[];
  requested: boolean;
  onRequest: (mentor: MentorCard) => void;
}) {
  return (
    <div className="bg-card border border-ink/10 rounded-sm p-4 flex flex-col">
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reasons.map((reason) => (
            <span
              key={reason}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-bg text-amber-text border border-amber-text/20"
            >
              <Sparkles className="size-3" /> {reason}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="size-10 rounded-full bg-verde/10 text-verde-dark flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {(mentor.full_name ?? "M").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-ink leading-tight truncate">
            {mentor.full_name ?? "Mentor"}
          </h3>
          <p className="text-xs text-ink/50">{mentor.headline ?? "Mentor"}</p>
        </div>
      </div>

      {(mentor.university || mentor.department || mentor.availability) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {mentor.university && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink/60 bg-paper border border-ink/10 rounded-sm px-2 py-1">
              <MapPin className="size-3" /> {mentor.university}
            </span>
          )}
          {mentor.department && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink/60 bg-paper border border-ink/10 rounded-sm px-2 py-1">
              <GraduationCap className="size-3" /> {mentor.department}
            </span>
          )}
          {mentor.availability && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink/60 bg-paper border border-ink/10 rounded-sm px-2 py-1">
              <Clock className="size-3" /> {mentor.availability}
            </span>
          )}
        </div>
      )}

      {mentor.expertise_areas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {mentor.expertise_areas.map((tag: string) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-verde/10 text-verde-dark border border-verde/20"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {mentor.bio && (
        <p className="text-xs text-ink/60 leading-relaxed mb-4 line-clamp-3">{mentor.bio}</p>
      )}

      <div className="mt-auto">
        {requested ? (
          <div className="text-center text-xs text-verde-dark bg-verde-light px-3 py-2 rounded-sm border border-verde/20">
            Request sent
          </div>
        ) : (
          <button
            onClick={() => onRequest(mentor)}
            className="w-full px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2"
          >
            <Send className="size-4" /> Request mentorship
          </button>
        )}
      </div>
    </div>
  );
}

function FindMentorPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listMentors);
  const recommendFn = useServerFn(recommendMentors);
  const requestFn = useServerFn(sendMentorshipRequest);
  const myMentorshipFn = useServerFn(listMyMentorship);
  const getProfileFn = useServerFn(getMyProfile);

  const [filters, setFilters] = useState({
    university: "",
    department: "",
    level: "",
    query: "",
  });
  const [scopeInitialized, setScopeInitialized] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
  });

  // Pre-fill university filter from the learner's profile once.
  useEffect(() => {
    if (scopeInitialized || !profile) return;
    setFilters((f) => ({ ...f, university: profile.university ?? "" }));
    setScopeInitialized(true);
  }, [scopeInitialized, profile]);

  const { data: myMentorship } = useQuery({
    queryKey: ["my-mentorship"],
    queryFn: () => myMentorshipFn(),
  });

  const requestedMentorIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of myMentorship?.outgoing ?? []) {
      if (r.status === "pending" || r.status === "accepted") set.add(r.mentor_id);
    }
    return set;
  }, [myMentorship]);

  const { data: recommended = [] } = useQuery({
    queryKey: ["recommended-mentors"],
    queryFn: () => recommendFn({ data: { limit: 6 } }),
  });

  const recommendedIds = useMemo(
    () => new Set((recommended ?? []).map((r: RecommendedMentor) => r.user_id)),
    [recommended],
  );
  const showRecommended = (recommended ?? []).some(
    (r: RecommendedMentor) => r.reasons.length > 0,
  );

  const { data: mentors = [], isLoading } = useQuery({
    queryKey: ["mentors", filters],
    queryFn: () =>
      listFn({
        data: {
          university: filters.university || undefined,
          department: filters.department || undefined,
          level: filters.level || undefined,
          query: filters.query || undefined,
        },
      }),
  });

  // Avoid duplicating recommended mentors in the full directory below.
  const visibleMentors = useMemo(
    () =>
      showRecommended
        ? mentors.filter((m: MentorCard) => !recommendedIds.has(m.user_id))
        : mentors,
    [mentors, showRecommended, recommendedIds],
  );

  const [target, setTarget] = useState<MentorCard | null>(null);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  const requestMut = useMutation({
    mutationFn: () =>
      requestFn({
        data: { mentor_id: target!.id, topic, message },
      }),
    onSuccess: () => {
      toast.success("Request sent! The mentor will be notified.");
      setTarget(null);
      setTopic("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-mentorship"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  function openRequest(mentor: MentorCard) {
    setTarget(mentor);
    setTopic("");
    setMessage("");
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
            <h2 className="font-serif text-lg font-bold text-ink">Mentor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Find a mentor</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Mentorship
            </div>
            <h1 className="font-serif text-3xl text-ink">Find a Mentor</h1>
            <p className="text-ink/60 text-sm mt-1">
              Connect with seniors and graduates who can guide your research, exams, and career.
            </p>
          </div>

          {/* Recommended for you */}
          {showRecommended && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="size-4 text-amber-text" />
                <h2 className="font-serif text-xl text-ink">Recommended for you</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recommended.map((m: RecommendedMentor) => (
                  <MentorCardView
                    key={m.id}
                    mentor={m}
                    reasons={m.reasons}
                    requested={requestedMentorIds.has(m.user_id)}
                    onRequest={openRequest}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Filters */}
          <div className="bg-card border border-ink/10 rounded-sm p-4 mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-ink/40" />
              <input
                value={filters.query}
                onChange={(e) => setFilter("query", e.target.value)}
                placeholder="Search by headline or bio…"
                className="flex-1 bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  University
                </span>
                <input
                  value={filters.university}
                  onChange={(e) => setFilter("university", e.target.value)}
                  placeholder="Any university"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Department
                </span>
                <input
                  value={filters.department}
                  onChange={(e) => setFilter("department", e.target.value)}
                  placeholder="Any department"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Level
                </span>
                <input
                  value={filters.level}
                  onChange={(e) => setFilter("level", e.target.value)}
                  placeholder="Any level"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-ink/60 py-12 justify-center">
              <Loader2 className="size-5 animate-spin" /> Loading mentors…
            </div>
          ) : visibleMentors.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-8 text-center">
              <UserSearch className="size-8 text-sage mx-auto mb-3" />
              <h2 className="font-serif text-xl text-ink mb-1">No mentors match yet</h2>
              <p className="text-sm text-ink/60 mb-4">
                Try broadening your filters, or check back soon as more mentors join.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleMentors.map((m: MentorCard) => (
                <MentorCardView
                  key={m.id}
                  mentor={m}
                  requested={requestedMentorIds.has(m.user_id)}
                  onRequest={openRequest}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request modal */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setTarget(null)}
            aria-hidden
          />
          <div className="relative bg-card border border-ink/10 rounded-sm p-6 w-full max-w-md shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-serif text-xl text-ink">Request mentorship</h2>
                <p className="text-xs text-ink/50 mt-0.5">
                  to {target.full_name ?? "this mentor"}
                </p>
              </div>
              <button
                onClick={() => setTarget(null)}
                aria-label="Close"
                className="size-8 rounded-md flex items-center justify-center hover:bg-ink/5 text-ink/60"
              >
                <X className="size-5" />
              </button>
            </div>

            <label className="block mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                What do you need help with?
              </span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. My final-year project methodology"
                className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </label>

            <label className="block mb-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Message
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself and explain what you'd like guidance on…"
                rows={4}
                className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
              />
            </label>

            <button
              onClick={() => requestMut.mutate()}
              disabled={requestMut.isPending || !topic.trim() || message.trim().length < 10}
              className="w-full px-4 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {requestMut.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Send request
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
