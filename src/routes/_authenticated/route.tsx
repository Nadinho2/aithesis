import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isSignedIn, isLoaded } = useAuth();
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
  if (!profile?.learner_type) return <Navigate to="/onboarding" />;

  return <AppShell />;
}