import { useState, useEffect } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useClerk } from "@clerk/clerk-react";
import { adminCheck } from "@/lib/admin.functions";
import {
  LayoutDashboard,
  Sparkles,
  Bookmark,
  FileText,
  Library,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
};

const baseNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/topic-generator", label: "Topic Generator", icon: Sparkles },
  { to: "/my-topics", label: "My Topics", icon: Bookmark },
  { to: "/quick-proposal", label: "Quick Proposal", icon: FileText },
  { to: "/proposals", label: "My Proposals", icon: Library },
  { to: "/new-thesis", label: "Full Thesis", icon: Sparkles },
  { to: "/theses", label: "My Theses", icon: Library },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings, disabled: true },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const adminFn = useServerFn(adminCheck);
  const { data: roleData } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => adminFn(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = !!roleData?.isAdmin;

  const { signOut: clerkSignOut } = useClerk();

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  const signOut = async () => {
    await clerkSignOut();
    navigate({ to: "/auth", replace: true });
  };

  const nav: NavItem[] = isAdmin
    ? [...baseNav, { to: "/admin", label: "Admin", icon: Shield }]
    : baseNav;

  const sidebarBody = (
    <>
      <Link to="/dashboard" className="flex items-center gap-2 px-6 py-6 border-b border-ink/5">
        <span className="size-8 bg-ink rounded-sm flex items-center justify-center">
          <span className="w-4 h-0.5 bg-bone" />
        </span>
        <span className="font-serif italic text-xl font-bold tracking-tight">ThesisPro</span>
      </Link>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-3 py-2">
          Workspace
        </div>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = path === item.to;
          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="flex items-center gap-3 px-3 py-2 text-sm text-ink/30 cursor-not-allowed"
                title="Coming soon"
              >
                <Icon className="size-4" />
                {item.label}
                <span className="ml-auto text-[9px] uppercase tracking-widest">soon</span>
              </div>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                active
                  ? "bg-ink text-bone font-medium"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-ink/5">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink/60 hover:text-ink hover:bg-ink/5 rounded-sm transition-colors"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-bone border-b border-ink/10">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="size-7 bg-ink rounded-sm flex items-center justify-center">
            <span className="w-3.5 h-0.5 bg-bone" />
          </span>
          <span className="font-serif italic text-lg font-bold">ThesisPro</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-2 text-ink"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-parchment/60 border-r border-ink/10 flex-col">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative w-72 max-w-[85%] bg-bone border-r border-ink/10 flex flex-col">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 p-1 text-ink/60"
            >
              <X className="size-5" />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
