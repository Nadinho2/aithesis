import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SignInButton, SignUpButton, useAuth } from "@clerk/clerk-react";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        {/* Trust badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-bg text-amber-text text-[11px] font-semibold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verified against OpenAlex &amp; Crossref
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink">ThesisPro</h1>
          <p className="mt-2 text-sm text-ink-secondary">A research writing partner for well-sourced academic work</p>
        </div>

        <div className="bg-white border border-[#E5E2D8] rounded-lg p-6 shadow-sm space-y-3">
          <SignInButton mode="modal">
            <button className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:opacity-90 transition-colors text-sm">
              Sign In
            </button>
          </SignInButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#E5E2D8]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-ink-secondary">or</span>
            </div>
          </div>

          <SignUpButton mode="modal">
            <button className="w-full py-2.5 border border-[#E5E2D8] text-ink font-medium rounded-lg hover:bg-ink/5 transition-colors text-sm">
              Create Account
            </button>
          </SignUpButton>

          <p className="text-xs text-center text-ink-secondary pt-2 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            Secure sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
