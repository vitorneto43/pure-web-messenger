import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  Music,
  Paperclip,
  Phone,
  QrCode,
  Search,
  Send,
  Share2,
  Smile,
  Sparkles,
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
import { Textarea } from "@/components/ui/textarea";
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
import { AIAssistantDialog, type AIAction } from "./AIAssistantDialog";
import { ShareLocationDialog } from "./ShareLocationDialog";
import { LocationMessage } from "./LocationMessage";
import { useTranslation } from "react-i18next";

interface AIRequest {
  action: AIAction;
  text?: string;
  context?: string;
  tone?: "neutral" | "formal" | "friendly" | "short" | "funny";
}

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
  const { t } = useTranslation();
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
  const [locationOpen, setLocationOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ForwardableMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<ActionableMessage | null>(null);
  const [aiRequest, setAiRequest] = useState<AIRequest | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

      setLoading(false);

      // Non-critical: mark as read in the background so the UI doesn't wait
      void supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);

      void supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null)
        .filter("data->>conversation_id", "eq", conversationId);
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
      if (!conv?.is_group) return t("chat.typing");
      const names = typingUsers
        .map((id) => members.find((m) => m.id === id)?.display_name?.split(" ")[0])
        .filter(Boolean);
      return t("chat.typingNames", { names: names.join(", ") });
    }
    if (conv?.is_group) return t("chat.participantsCount", { count: members.length });
    if (otherUser) {
      const online = Date.now() - new Date(otherUser.last_seen).getTime() < 2 * 60_000;
      return online ? t("chat.online") : t("chat.lastSeen", { time: formatFullTime(otherUser.last_seen) });
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
            : content.trim() || (attachment?.type?.startsWith("image") ? t("chat.photoAttachment") : t("chat.fileAttachment")),
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
    if (file.size > 15 * 1024 * 1024) return toast.error(t("chat.maxFileSizeError"));
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
      toast.error(t("chat.audioNotSupported"));
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
      toast.error(t("chat.microphonePermissionDenied"));
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

  function buildConversationContext(lastN = 15): string {
    const recent = messages.slice(-lastN);
    return recent
      .filter((m) => m.content && !m.deleted_for_everyone_at && !m.content.startsWith("[["))
      .map((m) => {
        const who =
          m.sender_id === user?.id
            ? "Eu"
            : members.find((p) => p.id === m.sender_id)?.display_name ?? "Contato";
        return `${who}: ${m.content}`;
      })
      .join("\n");
  }

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
          title={conv?.is_group ? t("chat.viewGroupDetails") : undefined}
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
              title={t("chat.voiceCall")}
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
              title={t("chat.videoCall")}
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
            placeholder={t("chat.searchMessages")}
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
{searchTerm ? t("chat.noMessagesFound") : t("chat.sayHi")}
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
                    {t("chat.messageDeleted")}
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
                      title={t("chat.downloadImage")}
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
                      <Download className="size-3" /> {t("chat.downloadVideo")}
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
                      <Download className="size-3" /> {t("chat.downloadAudio")}
                    </button>
                  </div>
                )}
                {m.attachment_url && m.attachment_type === "location" && (() => {
                  const coords = m.attachment_url.replace(/^geo:/, "").split(",");
                  const lat = parseFloat(coords[0]);
                  const lng = parseFloat(coords[1]);
                  if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    return <LocationMessage kind="static" lat={lat} lng={lng} isMine={isMine} />;
                  }
                  return null;
                })()}
                {m.attachment_url && m.attachment_type === "live-location" && (() => {
                  const liveId = m.attachment_url.replace(/^live:/, "");
                  return (
                    <LocationMessage
                      kind="live"
                      liveId={liveId}
                      ownerId={m.sender_id}
                      isMine={isMine}
                    />
                  );
                })()}
                {m.attachment_url &&
                  !m.attachment_type?.startsWith("image/") &&
                  !m.attachment_type?.startsWith("video/") &&
                  !m.attachment_type?.startsWith("audio/") &&
                  m.attachment_type !== "location" &&
                  m.attachment_type !== "live-location" && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(m.attachment_url!, m.attachment_name ?? undefined)
                      }
                      className="flex items-center gap-2 text-sm underline mb-1"
                    >
                      <Download className="size-4" />
                      {m.attachment_name ?? t("chat.downloadFile")}
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
              title={t("chat.cancel")}
            >
              <Trash2 className="size-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2 px-4 h-11 rounded-full bg-destructive/10 border border-destructive/30">
              <span className="size-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">{t("chat.recording")}</span>
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
              title={t("chat.sendAudioTitle")}
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
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-1 overflow-x-auto">

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

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="rounded-full shrink-0"
                  disabled={uploading}
                  title={t("chat.attach", { defaultValue: "Anexar" })}
                >
                  <Paperclip className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-56 p-1">
                <AttachItem
                  icon={<ImageIcon className="size-4 text-blue-500" />}
                  label={t("chat.attachPhoto", { defaultValue: "Foto" })}
                  onClick={() => imgRef.current?.click()}
                />
                <AttachItem
                  icon={<Film className="size-4 text-purple-500" />}
                  label={t("chat.attachVideo", { defaultValue: "Vídeo" })}
                  onClick={() => videoRef.current?.click()}
                />
                <AttachItem
                  icon={<Music className="size-4 text-pink-500" />}
                  label={t("chat.attachMusic", { defaultValue: "Música" })}
                  onClick={() => audioRef.current?.click()}
                />
                <AttachItem
                  icon={<FileText className="size-4 text-orange-500" />}
                  label={t("chat.attachFile", { defaultValue: "Documento" })}
                  onClick={() => fileRef.current?.click()}
                />
                <AttachItem
                  icon={<Share2 className="size-4 text-sky-500" />}
                  label={t("chat.shareExternal", { defaultValue: "Compartilhar" })}
                  onClick={async () => {
                    const nav = navigator as any;
                    const payload = {
                      title: "WaveChat",
                      text: text.trim() || undefined,
                      url: typeof window !== "undefined" ? window.location.href : undefined,
                    };
                    if (nav.share) {
                      try { await nav.share(payload); } catch (e: any) {
                        if (e?.name !== "AbortError") toast.error("Não foi possível compartilhar");
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText([payload.text, payload.url].filter(Boolean).join("\n"));
                        toast.success("Copiado para a área de transferência");
                      } catch {
                        toast.error("Compartilhamento indisponível");
                      }
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAndSend(f);
                e.target.value = "";
              }}
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAndSend(f);
                e.target.value = "";
              }}
            />
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
              className="rounded-full shrink-0 text-emerald-500"
              onClick={() => setPixOpen(true)}
              title={t("chat.sendPix")}
            >
              <QrCode className="size-5" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full shrink-0 text-rose-500"
              onClick={() => setLocationOpen(true)}
              title={t("chat.shareLocation")}
            >
              <MapPin className="size-5" />
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

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="rounded-full shrink-0 text-primary"
                  title={t("chat.aiAssistant")}
                >
                  <Sparkles className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-56 p-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/40 text-sm disabled:opacity-50"
                  disabled={!text.trim()}
                  onClick={() =>
                    setAiRequest({ action: "improve", text, tone: "neutral" })
                  }
                >
                  {t("chat.aiImproveText")}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/40 text-sm disabled:opacity-50"
                  disabled={!text.trim()}
                  onClick={() =>
                    setAiRequest({ action: "improve", text, tone: "formal" })
                  }
                >
                  {t("chat.aiMakeFormal")}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/40 text-sm disabled:opacity-50"
                  disabled={!text.trim()}
                  onClick={() =>
                    setAiRequest({ action: "improve", text, tone: "friendly" })
                  }
                >
                  {t("chat.aiMakeFriendly")}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/40 text-sm disabled:opacity-50"
                  disabled={!text.trim()}
                  onClick={() =>
                    setAiRequest({ action: "improve", text, tone: "short" })
                  }
                >
                  {t("chat.aiMakeShorter")}
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/40 text-sm"
                  onClick={() => {
                    const lastIncoming = [...messages]
                      .reverse()
                      .find(
                        (m) =>
                          m.sender_id !== user?.id &&
                          m.content &&
                          !m.deleted_for_everyone_at &&
                          !m.content.startsWith("[["),
                      );
                    if (!lastIncoming?.content) {
                      toast.info(t("chat.noIncomingMessage"));
                      return;
                    }
                    setAiRequest({
                      action: "suggest_reply",
                      text: lastIncoming.content,
                      context: buildConversationContext(),
                    });
                  }}
                >
                  {t("chat.aiSuggestReply")}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/40 text-sm disabled:opacity-50"
                  disabled={messages.length < 2}
                  onClick={() =>
                    setAiRequest({
                      action: "summarize",
                      context: buildConversationContext(40),
                    })
                  }
                >
                  {t("chat.aiSummarize")}
                </button>
              </PopoverContent>
            </Popover>



            </div>

            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  handleTyping();
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(text);
                    const el = textareaRef.current;
                    if (el) {
                      el.style.height = "auto";
                    }
                  }
                }}
                placeholder={t("chat.writeMessage")}
                className="flex-1 min-w-0 rounded-2xl bg-background/80 resize-none py-2.5 px-4 min-h-[44px] max-h-[120px] overflow-y-auto leading-normal"
                maxLength={4000}
                rows={1}
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
                  title={t("chat.recordAudio")}
                >
                  <Mic className="size-5" />
                </Button>
              )}
            </div>
          </form>

        )}
      </div>
      <SendPixDialog
        open={pixOpen}
        onOpenChange={setPixOpen}
        onSend={(marker) => sendMessage(marker)}
      />
      {user && (
        <ShareLocationDialog
          open={locationOpen}
          onOpenChange={setLocationOpen}
          conversationId={conversationId}
          userId={user.id}
          onSent={async ({ content, attachment_url, attachment_type }) => {
            await sendMessage(content, {
              url: attachment_url,
              type: attachment_type,
              name: "",
            });
          }}
        />
      )}
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
        onTranslate={(t) => {
          setActionMsg(null);
          setAiRequest({ action: "translate", text: t });
        }}
        onSuggestReply={(t) => {
          setActionMsg(null);
          setAiRequest({
            action: "suggest_reply",
            text: t,
            context: buildConversationContext(),
          });
        }}
      />
      {aiRequest && (
        <AIAssistantDialog
          open={aiRequest !== null}
          onOpenChange={(v) => !v && setAiRequest(null)}
          action={aiRequest.action}
          text={aiRequest.text}
          context={aiRequest.context}
          tone={aiRequest.tone}
          onUseInComposer={
            aiRequest.action === "summarize"
              ? undefined
              : (r) => setText(r)
          }
          onSendDirect={
            aiRequest.action === "summarize"
              ? undefined
              : (r) => sendMessage(r)
          }
        />
      )}

      {conv?.is_group && (
        <GroupSettingsDialog
          conversationId={conversationId}
          open={groupSettingsOpen}
          onOpenChange={setGroupSettingsOpen}
          groupName={conv.name ?? t("chat.group")}
        />
      )}
    </div>
  );
}

function AttachItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/40 text-sm text-left"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
