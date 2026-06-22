import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, useSignIn, useSignUp } from "@clerk/clerk-react";
import { Lock, Eye, EyeOff, Loader2, Mail, User, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Navigate to="/dashboard" />;
  }

  return <AuthForms />;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-sage"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink/70 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function AuthForms() {
  const navigate = useNavigate();
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.longMessage ?? err.message ?? "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        navigate({ to: "/dashboard" });
      } else if (result.status === "missing_requirements") {
        toast.success("Check your email to verify your account.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.longMessage ?? err.message ?? "Sign up failed.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setPassword("");
    setConfirmPassword("");
  };

  if (!isSignInLoaded || !isSignUpLoaded) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        {/* Trust badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-bg text-amber-text text-[11px] font-semibold">
            <Lock className="size-3.5" />
            Verified against OpenAlex &amp; Crossref
          </div>
        </div>

        <div className="mb-8 text-center">
          <Link to="/" className="block">
            <h1 className="font-serif text-3xl text-ink">Mybrainpadi</h1>
          </Link>
          <p className="mt-2 text-sm text-ink-secondary">Your all-in-one education ecosystem for research, study, and career tools</p>
        </div>

        <div className="bg-white border border-[#E5E2D8] rounded-lg p-6 shadow-sm">
          <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
                {mode === "signin" ? "Email or Username" : "Email"}
              </label>
              <div className="relative">
                <input
                  type={mode === "signin" ? "text" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "signin" ? "you@university.edu or username" : "you@university.edu"}
                  className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2.5 pl-10 text-sm focus:outline-none focus:border-sage"
                />
                {mode === "signin" ? (
                  <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                ) : (
                  <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                )}
              </div>
            </div>

            <PasswordInput
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
            />

            {mode === "signup" && (
              <PasswordInput
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat your password"
              />
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:opacity-90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Please wait…
                </>
              ) : mode === "signin" ? (
                <>
                  <KeyRound className="size-4" /> Sign In
                </>
              ) : (
                <>
                  <KeyRound className="size-4" /> Create Account
                </>
              )}
            </button>

            {mode === "signin" && (
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-xs text-ink/50 hover:text-ink transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#E5E2D8]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-ink-secondary">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
              </span>
            </div>
          </div>

          <button
            onClick={switchMode}
            className="w-full py-2.5 border border-[#E5E2D8] text-ink font-medium rounded-lg hover:bg-ink/5 transition-colors text-sm"
          >
            {mode === "signin" ? "Create Account" : "Sign In"}
          </button>

          <p className="text-xs text-center text-ink-secondary pt-4 flex items-center justify-center gap-1.5">
            <Lock className="size-3" />
            Secure sign-in with Clerk
          </p>
        </div>
      </div>
    </div>
  );
}
