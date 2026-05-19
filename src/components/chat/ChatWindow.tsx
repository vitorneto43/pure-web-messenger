import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatFullTime } from "@/lib/format-time";
import { playNotification } from "@/lib/notification-sound";

const EMOJIS = [
  "😀","😂","🤣","😊","😍","😘","😎","🤔","🙃","😴",
  "👍","👏","🙏","🤝","💪","🔥","✨","🎉","❤️","💔",
  "😢","😭","😡","🤯","🥳","😇","🤗","😅","😬","🙄",
  "👀","🚀","⭐","🌟","💯","✅","❌","⚡","☀️","🌙",
];

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_seen: string;
}

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conv, setConv] = useState<any>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [othersLastRead, setOthersLastRead] = useState<Date | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef<number>(0);

  // Audio recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordCancelledRef = useRef(false);

  // Load conversation + members + messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [{ data: c }, { data: mems }, { data: msgs }] = await Promise.all([
        supabase.from("conversations").select("*").eq("id", conversationId).single(),
        supabase
          .from("conversation_members")
          .select("user_id, last_read_at")
          .eq("conversation_id", conversationId),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);
      if (cancelled) return;
      setConv(c);
      setMessages((msgs as Message[]) ?? []);

      const memberIds = (mems ?? []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, last_seen")
        .in("id", memberIds);
      if (cancelled) return;
      setMembers((profiles as Profile[]) ?? []);

      // others' read receipts
      const otherReads = (mems ?? [])
        .filter((m) => m.user_id !== user.id)
        .map((m) => new Date(m.last_read_at));
      if (otherReads.length) {
        setOthersLastRead(new Date(Math.min(...otherReads.map((d) => d.getTime()))));
      }

      // mark as read
      await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, user?.id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
          if (m.sender_id !== user.id) {
            playNotification();
            // mark read since chat is open
            supabase
              .from("conversation_members")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", conversationId)
              .eq("user_id", user.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const old = payload.old as Message;
          setMessages((prev) => prev.filter((x) => x.id !== old.id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          const { data } = await supabase
            .from("typing_indicators")
            .select("user_id, updated_at")
            .eq("conversation_id", conversationId);
          const cutoff = Date.now() - 5000;
          setTypingUsers(
            (data ?? [])
              .filter(
                (t) => t.user_id !== user.id && new Date(t.updated_at).getTime() > cutoff
              )
              .map((t) => t.user_id)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as any;
          if (m.user_id !== user.id) {
            setOthersLastRead(new Date(m.last_read_at));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, user?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  const otherUser = useMemo(
    () => (conv && !conv.is_group ? members.find((m) => m.id !== user?.id) : null),
    [conv, members, user?.id]
  );
  const headerTitle = conv?.is_group ? conv.name : otherUser?.display_name ?? "...";
  const headerAvatar = conv?.is_group ? conv.avatar_url : otherUser?.avatar_url;
  const headerSub = useMemo(() => {
    if (typingUsers.length) {
      if (!conv?.is_group) return "digitando...";
      const names = typingUsers
        .map((id) => members.find((m) => m.id === id)?.display_name?.split(" ")[0])
        .filter(Boolean);
      return `${names.join(", ")} digitando...`;
    }
    if (conv?.is_group) return `${members.length} participantes`;
    if (otherUser) {
      const online = Date.now() - new Date(otherUser.last_seen).getTime() < 2 * 60_000;
      return online ? "online" : `visto por último ${formatFullTime(otherUser.last_seen)}`;
    }
    return "";
  }, [typingUsers, members, otherUser, conv]);

  async function sendMessage(content: string, attachment?: {
    url: string;
    type: string;
    name: string;
  }) {
    if (!user) return;
    if (!content.trim() && !attachment) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim() || null,
        attachment_url: attachment?.url ?? null,
        attachment_type: attachment?.type ?? null,
        attachment_name: attachment?.name ?? null,
      });
      if (error) throw error;
      setText("");
      // clear typing
      await supabase
        .from("typing_indicators")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleTyping() {
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 2000) return;
    lastTypingPing.current = now;
    await supabase.from("typing_indicators").upsert(
      {
        conversation_id: conversationId,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" }
    );
  }

  async function uploadAndSend(file: File) {
    if (!user) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Máximo 15MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      await sendMessage("", {
        url: data.publicUrl,
        type: file.type,
        name: file.name,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const q = searchTerm.toLowerCase();
    return messages.filter((m) => m.content?.toLowerCase().includes(q));
  }, [messages, searchTerm]);

  if (loading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-16 px-3 sm:px-5 border-b border-border flex items-center gap-3 glass">
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-accent/30"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Avatar className="size-10">
          <AvatarImage src={headerAvatar ?? undefined} />
          <AvatarFallback>{headerTitle?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{headerTitle}</div>
          <div className="text-[11px] text-muted-foreground truncate">{headerSub}</div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => setShowSearch((s) => !s)}
        >
          <Search className="size-4" />
        </Button>
      </header>

      {showSearch && (
        <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center gap-2">
          <Input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar nas mensagens..."
            className="h-9"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setShowSearch(false);
              setSearchTerm("");
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 sm:px-6 py-4 space-y-1">
        {filteredMessages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-16">
            {searchTerm ? "Nenhuma mensagem encontrada" : "Diga oi! 👋"}
          </div>
        )}
        {filteredMessages.map((m, idx) => {
          const prev = filteredMessages[idx - 1];
          const isMine = m.sender_id === user!.id;
          const sender = members.find((p) => p.id === m.sender_id);
          const showAvatar =
            !isMine && (!prev || prev.sender_id !== m.sender_id);
          const grouped = prev && prev.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;

          const seen = isMine && othersLastRead && new Date(m.created_at) <= othersLastRead;

          return (
            <div
              key={m.id}
              className={`flex gap-2 ${isMine ? "justify-end" : "justify-start"} ${
                grouped ? "mt-0.5" : "mt-2"
              }`}
            >
              {!isMine && (
                <div className="w-8 shrink-0">
                  {showAvatar && (
                    <Avatar className="size-8">
                      <AvatarImage src={sender?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {sender?.display_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
              <div
                className={`max-w-[75%] sm:max-w-[60%] rounded-2xl px-3.5 py-2 shadow-sm animate-in-up ${
                  isMine
                    ? "bg-bubble-out text-bubble-out-foreground rounded-br-md"
                    : "bg-bubble-in text-bubble-in-foreground rounded-bl-md"
                }`}
              >
                {!isMine && conv?.is_group && showAvatar && (
                  <div className="text-[11px] font-semibold text-primary mb-0.5">
                    {sender?.display_name}
                  </div>
                )}
                {m.attachment_url && m.attachment_type?.startsWith("image/") && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer">
                    <img
                      src={m.attachment_url}
                      alt={m.attachment_name ?? ""}
                      className="rounded-lg max-h-72 mb-1 object-cover"
                    />
                  </a>
                )}
                {m.attachment_url && m.attachment_type?.startsWith("audio/") && (
                  <audio
                    controls
                    preload="metadata"
                    src={m.attachment_url}
                    className="mb-1 max-w-full"
                  />
                )}
                {m.attachment_url &&
                  !m.attachment_type?.startsWith("image/") &&
                  !m.attachment_type?.startsWith("audio/") && (
                    <a
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm underline mb-1"
                    >
                      <Paperclip className="size-4" />
                      {m.attachment_name ?? "Arquivo"}
                    </a>
                  )}
                {m.content && (
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                )}
                <div
                  className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                    isMine ? "text-bubble-out-foreground/70 justify-end" : "text-muted-foreground"
                  }`}
                >
                  {formatFullTime(m.created_at)}
                  {isMine &&
                    (seen ? (
                      <CheckCheck className="size-3.5" />
                    ) : (
                      <Check className="size-3.5" />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className="flex justify-start gap-2 mt-2">
            <div className="w-8" />
            <div className="bg-bubble-in rounded-2xl rounded-bl-md px-4 py-2.5 inline-flex gap-1">
              <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" />
              <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:.15s]" />
              <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:.3s]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="p-3 sm:p-4 border-t border-border bg-card/60 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(text);
          }}
          className="flex items-end gap-2"
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="rounded-full shrink-0">
                <Smile className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-72 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setText((t) => t + e)}
                    className="text-xl p-1 hover:bg-accent/30 rounded"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full shrink-0"
            onClick={() => imgRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon className="size-5" />
          </Button>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAndSend(f);
              e.target.value = "";
            }}
          />

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="size-5" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAndSend(f);
              e.target.value = "";
            }}
          />

          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            placeholder="Escreva uma mensagem..."
            className="flex-1 rounded-full bg-background/80 h-11"
            maxLength={4000}
          />

          <Button
            type="submit"
            size="icon"
            className="rounded-full size-11 shrink-0"
            disabled={sending || uploading || (!text.trim())}
          >
            {sending || uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
