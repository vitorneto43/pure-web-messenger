import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Phone,
  QrCode,
  Search,
  Send,
  Smile,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { downloadFile } from "@/lib/download";
import { useCall } from "@/hooks/use-call";
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
import { sendMessagePush } from "@/lib/push.functions";
import { MessageContent } from "./MessageContent";
import { SendPixDialog } from "./SendPixDialog";
import { ForwardMessageDialog, type ForwardableMessage } from "./ForwardMessageDialog";
import { MessageActionsDialog, type ActionableMessage } from "./MessageActionsDialog";
import { GroupSettingsDialog } from "./GroupSettingsDialog";

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
  deleted_for_everyone_at: string | null;
  deleted_for: string[] | null;
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
  const { startCall } = useCall();
  const [conv, setConv] = useState<any>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [othersLastRead, setOthersLastRead] = useState<Date | null>(null);

  const [pixOpen, setPixOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ForwardableMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<ActionableMessage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // mark related notifications as read
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null)
        .filter("data->>conversation_id", "eq", conversationId);

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
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
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

  // Auto-scroll — jump instantly to the bottom on first load (so the chat
  // opens at the latest message), then smooth-scroll for new messages.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!didInitialScrollRef.current) {
      // Wait one frame so the message list has its final height.
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
        didInitialScrollRef.current = true;
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [loading, messages.length, typingUsers.length]);

  // Reset the initial-scroll flag when switching conversations.
  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [conversationId]);

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
      // Fire-and-forget push notification to other members
      void sendMessagePush({
        data: {
          conversationId,
          preview: content.trim().startsWith("[[PIX:")
            ? "💸 Pix"
            : content.trim() || (attachment?.type?.startsWith("image") ? "📷 Foto" : "📎 Anexo"),
        },
      }).catch(() => {});
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

  async function startRecording() {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Gravação de áudio não suportada neste navegador");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recordCancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setRecording(false);
        setRecordSeconds(0);
        if (recordCancelledRef.current || chunksRef.current.length === 0) return;
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type });
        await uploadAndSend(file);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 120) {
            // auto-stop at 2 min
            stopRecording(false);
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Permita o acesso ao microfone para gravar");
    }
  }

  function stopRecording(cancel: boolean) {
    const rec = recorderRef.current;
    if (!rec) return;
    recordCancelledRef.current = cancel;
    if (rec.state !== "inactive") rec.stop();
  }



  const filteredMessages = useMemo(() => {
    const myId = user?.id;
    const visible = messages.filter(
      (m) => !myId || !(m.deleted_for ?? []).includes(myId)
    );
    if (!searchTerm.trim()) return visible;
    const q = searchTerm.toLowerCase();
    return visible.filter((m) => m.content?.toLowerCase().includes(q));
  }, [messages, searchTerm, user?.id]);

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
        <button
          type="button"
          onClick={() => conv?.is_group && setGroupSettingsOpen(true)}
          disabled={!conv?.is_group}
          className="flex items-center gap-3 flex-1 min-w-0 text-left -mx-1 px-1 rounded-lg hover:bg-accent/20 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
          title={conv?.is_group ? "Ver detalhes do grupo" : undefined}
        >
          <Avatar className="size-10">
            <AvatarImage src={headerAvatar ?? undefined} />
            <AvatarFallback>{headerTitle?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{headerTitle}</div>
            <div className="text-[11px] text-muted-foreground truncate">{headerSub}</div>
          </div>
        </button>
        {!conv?.is_group && otherUser && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full"
              title="Chamada de voz"
              onClick={() =>
                startCall({
                  conversationId,
                  calleeId: otherUser.id,
                  kind: "audio",
                  peerProfile: {
                    id: otherUser.id,
                    display_name: otherUser.display_name,
                    avatar_url: otherUser.avatar_url,
                  },
                })
              }
            >
              <Phone className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full"
              title="Chamada de vídeo"
              onClick={() =>
                startCall({
                  conversationId,
                  calleeId: otherUser.id,
                  kind: "video",
                  peerProfile: {
                    id: otherUser.id,
                    display_name: otherUser.display_name,
                    avatar_url: otherUser.avatar_url,
                  },
                })
              }
            >
              <Video className="size-4" />
            </Button>
          </>
        )}
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActionMsg({
                    id: m.id,
                    sender_id: m.sender_id,
                    created_at: m.created_at,
                    content: m.content,
                    attachment_url: m.attachment_url,
                    attachment_type: m.attachment_type,
                    attachment_name: m.attachment_name,
                    deleted_for_everyone_at: m.deleted_for_everyone_at,
                  });
                }}
                onTouchStart={() => {
                  if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = setTimeout(() => {
                    setActionMsg({
                      id: m.id,
                      sender_id: m.sender_id,
                      created_at: m.created_at,
                      content: m.content,
                      attachment_url: m.attachment_url,
                      attachment_type: m.attachment_type,
                      attachment_name: m.attachment_name,
                      deleted_for_everyone_at: m.deleted_for_everyone_at,
                    });
                  }, 500);
                }}
                onTouchEnd={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onTouchMove={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                className={`max-w-[75%] sm:max-w-[60%] rounded-2xl px-3.5 py-2 shadow-sm animate-in-up select-none cursor-pointer ${
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
                {m.deleted_for_everyone_at ? (
                  <div className="text-sm italic opacity-70">
                    Esta mensagem foi apagada
                  </div>
                ) : (
                  <></>
                )}
                {m.attachment_url && m.attachment_type?.startsWith("image/") && (
                  <div className="relative group mb-1">
                    <a href={m.attachment_url} target="_blank" rel="noreferrer">
                      <img
                        src={m.attachment_url}
                        alt={m.attachment_name ?? ""}
                        className="rounded-lg max-h-72 object-cover"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        downloadFile(m.attachment_url!, m.attachment_name ?? undefined);
                      }}
                      className="absolute top-1.5 right-1.5 size-8 grid place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                      title="Baixar imagem"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                )}
                {m.attachment_url && m.attachment_type?.startsWith("video/") && (
                  <div className="mb-1 space-y-1">
                    <video
                      controls
                      preload="metadata"
                      src={m.attachment_url}
                      className="rounded-lg max-h-72 w-full bg-black"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(m.attachment_url!, m.attachment_name ?? undefined)
                      }
                      className={`text-[11px] inline-flex items-center gap-1 underline ${
                        isMine ? "text-bubble-out-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      <Download className="size-3" /> Baixar vídeo
                    </button>
                  </div>
                )}
                {m.attachment_url && m.attachment_type?.startsWith("audio/") && (
                  <div className="mb-1 space-y-1">
                    <audio
                      controls
                      preload="metadata"
                      src={m.attachment_url}
                      className="max-w-full"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(m.attachment_url!, m.attachment_name ?? undefined)
                      }
                      className={`text-[11px] inline-flex items-center gap-1 underline ${
                        isMine ? "text-bubble-out-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      <Download className="size-3" /> Baixar áudio
                    </button>
                  </div>
                )}
                {m.attachment_url &&
                  !m.attachment_type?.startsWith("image/") &&
                  !m.attachment_type?.startsWith("video/") &&
                  !m.attachment_type?.startsWith("audio/") && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(m.attachment_url!, m.attachment_name ?? undefined)
                      }
                      className="flex items-center gap-2 text-sm underline mb-1"
                    >
                      <Download className="size-4" />
                      {m.attachment_name ?? "Baixar arquivo"}
                    </button>
                  )}
                {m.content && (
                  <MessageContent content={m.content} isMine={isMine} />
                )}
                <div
                  className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                    isMine ? "text-bubble-out-foreground/70 justify-end" : "text-muted-foreground"
                  }`}
                >
                  {formatFullTime(m.created_at)}
                  {isMine && (
                    <CheckCheck
                      className={`size-3.5 transition-colors ${
                        seen ? "text-sky-400" : "text-bubble-out-foreground/60"
                      }`}
                    />
                  )}
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
        {recording ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full shrink-0 text-destructive hover:text-destructive"
              onClick={() => stopRecording(true)}
              title="Cancelar"
            >
              <Trash2 className="size-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2 px-4 h-11 rounded-full bg-destructive/10 border border-destructive/30">
              <span className="size-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">Gravando</span>
              <span className="ml-auto text-sm tabular-nums text-destructive">
                {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
                {String(recordSeconds % 60).padStart(2, "0")}
              </span>
            </div>
            <Button
              type="button"
              size="icon"
              className="rounded-full size-11 shrink-0"
              onClick={() => stopRecording(false)}
              title="Enviar áudio"
            >
              <Send className="size-5" />
            </Button>
          </div>
        ) : (
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

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full shrink-0 text-emerald-500"
              onClick={() => setPixOpen(true)}
              title="Enviar Pix"
            >
              <QrCode className="size-5" />
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

            {text.trim() ? (
              <Button
                type="submit"
                size="icon"
                className="rounded-full size-11 shrink-0"
                disabled={sending || uploading}
              >
                {sending || uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Send className="size-5" />
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="rounded-full size-11 shrink-0"
                onClick={startRecording}
                disabled={sending || uploading}
                title="Gravar áudio"
              >
                <Mic className="size-5" />
              </Button>
            )}
          </form>
        )}
      </div>
      <SendPixDialog
        open={pixOpen}
        onOpenChange={setPixOpen}
        onSend={(marker) => sendMessage(marker)}
      />
      <ForwardMessageDialog
        open={forwardMsg !== null}
        onOpenChange={(v) => !v && setForwardMsg(null)}
        message={forwardMsg}
        excludeConversationId={conversationId}
      />
      <MessageActionsDialog
        open={actionMsg !== null}
        onOpenChange={(v) => !v && setActionMsg(null)}
        message={actionMsg}
        onForward={() => {
          if (!actionMsg) return;
          setForwardMsg({
            content: actionMsg.content,
            attachment_url: actionMsg.attachment_url,
            attachment_type: actionMsg.attachment_type,
            attachment_name: actionMsg.attachment_name,
          });
          setActionMsg(null);
        }}
      />
      {conv?.is_group && (
        <GroupSettingsDialog
          conversationId={conversationId}
          open={groupSettingsOpen}
          onOpenChange={setGroupSettingsOpen}
          groupName={conv.name ?? "Grupo"}
        />
      )}
    </div>
  );
}
