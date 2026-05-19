import { createFileRoute } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  component: ChatRoom,
});

function ChatRoom() {
  const { conversationId } = Route.useParams();
  return <ChatWindow conversationId={conversationId} />;
}
