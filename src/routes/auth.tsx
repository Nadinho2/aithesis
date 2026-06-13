import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SignInButton, SignUpButton, useAuth } from "@clerk/clerk-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink">ThesisPro AI</h1>
          <p className="mt-2 text-sm text-ink/60">Verified academic writing, powered by AI</p>
        </div>

        <div className="bg-white rounded-sm border border-ink/10 p-6 shadow-sm space-y-3">
          <SignInButton mode="modal">
            <button className="w-full py-2.5 bg-ink text-bone font-medium rounded-sm hover:bg-sage transition-colors text-sm">
              Sign In
            </button>
          </SignInButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-ink/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-ink/40">or</span>
            </div>
          </div>

          <SignUpButton mode="modal">
            <button className="w-full py-2.5 border border-ink/10 text-ink font-medium rounded-sm hover:bg-ink/[0.02] transition-colors text-sm">
              Create Account
            </button>
          </SignUpButton>

          <p className="text-xs text-center text-ink/40 pt-2">
            Secure sign-in powered by Clerk
          </p>
        </div>
      </div>
    </div>
  );
}
