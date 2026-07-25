import { createFileRoute, Link } from "@tanstack/react-router";
import { useClerk } from "@clerk/clerk-react";
import { User, Mail, Calendar, Shield, CreditCard, Gift, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Mybrainpadi" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useClerk();
  const isMobile = useIsMobile();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "User";

  const primaryEmail = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
    ?? user?.emailAddresses?.[0]?.emailAddress
    ?? "—";

  const createdAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className={`max-w-2xl mx-auto px-4 sm:px-6 py-8 ${isMobile ? "pb-20" : ""}`}>
      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">Account</div>
        <h1 className="font-serif text-3xl sm:text-4xl mb-3">Settings</h1>
        <p className="text-ink/60 text-sm">Manage your account details and preferences.</p>
      </div>

      {/* Profile card */}
      <div className="border border-ink/10 rounded-lg bg-card p-6 mb-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-5">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Avatar"
              className="size-14 rounded-full border-2 border-ink/10"
            />
          ) : (
            <div
              className="size-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: "#0B3527", color: "#4ADE80" }}
            >
              {(user?.firstName?.charAt(0) ?? user?.emailAddresses?.[0]?.emailAddress?.charAt(0) ?? "?").toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-serif text-lg">{displayName}</h3>
            <p className="text-sm text-ink/50">{primaryEmail}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 text-ink/30" />
            <span className="text-ink/50">Email:</span>
            <span>{primaryEmail}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="size-4 text-ink/30" />
            <span className="text-ink/50">Member since:</span>
            <span>{createdAt}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="size-4 text-ink/30" />
            <span className="text-ink/50">User ID:</span>
            <span className="font-mono text-xs text-ink/40 truncate max-w-[200px]">{user?.id ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="border border-ink/10 rounded-lg bg-card p-6 mb-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-4">
          Account Links
        </h2>
        <div className="space-y-2">
          <SettingsLink to="/billing" icon={CreditCard} label="Billing & Credits" desc="Manage payments, view credit balance" />
          <SettingsLink to="/referral" icon={Gift} label="Referral Program" desc="Invite friends and earn credits" />
          <SettingsLink to="/tools/history" icon={Calendar} label="Tools History" desc="View past assignments, exams, and more" />
        </div>
      </div>

      {/* Clerk profile management */}
      <div className="border border-ink/10 rounded-lg bg-card p-6">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 mb-4">
          Account Management
        </h2>
        <p className="text-sm text-ink/60 mb-4">
          Manage your password, connected accounts, and security settings via your account portal.
        </p>
        <a
          href="https://accounts.mybrainpadi.com/user"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{ backgroundColor: "#0B3527", color: "#fff" }}
        >
          Open Account Portal <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function SettingsLink({
  to,
  icon: Icon,
  label,
  desc,
}: {
  to: string;
  icon: any;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 p-3 rounded-md hover:bg-ink/[0.03] transition-colors group"
    >
      <div className="p-2 rounded-md bg-ink/5 text-ink/40 group-hover:text-ink/60 transition-colors">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm group-hover:text-sage transition-colors">{label}</p>
        <p className="text-[11px] text-ink/40">{desc}</p>
      </div>
    </Link>
  );
}
