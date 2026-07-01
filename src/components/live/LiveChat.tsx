import { useEffect, useRef, useState, FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle } from "lucide-react";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import { MentionText } from "@/components/mentions/MentionText";
import { useMentionSuggest } from "@/hooks/use-mention-suggest";
import { TranslateButton } from "@/components/TranslateButton";

interface Msg {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export function LiveChat({ liveId, userId }: { liveId: string; userId: string | null }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mention = useMentionSuggest({ value: text, setValue: setText, inputRef, variant: "dark" });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("id,user_id,body,created_at")
        .eq("live_id", liveId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active || !data) return;
      const ids = Array.from(new Set(data.map((m) => m.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      setMessages(
        data
          .reverse()
          .map((m) => ({ ...m, ...byId.get(m.user_id) })),
      );
    })();
    const channel = supabase
      .channel(`live-chat-${liveId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `live_id=eq.${liveId}` },
        async (payload) => {
          const m = payload.new as Msg;
          const { data: p } = await supabase
            .from("profiles")
            .select("username,display_name,avatar_url")
            .eq("id", m.user_id)
            .maybeSingle();
          setMessages((prev) => [...prev.slice(-99), { ...m, ...(p ?? {}) }]);
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!userId || !text.trim() || busy) return;
    setBusy(true);
    const body = text.trim().slice(0, 500);
    setText("");
    const { error } = await supabase.from("live_chat_messages").insert({ live_id: liveId, user_id: userId, body });
    if (error) console.error(error);
    setBusy(false);
  }

  async function chatWith(uid: string) {
    if (!userId) {
      toast.error("Entre na conta para conversar");
      return;
    }
    if (uid === userId) return;
    try {
      const id = await getOrCreateDirectConversation(userId, uid);
      navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir chat");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-sm">
        {messages.map((m) => (
          <LiveChatMessage
            key={m.id}
            m={m}
            canChat={!!userId && m.user_id !== userId}
            onChat={() => chatWith(m.user_id)}
          />
        ))}
      </div>
      {userId ? (
        <form onSubmit={send} className="p-2 flex gap-2 bg-black/40 backdrop-blur">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={text}
              onChange={mention.onChange}
              onKeyDown={mention.onKeyDown}
              placeholder="Diga algo… use @ para mencionar"
              maxLength={500}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
            />
            {mention.popover}
          </div>
          <Button type="submit" size="icon" disabled={busy || !text.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <div className="p-3 text-center text-xs text-white/80 bg-black/40">Entre na conta para conversar</div>
      )}
    </div>
  );
}

function LiveChatMessage({ m, canChat, onChat }: { m: Msg; canChat: boolean; onChat: () => void }) {
  const [translated, setTranslated] = useState<string | null>(null);
  return (
    <div className="text-white drop-shadow leading-tight flex items-start gap-1.5">
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-primary mr-1">{m.display_name || m.username || "User"}</span>
        <MentionText text={translated ?? m.body} className="opacity-95 break-words" mentionClassName="font-bold text-primary underline" />
        <TranslateButton text={m.body} variant="dark" size="xs" className="ml-2 align-middle" onTranslated={setTranslated} />
      </div>
      {canChat && (
        <button
          type="button"
          onClick={onChat}
          className="shrink-0 p-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition"
          aria-label="Conversar"
        >
          <MessageCircle className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  );
}
