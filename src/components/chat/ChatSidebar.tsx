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
  HelpCircle,
  BookOpen,
  User as UserIcon,
  Newspaper,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LiveAvatarRing } from "@/components/live/LiveAvatarRing";
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
import { OnlineUsersStrip } from "@/components/OnlineUsersStrip";
import { InviteDialog } from "@/components/InviteDialog";
import { InviteMissionBanner } from "./InviteMissionBanner";
import { MeetPeopleCard } from "./MeetPeopleCard";
import { ProfileCompletionBanner } from "./ProfileCompletionBanner";
import { AdsterraBanner } from "@/components/ads/AdsterraBanner";
import { formatTime } from "@/lib/format-time";
import { useTranslation } from "react-i18next";
import { setAppBadge } from "@/lib/app-badge";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "groups" | "direct">("all");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [groupResults, setGroupResults] = useState<any[]>([]);

  useEffect(() => {
    if (user) requestBrowserNotificationPermission();
  }, [user?.id]);

  async function loadConversations() {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }
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

    // unread counts — WhatsApp rule: if the latest message in a conversation
    // was sent by ME, the conversation is read (sending implies reading).
    const unreadMap = new Map<string, number>();
    for (const m of lastMsgs ?? []) {
      const last = readMap.get(m.conversation_id);
      if (m.sender_id !== user.id && (!last || new Date(m.created_at) > new Date(last))) {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
      }
    }
    // Override: any conv whose latest message is mine has unread = 0.
    for (const [convId, latest] of lastMap.entries()) {
      if (latest.sender_id === user.id) unreadMap.set(convId, 0);
    }
    // Also clear for the currently-open conversation.
    if (activeConversationId) unreadMap.set(activeConversationId, 0);

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

  // When user navigates back to /chat root (no active conversation), refresh
  // so newly created groups / direct chats appear without needing a hard reload.
  useEffect(() => {
    if (!user) return;
    if (!activeConversationId) loadConversations();
  }, [activeConversationId, user?.id]);

  // Global user search — when the sidebar search has text, look up users in
  // parallel so you can start a chat with anyone, not only people you've
  // talked to before.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setUserResults([]);
      setGroupResults([]);
      return;
    }
    let cancelled = false;
    setSearchingUsers(true);
    const handle = setTimeout(async () => {
      const [usersRes, groupsRes] = await Promise.all([
        (supabase as any).rpc(user ? "search_users" : "public_search_users", { q }),
        import("@/lib/groups.functions").then((m) => m.searchGroupsPublic({ data: { q } })).catch(() => ({ groups: [] })),
      ]);
      if (cancelled) return;
      setUserResults((usersRes.data as any[]) ?? []);
      setGroupResults(groupsRes.groups ?? []);
      setSearchingUsers(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search]);

  async function openDirectWith(otherUserId: string) {
    if (!user) {
      gate("message", () => undefined);
      return;
    }
    if (!user || startingChat) return;
    if (otherUserId === user.id) {
      toast.error(t("chat.cannotChatWithSelf"));
      return;
    }
    setStartingChat(true);
    try {
      const id = await getOrCreateDirectConversation(user.id, otherUserId);
      setSearch("");
      setUserResults([]);
      navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStartingChat(false);
    }
  }


  // When the user opens a conversation, immediately clear its unread badge
  // locally so the number disappears as soon as they tap the message —
  // don't wait for the background mark-as-read + reload round trip.
  useEffect(() => {
    if (!activeConversationId) return;
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.id === activeConversationId && c.unread > 0) {
          changed = true;
          return { ...c, unread: 0 };
        }
        return c;
      });
      if (!changed) return prev;
      const totalUnread = next.reduce((sum, it) => sum + (it.unread ?? 0), 0);
      setAppBadge(totalUnread);
      return next;
    });
  }, [activeConversationId]);

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
            showBrowserNotification(t("chat.newMessage"), msg.content ?? t("chat.attachmentReceived"));
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
        { event: "UPDATE", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` },
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

  function inviteFriend() {
    if (!user) {
      gate("default", () => undefined);
      return;
    }
    setInviteOpen(true);
  }

  async function logout() {
    await supabase.auth.signOut();
    toast.success(t("chat.loggedOut"));
    navigate({ to: "/auth" });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = conversations;
    if (filter === "groups") list = list.filter((c) => c.is_group);
    else if (filter === "direct") list = list.filter((c) => !c.is_group);
    if (!q) return list;
    return list.filter((c) => {
      const name = c.is_group ? c.name ?? t("chat.group") : c.other_user?.display_name ?? "";
      const uname = c.other_user?.username ?? "";
      return name.toLowerCase().includes(q) || uname.toLowerCase().includes(q);
    });
  }, [conversations, search, filter, t]);

  // Users from global search that the current user has no conversation with yet
  const newUserResults = useMemo(() => {
    if (!search.trim()) return [];
    const existingDirectIds = new Set(
      conversations
        .filter((c) => !c.is_group && c.other_user?.id)
        .map((c) => c.other_user!.id),
    );
    return userResults.filter(
      (u) => u.id !== user?.id && !existingDirectIds.has(u.id),
    );
  }, [userResults, conversations, search, user?.id]);

  return (
    <>
      {GateDialog}
      <div className="px-2 py-3 flex items-center justify-between gap-1 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow">
            <span className="text-primary-foreground font-bold text-sm">W</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <div className="font-semibold text-sm leading-tight">Wavechat</div>
              <a
                href="https://play.google.com/store/apps/details?id=com.wavechat.app"
                target="_blank"
                rel="noopener noreferrer"
                title="Baixe na Play Store"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent/40 transition leading-none"
              >
                <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85A1.5 1.5 0 0 1 3 20.5Zm13.81-5.38L6.05 21.34 14.54 12.85l2.27 2.27Zm3.35-4.31a1.495 1.495 0 0 1 0 2.38l-2.27 1.31L15.39 12l2.27-2.5 2.27 1.31ZM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66Z" />
                </svg>
                Baixar app
              </a>
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {user?.email ?? "Visitante · 100% grátis"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0 shrink-0">
          <Button size="icon" variant="ghost" className="rounded-full size-8" asChild>
            <Link to="/live" title="Lives">
              <Radio className="size-4 text-red-500" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" className="rounded-full size-8" asChild>
            <Link to="/posts" title="Posts">
              <Newspaper className="size-4" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" className="rounded-full size-8" asChild>
            <Link to="/diretrizes" title={t("nav.guidelines")}>
              <BookOpen className="size-4" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" className="rounded-full size-8" asChild>
            <Link to="/guide" title={t("chat.help")}>
              <HelpCircle className="size-4" />
            </Link>
          </Button>
          {user ? <NotificationsBell /> : (
            <Button size="icon" variant="ghost" className="rounded-full relative size-8" onClick={() => gate("default", () => undefined)}>
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
              <Settings className="size-4" />
            </Button>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-full size-8">
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/profile">{t("chat.myProfile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                  <UsersRound className="size-4 mr-2" /> {t("chat.newGroup")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="size-4 mr-2" /> {t("chat.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <StatusBar />

      <div className="px-3 pt-2 pb-2 space-y-2 border-b border-border bg-sidebar">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.searchConversations")}
            className="pl-9 bg-sidebar-hover border-transparent focus-visible:bg-card"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => gate("message", () => setNewChatOpen(true))}
            size="sm"
            className="flex-1 rounded-full"
          >
            <MessageSquarePlus className="size-4 mr-1.5" /> {t("chat.new")}
          </Button>
          <Button asChild size="sm" variant="secondary" className="rounded-full">
            <Link to="/live"><Radio className="size-4 mr-1.5 text-red-500" />Lives</Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="rounded-full">
            <Link to="/posts"><Newspaper className="size-4 mr-1.5" />Posts</Link>
          </Button>
          <Button
            onClick={() => gate("join_group", () => setNewGroupOpen(true))}
            size="sm"
            variant="secondary"
            className="rounded-full"
          >
            <UsersRound className="size-4 mr-1.5" /> {t("chat.group")}
          </Button>
          <Button
            onClick={inviteFriend}
            size="sm"
            variant="secondary"
            className="rounded-full"
            title={t("chat.copyInviteLink")}
          >
            <UserPlus className="size-4 mr-1.5" /> {t("chat.invite")}
          </Button>
        </div>
        <div className="flex gap-1.5 pt-0.5">
          {(["all", "direct", "groups"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-sidebar-hover text-muted-foreground hover:text-foreground"
              }`}
            >
              {key === "all" ? t("chat.filterAll") : key === "direct" ? t("chat.filterDirect") : t("chat.filterGroups")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        
        <ProfileCompletionBanner />
        <InviteMissionBanner />
        <MeetPeopleCard />
        <AdsterraBanner variant="banner_320x50" className="px-1 pt-2 pb-1" />
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {filtered.length === 0 && newUserResults.length === 0 && !searchingUsers && (
              <p className="text-center text-sm text-muted-foreground py-10 px-4">
                {search.trim() ? (
                  t("chat.noUsersFound")
                ) : (
                  <>
                    {t("chat.noConversationsBefore")}
                    <b>{t("chat.noConversationsBold")}</b>
                    {t("chat.noConversationsAfter")}
                  </>
                )}
              </p>
            )}
            {filtered.map((c) => (
              <ConversationRow
                key={c.id}
                conv={c}
                active={c.id === activeConversationId}
                currentUserId={user!.id}
              />
            ))}
            {search.trim() && (newUserResults.length > 0 || searchingUsers) && (
              <div className="mt-2">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <UserIcon className="size-3" />
                  {t("chat.startNewConversation")}
                </div>
                {searchingUsers && (
                  <div className="grid place-items-center py-3">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {newUserResults.map((u) => (
                  <button
                    key={u.id}
                    disabled={startingChat}
                    onClick={() => openDirectWith(u.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-hover/60 disabled:opacity-50 text-left"
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-secondary text-sm">
                        {u.display_name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{u.display_name}</div>
                      <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                    </div>
                    <MessageSquarePlus className="size-4 text-primary shrink-0" />
                  </button>
              </div>
            )}
            {search.trim() && groupResults.length > 0 && (
              <div className="mt-2">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <UsersRound className="size-3" /> Comunidades
                </div>
                {groupResults.map((g) => (
                  <Link
                    key={g.id}
                    to="/g/$groupId"
                    params={{ groupId: g.id }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-hover/60 text-left"
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={g.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-secondary text-sm">{g.name?.slice(0,2).toUpperCase() ?? "GR"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{g.member_count} membros</div>
                    </div>
                  </Link>
                ))}
              </div>
                )}
          </>
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
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
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
  const { t } = useTranslation();
  const name = conv.is_group ? conv.name ?? t("chat.group") : conv.other_user?.display_name ?? t("chat.user");
  const avatar = conv.is_group ? conv.avatar_url : conv.other_user?.avatar_url;
  const online =
    !conv.is_group &&
    conv.other_user &&
    Date.now() - new Date(conv.other_user.last_seen).getTime() < 2 * 60_000;

  const rawContent = conv.last_message?.content ?? "";
  const callMatch = rawContent.match(/^\[\[CALL:(audio|video):(missed|cancelled|declined|completed):\d+\]\]$/);
  let previewBody = rawContent;
  if (callMatch) {
    const [, kind, outcome] = callMatch;
    const kindLabel = kind === "video" ? t("chat.videoCall") : t("chat.voiceCall");
    if (outcome === "missed") previewBody = `📞 ${t("chat.callMissed", { kindLabel })}`;
    else if (outcome === "declined") previewBody = `📞 ${t("chat.callDeclinedLabel")}`;
    else if (outcome === "cancelled") previewBody = `📞 ${t("chat.callCancelledLabel")}`;
    else previewBody = `📞 ${kindLabel}`;
  }
  const preview = conv.last_message?.content
    ? (conv.last_message.sender_id === currentUserId ? t("chat.youPrefix") : "") + previewBody
    : t("chat.noMessagesYet");

  return (
    <Link
      to="/chat/$conversationId"
      params={{ conversationId: conv.id }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        active ? "bg-sidebar-hover" : "hover:bg-sidebar-hover/60"
      }`}
    >
      <div className="relative">
        <LiveAvatarRing hostId={conv.is_group ? null : conv.other_user?.id} showPill={false}>
          <Avatar className="size-11">
            <AvatarImage src={avatar ?? undefined} />
            <AvatarFallback className="bg-secondary text-sm">
              {name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </LiveAvatarRing>
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
