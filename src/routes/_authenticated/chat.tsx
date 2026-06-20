import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const params = useParams({ strict: false }) as { conversationId?: string };
  const hasActive = !!params.conversationId;

  if (hasActive) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <ChatSidebar />
    </div>
  );
}
