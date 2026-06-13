import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SignIn, useAuth } from "@clerk/clerk-react";

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

        <div className="bg-white rounded-sm border border-ink/10 p-6 shadow-sm">
          <SignIn
            routing="hash"
            afterSignInUrl="/dashboard"
            signUpUrl="/auth"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0",
                header: "hidden",
                dividerLine: "bg-ink/10",
                dividerText: "text-ink/40 text-xs",
                socialButtonsBlockButton: "text-sm border border-ink/10 hover:bg-ink/[0.02]",
                formFieldLabel: "text-xs text-ink/60",
                formFieldInput: "text-sm border-ink/10 rounded-sm",
                formButtonPrimary: "bg-ink text-bone hover:bg-sage text-sm rounded-sm",
                footerActionText: "text-xs text-ink/40",
                footerActionLink: "text-xs text-ink underline",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
