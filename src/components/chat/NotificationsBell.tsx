import { useEffect, useState } from "react";
import { Bell, Loader2, Mail } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatFullTime } from "@/lib/format-time";
import { useTranslation } from "react-i18next";

interface ProfileMini {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(Math.max(3, local.length - visible.length));
  return `${visible}${hidden}@${domain}`;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [viewerPost, setViewerPost] = useState<NotificationRow | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as NotificationRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  // Realtime: any change to my notifications refreshes the list
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-bell-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Fetch profiles for any new_user_id referenced in notifications
  useEffect(() => {
    const ids = new Set<string>();
    for (const n of items) {
      const d = (n.data ?? {}) as Record<string, unknown>;
      const nid = typeof d.new_user_id === "string" ? d.new_user_id : null;
      if (nid && !profiles[nid]) ids.add(nid);
    }
    if (ids.size === 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", Array.from(ids));
      if (!data) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data as ProfileMini[]) next[p.id] = p;
        return next;
      });
    })();
  }, [items, profiles]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    if (!user) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    // optimistic
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .in("id", ids);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread > 0) markAllRead();
  }

  async function handleClick(n: NotificationRow) {
    setOpen(false);
    const data = (n.data ?? {}) as Record<string, unknown>;
    if (n.type === "newsletter") {
      setViewerPost(n);
      return;
    }
    const convId = typeof data.conversation_id === "string" ? data.conversation_id : null;
    if (convId) {
      navigate({ to: "/chat/$conversationId", params: { conversationId: convId } });
      return;
    }
    const newUserId = typeof data.new_user_id === "string" ? data.new_user_id : null;
    if (n.type === "invite_accepted" && newUserId && user) {
      const id = await findOrCreateDirectConversation(user.id, newUserId);
      if (id) navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
    }
  }

  const viewerData = (viewerPost?.data ?? {}) as Record<string, unknown>;
  const viewerMediaUrl = typeof viewerData.media_url === "string" ? viewerData.media_url : null;
  const viewerMediaType = typeof viewerData.media_type === "string" ? viewerData.media_type : null;
  const viewerContent = typeof viewerData.content === "string" ? viewerData.content : viewerPost?.body ?? "";
  const viewerCtaLabel = typeof viewerData.cta_label === "string" ? viewerData.cta_label : null;
  const viewerCtaUrl = typeof viewerData.cta_url === "string" ? viewerData.cta_url : null;

  return (
    <>
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="rounded-full relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">{t("chat.notifications")}</span>
          {items.some((n) => !n.read_at) && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              {t("chat.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("chat.noNotifications")}
            </p>
          ) : (
            items.map((n) => {
              const d = (n.data ?? {}) as Record<string, unknown>;
              const nid = typeof d.new_user_id === "string" ? d.new_user_id : null;
              const profile = nid ? profiles[nid] : null;
              const emailRaw = typeof d.email === "string" ? d.email : null;
              const displayName =
                profile?.display_name ??
                (typeof d.display_name === "string" ? d.display_name : null);
              const masked = emailRaw ? maskEmail(emailRaw) : null;
              // Strip "(email)" pattern from body since we render it separately
              const cleanBody = n.body
                ? n.body.replace(/\s*\([^)]*@[^)]*\)\s*/, " ")
                : null;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/60 last:border-b-0 hover:bg-sidebar-hover transition-colors ${
                    !n.read_at ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.read_at && (
                      <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />
                    )}
                    {profile || displayName ? (
                      <Avatar className="size-9 shrink-0">
                        {profile?.avatar_url && (
                          <AvatarImage src={profile.avatar_url} alt={displayName ?? ""} />
                        )}
                        <AvatarFallback className="text-[11px]">
                          {initials(displayName ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {displayName ?? n.title}
                      </div>
                      {displayName && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {n.title}
                        </div>
                      )}
                      {cleanBody && cleanBody.trim() && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {cleanBody.trim()}
                        </div>
                      )}
                      {masked && (
                        <div className="text-[11px] font-mono text-foreground/70 mt-0.5 truncate">
                          {masked}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatFullTime(n.created_at)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
    <Dialog open={!!viewerPost} onOpenChange={(o) => !o && setViewerPost(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            {viewerPost?.title}
          </DialogTitle>
          {viewerPost?.body && (
            <DialogDescription>{viewerPost.body}</DialogDescription>
          )}
        </DialogHeader>
        {viewerMediaUrl && (
          <div className="rounded-md overflow-hidden bg-muted">
            {viewerMediaType === "video" ? (
              <video src={viewerMediaUrl} controls className="w-full max-h-80" />
            ) : (
              <img src={viewerMediaUrl} alt="" className="w-full max-h-80 object-contain" />
            )}
          </div>
        )}
        <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm text-foreground/90">
          {viewerContent}
        </div>
        <DialogFooter>
          {viewerCtaUrl && viewerCtaLabel && (
            <Button asChild>
              <a href={viewerCtaUrl} target="_blank" rel="noreferrer">
                {viewerCtaLabel}
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => setViewerPost(null)}>
            {t("chat.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

async function findOrCreateDirectConversation(meId: string, otherId: string) {
  // Find existing 1:1
  const { data: myMemberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", meId);
  const ids = (myMemberships ?? []).map((m) => m.conversation_id);
  if (ids.length) {
    const { data: shared } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherId)
      .in("conversation_id", ids);
    for (const row of shared ?? []) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, is_group")
        .eq("id", row.conversation_id)
        .single();
      if (conv && !conv.is_group) return conv.id;
    }
  }
  // Create new 1:1
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ created_by: meId, is_group: false })
    .select("id")
    .single();
  if (error || !created) return null;
  await supabase.from("conversation_members").insert([
    { conversation_id: created.id, user_id: meId, role: "owner" },
    { conversation_id: created.id, user_id: otherId, role: "member" },
  ]);
  return created.id;
}
