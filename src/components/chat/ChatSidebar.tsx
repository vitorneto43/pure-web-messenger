import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  MessageSquarePlus,
  Search,
  Settings,
  UsersRound,
  Loader2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewChatDialog } from "./NewChatDialog";
import { NewGroupDialog } from "./NewGroupDialog";
import { NotificationsBell } from "./NotificationsBell";
import { StatusBar } from "@/components/status/StatusBar";
import { formatTime } from "@/lib/format-time";
import { setAppBadge } from "@/lib/app-badge";
import {
  requestBrowserNotificationPermission,
  playNotification,
  showBrowserNotification,
} from "@/lib/notification-sound";

interface ConversationItem {
  id: string;
  name: string | null;
  is_group: boolean;
  avatar_url: string | null;
  updated_at: string;
  other_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    last_seen: string;
  };
  last_message?: { content: string | null; created_at: string; sender_id: string };
  unread: number;
}

export function ChatSidebar({ activeConversationId }: { activeConversationId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);

  async function loadConversations() {
    if (!user) return;
    setLoading(true);
    // 1. all memberships of mine
    const { data: members } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);
    if (!members?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const convIds = members.map((m) => m.conversation_id);
    const readMap = new Map(members.map((m) => [m.conversation_id, m.last_read_at]));

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, name, is_group, avatar_url, updated_at")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    // members per conv (for 1:1 we need other user)
    const { data: allMembers } = await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds);

    const otherIds = Array.from(
      new Set(
        (allMembers ?? [])
          .filter((m) => m.user_id !== user.id)
          .map((m) => m.user_id)
      )
    );

    const { data: profiles } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, last_seen")
          .in("id", otherIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // last message per conversation
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, sender_id")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });
    const lastMap = new Map<string, any>();
    for (const m of lastMsgs ?? []) {
      if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m);
    }

    // unread counts
    const unreadMap = new Map<string, number>();
    for (const m of lastMsgs ?? []) {
      const last = readMap.get(m.conversation_id);
      if (m.sender_id !== user.id && (!last || new Date(m.created_at) > new Date(last))) {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
      }
    }

    const items: ConversationItem[] = (convs ?? []).map((c) => {
      const otherMember = (allMembers ?? []).find(
        (m) => m.conversation_id === c.id && m.user_id !== user.id
      );
      const other = otherMember ? profileMap.get(otherMember.user_id) : undefined;
      return {
        id: c.id,
        name: c.name,
        is_group: c.is_group,
        avatar_url: c.avatar_url,
        updated_at: c.updated_at,
        other_user: other as any,
        last_message: lastMap.get(c.id),
        unread: unreadMap.get(c.id) ?? 0,
      };
    });

    setConversations(items);
    setLoading(false);

    // Update Chrome / installed PWA icon badge with total unread count
    const totalUnread = items.reduce((sum, it) => sum + (it.unread ?? 0), 0);
    setAppBadge(totalUnread);
  }

  useEffect(() => {
    loadConversations();
  }, [user?.id]);

  // Realtime: refresh list on any new message
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("sidebar-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          loadConversations();
          if (
            msg.sender_id !== user.id &&
            msg.conversation_id !== activeConversationId
          ) {
            playNotification();
            showBrowserNotification("Nova mensagem", msg.content ?? "Anexo recebido");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` },
        () => loadConversations()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as { title: string; body: string | null };
          playNotification();
          toast.success(n.title, { description: n.body ?? undefined, duration: 6000 });
          showBrowserNotification(n.title, n.body ?? "");
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, activeConversationId]);

  async function inviteFriend() {
    const username = user?.user_metadata?.username;
    const base = window.location.origin;
    const link = username ? `${base}/auth?invite=${encodeURIComponent(username)}` : `${base}/auth`;
    const shareText = `Vamos conversar no Wavechat! Crie sua conta aqui: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Wavechat", text: shareText, url: link });
        return;
      }
    } catch {
      // user cancelled share — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de convite copiado!");
    } catch {
      toast.error("Não foi possível copiar. Link: " + link);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Você saiu");
    navigate({ to: "/auth" });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.is_group ? c.name ?? "Grupo" : c.other_user?.display_name ?? "";
      const uname = c.other_user?.username ?? "";
      return name.toLowerCase().includes(q) || uname.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  return (
    <>
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow">
            <span className="text-primary-foreground font-bold text-sm">W</span>
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">Wavechat</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {user?.email}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="rounded-full">
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/profile">Meu perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                <UsersRound className="size-4 mr-2" /> Novo grupo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="size-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-9 bg-sidebar-hover border-transparent focus-visible:bg-card"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setNewChatOpen(true)}
            size="sm"
            className="flex-1 rounded-full"
          >
            <MessageSquarePlus className="size-4 mr-1.5" /> Nova
          </Button>
          <Button
            onClick={() => setNewGroupOpen(true)}
            size="sm"
            variant="secondary"
            className="rounded-full"
          >
            <UsersRound className="size-4 mr-1.5" /> Grupo
          </Button>
          <Button
            onClick={inviteFriend}
            size="sm"
            variant="secondary"
            className="rounded-full"
            title="Copiar link de convite"
          >
            <UserPlus className="size-4 mr-1.5" /> Convidar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10 px-4">
            Nenhuma conversa ainda. Clique em <b>Nova</b> para começar.
          </p>
        ) : (
          filtered.map((c) => (
            <ConversationRow
              key={c.id}
              conv={c}
              active={c.id === activeConversationId}
              currentUserId={user!.id}
            />
          ))
        )}
      </div>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onCreated={(id) => {
          setNewChatOpen(false);
          navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
        }}
      />
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onCreated={(id) => {
          setNewGroupOpen(false);
          navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
        }}
      />
    </>
  );
}

function ConversationRow({
  conv,
  active,
  currentUserId,
}: {
  conv: ConversationItem;
  active: boolean;
  currentUserId: string;
}) {
  const name = conv.is_group ? conv.name ?? "Grupo" : conv.other_user?.display_name ?? "Usuário";
  const avatar = conv.is_group ? conv.avatar_url : conv.other_user?.avatar_url;
  const online =
    !conv.is_group &&
    conv.other_user &&
    Date.now() - new Date(conv.other_user.last_seen).getTime() < 2 * 60_000;

  const preview = conv.last_message?.content
    ? (conv.last_message.sender_id === currentUserId ? "Você: " : "") +
      conv.last_message.content
    : "Nenhuma mensagem ainda";

  return (
    <Link
      to="/chat/$conversationId"
      params={{ conversationId: conv.id }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        active ? "bg-sidebar-hover" : "hover:bg-sidebar-hover/60"
      }`}
    >
      <div className="relative">
        <Avatar className="size-11">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback className="bg-secondary text-sm">
            {name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {online && (
          <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          {conv.last_message && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatTime(conv.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">{preview}</p>
          {conv.unread > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px] grid place-items-center rounded-full">
              {conv.unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
