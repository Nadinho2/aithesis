import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "./index";

export const Route = createFileRoute("/_authenticated/chat/$" as any)({
  component: ChatCatchAllPage,
});

function ChatCatchAllPage() {
  return <ChatPage />;
}
