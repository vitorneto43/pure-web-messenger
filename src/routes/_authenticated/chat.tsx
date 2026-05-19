import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { EmptyChat } from "@/components/chat/EmptyChat";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const params = useParams({ strict: false }) as { conversationId?: string };
  const hasActive = !!params.conversationId;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          hasActive ? "hidden md:flex" : "flex"
        } w-full md:w-[340px] lg:w-[380px] shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-border`}
      >
        <ChatSidebar activeConversationId={params.conversationId} />
      </aside>

      {/* Main */}
      <main className={`${hasActive ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {hasActive ? <Outlet /> : <EmptyChat />}
      </main>
    </div>
  );
}
