import { Link, useLocation } from "@tanstack/react-router";
import { Home, Wrench, GraduationCap, Users, MessageCircle } from "lucide-react";
import { getSectionFromPath } from "@/components/IconRail";

const items = [
  { id: "home" as const, label: "Home", icon: Home, route: "/dashboard" },
  { id: "tools" as const, label: "Tools", icon: Wrench, route: "/tools/dashboard" },
  { id: "learn" as const, label: "Learn", icon: GraduationCap, route: "/learn" },
  { id: "community" as const, label: "Community", icon: Users, route: "/community" },
  { id: "chat" as const, label: "AI Chat", icon: MessageCircle, route: "/chat" },
];

export function MobileTabBar() {
  const location = useLocation();
  const currentSection = getSectionFromPath(location.pathname);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-[64px] border-t border-white/10"
      style={{ backgroundColor: "#0B3527" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = currentSection === item.id;
        return (
          <Link
            key={item.id}
            to={item.route}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative"
            style={{
              color: active ? "#4ADE80" : "rgba(255,255,255,0.55)",
            }}
          >
            {active && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
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
    </nav>
  );
}
