import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileEdit,
  GraduationCap,
  Presentation,
  UserSquare2,
  BookOpen,
  Zap,
  Bookmark,
  CreditCard,
  Gift,
  Settings,
  Library,
  Sparkles,
  FileText,
  Plus,
  MessageCircle,
  BookOpenCheck,
  Calendar,
  BarChart3,
  Search,
  BookmarkCheck,
  Users,
  UserSearch,
  ShoppingBag,
  Briefcase,
} from "lucide-react";
import { useClerk } from "@clerk/clerk-react";

type Section = "home" | "tools" | "learn" | "community" | "chat";

interface ContextSidebarProps {
  section: Section;
}

function ToolsSidebar() {
  const location = useLocation();
  const path = location.pathname;

  const researchTools = [
    { to: "/topic-generator", label: "Topic Discovery", icon: Search },
    { to: "/my-topics", label: "My Topics", icon: BookmarkCheck },
    { to: "/quick-proposal", label: "Proposal", icon: FileText },
    { to: "/proposals", label: "My Proposals", icon: Library },
    { to: "/new-thesis", label: "Thesis", icon: Sparkles },
    { to: "/theses", label: "My Theses", icon: BookOpen },
  ];

  const academicTools = [
    { to: "/tools/assignment", label: "Assignment", icon: FileEdit },
    { to: "/tools/exam", label: "Exam Prep", icon: GraduationCap },
    { to: "/tools/presentation", label: "Presentation", icon: Presentation },
    { to: "/tools/seminar", label: "Seminar", icon: BookOpenCheck },
    { to: "/tools/custom-analysis", label: "Assessment", icon: BarChart3 },
  ];

  const careerTools = [
    { to: "/tools/cv", label: "CV Maker", icon: UserSquare2 },
    { to: "/tools/side-hustle", label: "Side Hustle", icon: Zap },
  ];

  const accountItems = [
    { to: "/tools/history", label: "My History", icon: Bookmark },
    { to: "/billing", label: "Billing", icon: CreditCard },
    { to: "/referral", label: "Referral Program", icon: Gift },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-ink/5">
        <h2 className="font-serif text-lg font-bold text-ink">Tools</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Academic &amp; career toolkit</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5">
          Research
        </div>
        {researchTools.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-verde/10 text-verde-dark font-medium border-r-2 border-verde"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Academic Tools
        </div>
        {academicTools.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-verde/10 text-verde-dark font-medium border-r-2 border-verde"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Career Tools
        </div>
        {careerTools.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-verde/10 text-verde-dark font-medium border-r-2 border-verde"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Account
        </div>
        {accountItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-verde/10 text-verde-dark font-medium border-r-2 border-verde"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function LearnSidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-ink/5">
        <h2 className="font-serif text-lg font-bold text-ink">Learn</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Grow your skills</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5">
          Self learning
        </div>
        {[
          { to: "/learn/learning-paths", label: "Learning paths", icon: BookOpenCheck },
          { to: "/learn/micro-courses", label: "Micro courses", icon: Sparkles },
          { to: "/learn/certificates", label: "My certificates", icon: BookmarkCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Practice
        </div>
        {[
          { to: "/learn/past-questions", label: "Past questions", icon: Library },
          { to: "/learn/study-planner", label: "Study planner", icon: Calendar },
          { to: "/learn/progress", label: "My progress", icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Discover
        </div>
        {[
          { to: "/learn/subjects", label: "Browse subjects", icon: Search },
          { to: "/learn/saved", label: "Saved", icon: Bookmark },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function CommunitySidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-ink/5">
        <h2 className="font-serif text-lg font-bold text-ink">Community</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Connect and grow</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5">
          My university
        </div>
        {[
          { to: "/community/university-feed", label: "University feed", icon: Users },
          { to: "/community/study-groups", label: "Study groups", icon: MessageCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Marketplace
        </div>
        {[
          { to: "/community/buy-resources", label: "Buy resources", icon: ShoppingBag },
          { to: "/community/sell-resources", label: "Sell resources", icon: Briefcase },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5 mt-3">
          Mentorship
        </div>
        {[
          { to: "/community/find-mentor", label: "Find a mentor", icon: UserSearch },
          { to: "/community/my-mentorship", label: "My mentorship", icon: GraduationCap },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

interface ChatLink {
  id: string;
  title: string;
  updated_at: string;
}

function ChatSidebar() {
  const { user } = useClerk();
  const userId = user?.id;

  // Track active chat from URL for reactive updates
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("chatId");
    }
    return null;
  });

  // Listen for URL changes
  useEffect(() => {
    function handlePopState() {
      setActiveChatId(new URLSearchParams(window.location.search).get("chatId"));
    }
    window.addEventListener("popstate", handlePopState);
    // Also check on an interval for replaceState changes
    const interval = setInterval(() => {
      const newId = new URLSearchParams(window.location.search).get("chatId");
      setActiveChatId(prev => prev !== newId ? newId : prev);
    }, 500);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearInterval(interval);
    };
  }, []);

  const { data: chats } = useQuery({
    queryKey: ["chat-list", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("chats")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("Failed to fetch chats:", error);
        return [];
      }
      return (data ?? []) as ChatLink[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups: { label: string; chats: ChatLink[] }[] = [
    { label: "Today", chats: (chats ?? []).filter(c => new Date(c.updated_at) >= todayStart) },
    { label: "Yesterday", chats: (chats ?? []).filter(c => {
      const d = new Date(c.updated_at);
      return d >= yesterdayStart && d < todayStart;
    }) },
    { label: "This week", chats: (chats ?? []).filter(c => {
      const d = new Date(c.updated_at);
      return d < yesterdayStart && d >= weekStart;
    }) },
    { label: "Older", chats: (chats ?? []).filter(c => new Date(c.updated_at) < weekStart) },
  ];

  function formatRelativeTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-ink/5 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink">AI Chat</h2>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("chat-new"))}
          className="size-8 rounded-md flex items-center justify-center bg-verde text-white hover:bg-verde-dark transition-colors"
          title="New chat"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((group) =>
          group.chats.length > 0 ? (
            <div key={group.label} className="mb-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 px-4 py-1.5">
                {group.label}
              </div>
              {group.chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => window.dispatchEvent(new CustomEvent("chat-select", { detail: chat.id }))}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                    activeChatId === chat.id
                      ? "bg-verde/10 text-verde-dark font-medium border-r-2 border-verde"
                      : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  <span className="truncate">{chat.title}</span>
                  <span className="text-[10px] text-ink/40 flex-shrink-0">
                    {formatRelativeTime(chat.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          ) : null
        )}
        {(!chats || chats.length === 0) && (
          <p className="text-xs text-ink/40 px-4 py-4 text-center">No chats yet</p>
        )}
      </div>
    </div>
  );
}

export function ContextSidebar({ section }: ContextSidebarProps) {
  if (section === "home") return null;

  return (
    <aside className="w-[220px] flex-shrink-0 border-r border-ink/10 bg-white flex flex-col min-h-0">
      {section === "tools" && <ToolsSidebar />}
      {section === "learn" && <LearnSidebar />}
      {section === "community" && <CommunitySidebar />}
      {section === "chat" && <ChatSidebar />}
    </aside>
  );
}
