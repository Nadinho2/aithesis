import { Link, useLocation } from "@tanstack/react-router";
import { useClerk } from "@clerk/clerk-react";
import {
  Home,
  Wrench,
  GraduationCap,
  Users,
  MessageCircle,
  LogOut,
  CreditCard,
  Settings,
  UserCircle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

type Section = "home" | "tools" | "learn" | "community" | "chat";

const items: { id: Section; label: string; icon: typeof Home; route: string }[] = [
  { id: "home", label: "Home", icon: Home, route: "/dashboard" },
  { id: "tools", label: "Tools", icon: Wrench, route: "/tools/dashboard" },
  { id: "learn", label: "Learn", icon: GraduationCap, route: "/learn" },
  { id: "community", label: "Community", icon: Users, route: "/community" },
  { id: "chat", label: "AI Chat", icon: MessageCircle, route: "/chat" },
];

export function getSectionFromPath(pathname: string): Section {
  if (pathname.startsWith("/tools")) return "tools";
  if (pathname.startsWith("/learn")) return "learn";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/chat")) return "chat";
  return "home";
}

export function IconRail() {
  const location = useLocation();
  const currentSection = getSectionFromPath(location.pathname);
  const { user, signOut: clerkSignOut } = useClerk();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userInitial = user?.firstName?.charAt(0) ?? user?.emailAddresses?.[0]?.emailAddress?.charAt(0) ?? "?";

  return (
    <aside className="w-[72px] flex-shrink-0 flex flex-col items-center py-4 gap-1 fixed left-0 top-0 bottom-0 z-40"
      style={{ backgroundColor: "#0B3527" }}>
      {/* Logo */}
      <Link to="/dashboard" className="mb-4 flex items-center justify-center">
        <span className="bg-white rounded-lg p-1.5 shadow-sm inline-flex">
          <img src="/logo.png" alt="Mybrainpadi" className="h-7 w-auto" />
        </span>
      </Link>

      {/* Nav items */}
      {items.map((item) => {
        const Icon = item.icon;
        const active = currentSection === item.id;
        return (
          <Link
            key={item.id}
            to={item.route}
            className="flex flex-col items-center justify-center gap-0.5 w-full py-2.5 transition-colors relative group"
            style={{
              color: active ? "#4ADE80" : "rgba(255,255,255,0.55)",
            }}
            title={item.label}
          >
            {active && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                style={{ backgroundColor: "#4ADE80" }}
              />
            )}
            <Icon className="size-5" />
            <span
              className="text-[10px] font-medium leading-tight"
              style={{
                color: active ? "#4ADE80" : "rgba(255,255,255,0.45)",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="size-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "#4ADE80",
            color: "#0B3527",
          }}
          title="Account"
        >
          {userInitial.toUpperCase()}
        </button>

        {dropdownOpen && (
          <div
            className="absolute bottom-full left-0 mb-2 w-44 rounded-md shadow-lg py-1 z-50 border"
            style={{
              backgroundColor: "#0B3527",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <Link
              to="/billing"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/10 transition-colors"
              style={{ color: "rgba(255,255,255,0.85)" }}
              onClick={() => setDropdownOpen(false)}
            >
              <CreditCard className="size-4" style={{ color: "rgba(255,255,255,0.55)" }} />
              Billing
            </Link>
            <button
              onClick={() => {
                setDropdownOpen(false);
                clerkSignOut();
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/10 transition-colors w-full"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              <LogOut className="size-4" style={{ color: "rgba(255,255,255,0.55)" }} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
