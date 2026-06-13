import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ThesisPro AI" },
      { name: "description", content: "Sign in to your ThesisPro AI research workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect once signed in
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) navigate({ to: "/dashboard", replace: true });
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
    // If no error, the browser navigates away for OAuth redirect
  };

  return (
    <div className="min-h-screen bg-bone flex flex-col">
      <nav className="px-8 py-6">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <span className="size-8 bg-ink rounded-sm flex items-center justify-center">
            <span className="w-4 h-0.5 bg-bone" />
          </span>
          <span className="font-serif italic text-xl font-bold tracking-tight">ThesisPro</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="font-serif text-4xl mb-3">
              {mode === "signin" ? "Welcome back." : "Begin your research."}
            </h1>
            <p className="text-ink/60 text-sm">
              {mode === "signin"
                ? "Sign in to your ThesisPro workspace."
                : "Create an account to generate verified academic work."}
            </p>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 border border-ink/15 rounded-sm text-sm font-medium hover:bg-parchment transition-colors mb-6 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6 text-[10px] uppercase tracking-[0.2em] text-ink/40">
            <span className="flex-1 h-px bg-ink/10" />
            or
            <span className="flex-1 h-px bg-ink/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full bg-bone border border-ink/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sage"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-ink/60">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-sage font-medium hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already a member?{" "}
                <button onClick={() => setMode("signin")} className="text-sage font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
