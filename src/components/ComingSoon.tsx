import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClerk } from "@clerk/clerk-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  notifyEnabled?: boolean;
  featureName?: string;
}

export function ComingSoon({
  title,
  description,
  icon: Icon,
  notifyEnabled = false,
  featureName = "unknown",
}: ComingSoonProps) {
  const { user } = useClerk();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState(user?.emailAddresses?.[0]?.emailAddress ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleNotify() {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: insertError } = await (supabase as any)
        .from("coming_soon_notifications")
        .insert({
          email: email.trim(),
          feature: featureName,
          user_id: user?.id ?? null,
        });
      if (insertError) {
        // Supabase unique_violation = 23505, or duplicate key message
        const msg = String(insertError.message ?? "").toLowerCase();
        const code = String((insertError as any).code ?? "");
        if (code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
          setSubmitted(true);
        } else if (code === "42501" || msg.includes("permission")) {
          setError("Signup unavailable right now. Please try again later.");
          console.error("[ComingSoon] Permission denied:", insertError);
        } else {
          setError(insertError.message || "Something went wrong. Try again.");
          console.error("[ComingSoon] Insert error:", insertError);
        }
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error("[ComingSoon] Unexpected error:", err?.message ?? err);
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex-1 flex items-center justify-center min-h-0 ${isMobile ? "px-6" : "p-8"}`}>
      <div className="flex flex-col items-center text-center max-w-md">
        {/* Icon circle */}
        <div
          className={`rounded-full flex items-center justify-center mb-6 ${isMobile ? "size-16" : "size-20"}`}
          style={{ backgroundColor: "rgba(15, 110, 86, 0.08)" }}
        >
          <Icon className={isMobile ? "size-7" : "size-8"} style={{ color: "#0F6E56" }} />
        </div>

        {/* Title */}
        <h2 className={`font-semibold text-ink mb-3 ${isMobile ? "text-base" : "text-[18px]"}`}>{title}</h2>

        {/* Description */}
        <p className={`text-muted-foreground max-w-[400px] leading-relaxed mb-8 ${isMobile ? "text-[13px]" : "text-sm"}`}>
          {description}
        </p>

        {/* Email capture */}
        {notifyEnabled && (
          <>
            {submitted ? (
              <div className="w-full max-w-sm rounded-md border border-verde/20 bg-verde-light px-4 py-3 text-sm text-verde-dark text-center">
                You're on the list. We'll notify you when this goes live.
              </div>
            ) : (
              <div className="w-full max-w-sm">
                <div className={`flex gap-2 ${isMobile ? "flex-col" : ""}`}>
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink/30" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-ink/10 rounded-md focus:outline-none focus:border-verde focus:ring-1 focus:ring-verde/20 transition-colors bg-white"
                      onKeyDown={(e) => e.key === "Enter" && handleNotify()}
                    />
                  </div>
                  <button
                    onClick={handleNotify}
                    disabled={loading}
                    className="px-4 py-2.5 text-sm font-medium rounded-md bg-verde text-white hover:bg-verde-dark transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {loading ? "Sending..." : "Notify me"}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-red-500 mt-1.5">{error}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
