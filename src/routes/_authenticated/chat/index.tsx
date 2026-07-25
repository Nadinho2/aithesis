import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClerk } from "@clerk/clerk-react";
import { ArrowUp, Sparkles, Plus, Clock, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatLink {
  id: string;
  title: string;
  updated_at: string;
}

const suggestedPrompts = [
  "Explain a concept from my course",
  "Help me understand my assignment question",
  "Give me tips for my upcoming exam",
  "Help me prepare for an interview",
];

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatPage,
});

export function ChatPage() {
  const { user } = useClerk();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("chatId");
    }
    return null;
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [startY, setStartY] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Fetch messages for active chat
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["chat-messages", activeChatId],
    queryFn: async () => {
      if (!activeChatId) return [];
      const { data, error } = await (supabase as any)
        .from("chat_messages")
        .select("*")
        .eq("chat_id", activeChatId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Failed to fetch messages:", error);
        return [];
      }
      return (data ?? []) as ChatMessage[];
    },
    enabled: !!activeChatId,
  });

  // Fetch chat history for mobile bottom sheet
  const { data: chatHistory } = useQuery({
    queryKey: ["chat-list", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await (supabase as any)
        .from("chats")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return (data ?? []) as ChatLink[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeChatId]);

  // Lock body scroll when history sheet is open
  useEffect(() => {
    if (historyOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [historyOpen]);

  function startNewChat() {
    setActiveChatId(null);
    setInput("");
    setIsLoading(false);
    setHistoryOpen(false);
    window.history.replaceState(null, "", "/chat");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function selectChat(id: string) {
    setActiveChatId(id);
    setInput("");
    setIsLoading(false);
    setHistoryOpen(false);
    window.history.replaceState(null, "", `/chat?chatId=${id}`);
  }

  // Listen for chat events from ContextSidebar (desktop)
  useEffect(() => {
    function handleNewChat() { startNewChat(); }
    function handleSelectChat(e: Event) { selectChat((e as CustomEvent).detail as string); }
    window.addEventListener("chat-new", handleNewChat);
    window.addEventListener("chat-select", handleSelectChat);
    return () => {
      window.removeEventListener("chat-new", handleNewChat);
      window.removeEventListener("chat-select", handleSelectChat);
    };
  }, []);

  // Swipe down to dismiss on mobile
  function handleTouchStart(e: React.TouchEvent) {
    setStartY(e.touches[0].clientY);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientY - startY;
    if (diff > 60) setHistoryOpen(false);
  }

  async function sendMessage(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || isLoading) return;

    setIsLoading(true);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChatId,
          message: msgText,
        }),
      });

      const data = await response.json();

      if (data.code === "PAYMENT_REQUIRED") {
        // Store the current URL so user returns here after payment
        const returnPath = activeChatId ? `/chat?chatId=${activeChatId}` : "/chat";
        sessionStorage.setItem("payment_return_url", returnPath);
        window.location.href = "/billing";
        return;
      }

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Request failed");
      }

      if (data.chatId) {
        setActiveChatId(data.chatId);
        window.history.replaceState(null, "", `/chat?chatId=${data.chatId}`);
        queryClient.invalidateQueries({ queryKey: ["chat-list"] });
      }

      setTimeout(() => refetchMessages(), 200);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["chat-list"] }), 1000);
    } catch (err: any) {
      console.error("Chat error:", err);
      refetchMessages();
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Group chat history by date
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const historyGroups = [
    { label: "Today", chats: (chatHistory ?? []).filter((c) => new Date(c.updated_at) >= todayStart) },
    { label: "Yesterday", chats: (chatHistory ?? []).filter((c) => {
      const d = new Date(c.updated_at); return d >= yesterdayStart && d < todayStart;
    }) },
    { label: "This week", chats: (chatHistory ?? []).filter((c) => {
      const d = new Date(c.updated_at); return d < yesterdayStart && d >= weekStart;
    }) },
    { label: "Older", chats: (chatHistory ?? []).filter((c) => new Date(c.updated_at) < weekStart) },
  ];

  function formatRelativeTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const chatTitle = activeChatId && messages && messages.length > 0
    ? (() => {
        const firstMsg = messages.find((m) => m.role === "user");
        return firstMsg
          ? firstMsg.content.slice(0, 50) + (firstMsg.content.length > 50 ? "..." : "")
          : "New chat";
      })()
    : "New chat";

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 sm:px-6 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-ink truncate">{chatTitle}</h2>
        {isMobile && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setHistoryOpen(true)}
              className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors"
              style={{ color: "#5F5E5A" }}
              title="Chat history"
            >
              <Clock className="size-5" />
            </button>
            <button
              onClick={startNewChat}
              className="size-9 rounded-lg flex items-center justify-center bg-verde text-white hover:bg-verde-dark transition-colors"
              title="New chat"
            >
              <Plus className="size-5" />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {(!activeChatId || !messages || messages.length === 0) ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="size-16 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: "rgba(15, 110, 86, 0.08)" }}>
              <Sparkles className="size-7" style={{ color: "#0F6E56" }} />
            </div>
            <h3 className="font-serif text-xl font-semibold text-ink mb-2">
              What can I help you study today?
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Ask anything about your coursework, assignments, or career prep.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="px-4 py-2 text-sm rounded-full border border-ink/10 hover:border-verde/40 hover:bg-verde/5 transition-colors text-ink/70 hover:text-ink"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`mx-auto space-y-4 ${isMobile ? "" : "max-w-2xl"}`}>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className={`px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed ${isMobile ? "max-w-[85%]" : "max-w-[75%]"}`}
                    style={{ backgroundColor: "#1A1A1A", color: "white" }}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3">
                  <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: "#0F6E56" }}>
                    <Sparkles className="size-3.5 text-white" />
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl rounded-bl-md border border-ink/10 bg-white text-sm leading-relaxed text-ink ${isMobile ? "max-w-[85%]" : "max-w-[75%]"}`}>
                    {msg.content}
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: "#0F6E56" }}>
                  <Sparkles className="size-3.5 text-white" />
                </div>
                <div className="px-5 py-3 rounded-2xl rounded-bl-md border border-ink/10 bg-white">
                  <div className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-2 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-2 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input box */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-ink/10 bg-white flex-shrink-0">
        <div className={`mx-auto flex items-end gap-2 bg-card border border-ink/10 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 focus-within:border-verde/40 focus-within:ring-1 focus-within:ring-verde/20 transition-all ${isMobile ? "" : "max-w-2xl"}`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your coursework..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-ink/30 leading-relaxed max-h-32"
            style={{ minHeight: "24px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30"
            style={{
              backgroundColor: input.trim() && !isLoading ? "#0F6E56" : "transparent",
              color: input.trim() && !isLoading ? "white" : "#5F5E5A",
            }}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>

      {/* Mobile: History bottom sheet overlay */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-50 transition-opacity duration-300 ${historyOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={() => setHistoryOpen(false)}
          >
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Sheet */}
          <div
            ref={sheetRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out rounded-t-2xl overflow-hidden flex flex-col ${historyOpen ? "translate-y-0" : "translate-y-full"}`}
            style={{
              backgroundColor: "#0B3527",
              maxHeight: "75vh",
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <h3 className="font-serif text-base font-semibold text-white">Chat History</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewChat}
                  className="size-8 rounded-md flex items-center justify-center bg-verde text-white hover:bg-verde-dark transition-colors"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="size-8 rounded-md flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto py-2">
              {historyGroups.map((group) =>
                group.chats.length > 0 ? (
                  <div key={group.label} className="mb-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 px-5 py-1.5">
                      {group.label}
                    </div>
                    {group.chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => selectChat(chat.id)}
                        className={`w-full text-left px-5 py-3 text-sm transition-colors flex items-center justify-between gap-2 ${
                          activeChatId === chat.id
                            ? "bg-verde/20 text-verde border-r-2 border-verde font-medium"
                            : "text-white/70 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate">{chat.title}</span>
                        <span className="text-[10px] text-white/40 flex-shrink-0">
                          {formatRelativeTime(chat.updated_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null
              )}
              {(!chatHistory || chatHistory.length === 0) && (
                <p className="text-sm text-white/40 px-5 py-6 text-center">No chats yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
