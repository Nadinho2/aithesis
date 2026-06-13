import { createFileRoute } from "@tanstack/react-router";
import { SignIn, SignUp, useAuth } from "@clerk/tanstack-react-start";
import { Navigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { isSignedIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

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

        <div className="bg-white rounded-sm border border-ink/10 p-6 shadow-sm">
          <div className="flex mb-6 border-b border-ink/10">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 pb-3 text-sm font-medium text-center transition-colors ${
                mode === "signin"
                  ? "text-ink border-b-2 border-ink"
                  : "text-ink/40 hover:text-ink/60"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 pb-3 text-sm font-medium text-center transition-colors ${
                mode === "signup"
                  ? "text-ink border-b-2 border-ink"
                  : "text-ink/40 hover:text-ink/60"
              }`}
            >
              Sign Up
            </button>
          </div>

          {mode === "signin" ? (
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "text-sm border border-ink/10 hover:bg-ink/[0.02]",
                  dividerLine: "bg-ink/10",
                  dividerText: "text-ink/40 text-xs",
                  formFieldLabel: "text-xs text-ink/60",
                  formFieldInput: "text-sm border-ink/10 rounded-sm",
                  formButtonPrimary: "bg-ink text-bone hover:bg-sage text-sm rounded-sm",
                  footerActionText: "text-xs text-ink/40",
                  footerActionLink: "text-xs text-ink underline",
                },
              }}
            />
          ) : (
            <SignUp
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "text-sm border border-ink/10 hover:bg-ink/[0.02]",
                  dividerLine: "bg-ink/10",
                  dividerText: "text-ink/40 text-xs",
                  formFieldLabel: "text-xs text-ink/60",
                  formFieldInput: "text-sm border-ink/10 rounded-sm",
                  formButtonPrimary: "bg-ink text-bone hover:bg-sage text-sm rounded-sm",
                  footerActionText: "text-xs text-ink/40",
                  footerActionLink: "text-xs text-ink underline",
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
