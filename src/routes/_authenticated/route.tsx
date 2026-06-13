import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/auth" />;

  return (
    <div className="min-h-screen md:flex bg-bone">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
