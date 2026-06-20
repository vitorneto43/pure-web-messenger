import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "WaveChat — Rede social brasileira: posts, stories, lives e comunidades" },
      { name: "description", content: "Veja posts, stories, lives e comunidades em tempo real. Conheça pessoas, participe de grupos e converse no WaveChat." },
      { property: "og:title", content: "WaveChat — Rede social brasileira" },
      { property: "og:description", content: "Posts, stories, lives, comunidades e chamadas em um só lugar." },
      { property: "og:url", content: "https://webconnectchat.com" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "WaveChat — Rede social brasileira" },
      { name: "twitter:description", content: "Posts, stories, lives, comunidades e chamadas em um só lugar." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          url: "https://webconnectchat.com",
          name: "WaveChat",
          inLanguage: "pt-BR",
        }),
      },
    ],
  }),
});

function HomePage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <ChatSidebar />
    </div>
  );
}
