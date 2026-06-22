import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, Mail, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset Password — Mybrainpadi" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { isLoaded, signIn } = useSignIn();
  const navigate = useNavigate();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setBusy(true);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("code");
      toast.success("Check your email for a reset code.");
    } catch (err: any) {
      toast.error(err.errors?.[0]?.longMessage ?? err.message ?? "Failed to send reset code.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    if (!code.trim()) {
      toast.error("Please enter the reset code from your email.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });
      if (result.status === "complete") {
        toast.success("Password reset successfully. You can now sign in.");
        navigate({ to: "/auth" });
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.longMessage ?? err.message ?? "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="block">
            <h1 className="font-serif text-3xl text-ink">Mybrainpadi</h1>
          </Link>
          <p className="mt-2 text-sm text-ink-secondary">Reset your password</p>
        </div>

        <div className="bg-white border border-[#E5E2D8] rounded-lg p-6 shadow-sm">
          {step === "email" ? (
            <form onSubmit={sendResetCode} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-full bg-amber-bg flex items-center justify-center">
                  <Lock className="size-5 text-amber-text" />
                </div>
                <div>
                  <h2 className="font-serif text-lg text-ink">Forgot password?</h2>
                  <p className="text-xs text-ink/50">Enter your email to receive a reset code.</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2.5 pl-10 text-sm focus:outline-none focus:border-sage"
                  />
                  <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:opacity-90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Mail className="size-4" /> Send Reset Code
                  </>
                )}
              </button>

              <div className="text-center">
                <Link to="/auth" className="inline-flex items-center gap-1 text-xs text-ink/50 hover:text-ink transition-colors">
                  <ArrowLeft className="size-3" /> Back to sign in
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center">
                  <ShieldCheck className="size-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-serif text-lg text-ink">Reset code sent</h2>
                  <p className="text-xs text-ink/50">Check <strong className="text-ink/70">{email}</strong> for a reset code.</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
                  Reset Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage text-center tracking-[0.3em] font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-card border border-ink/15 rounded-sm px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-sage"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:opacity-90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Resetting…
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" /> Reset Password
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="inline-flex items-center gap-1 text-xs text-ink/50 hover:text-ink transition-colors"
                >
                  <ArrowLeft className="size-3" /> Use a different email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
