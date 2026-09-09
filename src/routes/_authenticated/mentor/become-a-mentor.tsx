import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMyMentorProfile, applyAsMentor } from "@/lib/mentorship.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { ArrowLeft, Loader2, Handshake, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mentor/become-a-mentor")({
  head: () => ({ meta: [{ title: "Become a Mentor — Mybrainpadi" }] }),
  component: BecomeMentorPage,
});

function BecomeMentorPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mentorProfileFn = useServerFn(getMyMentorProfile);
  const applyFn = useServerFn(applyAsMentor);
  const getProfileFn = useServerFn(getMyProfile);

  const [form, setForm] = useState({
    headline: "",
    bio: "",
    expertise: "",
    university: "",
    department: "",
    level: "",
    availability: "",
  });
  const [initialized, setInitialized] = useState(false);

  const { data: mentorProfile } = useQuery({
    queryKey: ["my-mentor-profile"],
    queryFn: () => mentorProfileFn(),
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
  });

  useEffect(() => {
    if (initialized) return;
    if (!mentorProfile && !profile) return;
    setForm({
      headline: mentorProfile?.headline ?? "",
      bio: mentorProfile?.bio ?? "",
      expertise: (mentorProfile?.expertise_areas ?? []).join(", "),
      university: mentorProfile?.university ?? profile?.university ?? "",
      department: mentorProfile?.department ?? profile?.department ?? "",
      level: mentorProfile?.level ?? profile?.level ?? "",
      availability: mentorProfile?.availability ?? "",
    });
    setInitialized(true);
  }, [initialized, mentorProfile, profile]);

  const applyMut = useMutation({
    mutationFn: () =>
      applyFn({
        data: {
          headline: form.headline,
          bio: form.bio,
          expertise_areas: form.expertise
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          university: form.university || undefined,
          department: form.department || undefined,
          level: form.level || undefined,
          availability: form.availability || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.status === "approved"
          ? "Profile updated"
          : "Application submitted for review",
      );
      qc.invalidateQueries({ queryKey: ["my-mentor-profile"] });
      navigate({ to: "/mentor/my-mentorship" });
    },
    onError: (e) => toast.error(String(e)),
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.headline.trim().length >= 3 && form.bio.trim().length >= 10 && !applyMut.isPending;

  const status = mentorProfile?.status;

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
            <p className="text-xs text-muted-foreground mt-0.5">Become a mentor</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
              Mentorship
            </div>
            <h1 className="font-serif text-3xl text-ink">Become a Mentor</h1>
            <p className="text-ink/60 text-sm mt-1">
              Share your experience and guide students on their academic journey.
            </p>
          </div>

          {status && (
            <div
              className={`mb-6 rounded-sm px-4 py-3 text-sm flex items-center gap-2 ${
                status === "approved"
                  ? "bg-verde-light text-verde-dark"
                  : status === "pending"
                    ? "bg-amber-bg text-amber-text"
                    : "bg-ink/5 text-ink/60"
              }`}
            >
              {status === "approved" ? (
                <CheckCircle className="size-4 flex-shrink-0" />
              ) : (
                <Clock className="size-4 flex-shrink-0" />
              )}
              <span>
                {status === "approved" && "Your mentor profile is live."}
                {status === "pending" && "Your application is pending admin approval."}
                {status === "rejected" &&
                  "Your application was declined. Update your profile and re-apply."}
                {status === "paused" && "Your mentor profile is paused."}
              </span>
            </div>
          )}

          <div className="bg-card border border-ink/10 rounded-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-verde-dark">
              <Handshake className="size-5" />
              <p className="text-xs text-ink/60">
                Applications are reviewed by admins before you appear in the directory.
              </p>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Headline
              </span>
              <input
                value={form.headline}
                onChange={(e) => set("headline")(e.target.value)}
                placeholder="e.g. Final-year Engineering student & research tutor"
                className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Bio
              </span>
              <textarea
                value={form.bio}
                onChange={(e) => set("bio")(e.target.value)}
                placeholder="Tell students about your background, what you can help with, and how you like to work…"
                rows={5}
                className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Areas of expertise <span className="normal-case font-normal">(comma-separated)</span>
              </span>
              <input
                value={form.expertise}
                onChange={(e) => set("expertise")(e.target.value)}
                placeholder="e.g. Research methodology, Statistics, Thesis writing"
                className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  University
                </span>
                <input
                  value={form.university}
                  onChange={(e) => set("university")(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Department
                </span>
                <input
                  value={form.department}
                  onChange={(e) => set("department")(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Level
                </span>
                <input
                  value={form.level}
                  onChange={(e) => set("level")(e.target.value)}
                  placeholder="e.g. Graduate, Postgraduate"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Availability
                </span>
                <input
                  value={form.availability}
                  onChange={(e) => set("availability")(e.target.value)}
                  placeholder="e.g. Weekends, Evenings"
                  className="mt-1 w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                />
              </label>
            </div>

            <button
              onClick={() => applyMut.mutate()}
              disabled={!canSubmit}
              className="w-full px-4 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {applyMut.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit application"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
