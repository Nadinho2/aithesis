import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { ProfileForm } from "@/components/ProfileForm";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Mybrainpadi" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const getProfileFn = useServerFn(getMyProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
    enabled: isLoaded && !!isSignedIn,
  });

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <Loader2 className="size-6 animate-spin text-sage" />
      </div>
    );
  }

  if (!isSignedIn) return <Navigate to="/auth" />;
  if (profile?.learner_type) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-bone flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
            One quick step
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink mb-3">Welcome to Mybrainpadi</h1>
          <p className="text-sm text-ink/60 max-w-sm mx-auto">
            Tell us who you are so we can personalise your topics, past questions, and study tools.
          </p>
        </div>

        <div className="border border-ink/10 rounded-lg bg-card p-6 sm:p-8">
          <ProfileForm initialProfile={profile ?? null} onSaved={() => navigate({ to: "/dashboard" })} />
        </div>
      </div>
    </div>
  );
}
