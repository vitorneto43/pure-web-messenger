import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessagePush } from "@/lib/push.functions";
import { useTranslation } from "react-i18next";

export interface ForwardableMessage {
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
}

interface ConvOption {
  id: string;
  title: string;
  avatar_url: string | null;
  is_group: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: ForwardableMessage | null;
  excludeConversationId?: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  excludeConversationId,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [convs, setConvs] = useState<ConvOption[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    setSelected(new Set());
    setQuery("");
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: memberships } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", user.id);
        const ids = (memberships ?? []).map((m) => m.conversation_id);
        if (ids.length === 0) {
          if (!cancelled) setConvs([]);
          return;
        }
        const { data: rows } = await supabase
          .from("conversations")
          .select("id, name, avatar_url, is_group")
          .in("id", ids);

        const groupMap = new Map<string, ConvOption>();
        for (const r of rows ?? []) {
          if (excludeConversationId && r.id === excludeConversationId) continue;
          groupMap.set(r.id, {
            id: r.id,
            title: r.name ?? "",
            avatar_url: r.avatar_url,
            is_group: r.is_group,
          });
        }

        // Resolve 1:1 conversation titles via the other participant's profile
        const directIds = [...groupMap.values()]
          .filter((c) => !c.is_group)
          .map((c) => c.id);
        if (directIds.length) {
          const { data: allMembers } = await supabase
            .from("conversation_members")
            .select("conversation_id, user_id")
            .in("conversation_id", directIds);
          const otherIds = [
            ...new Set(
              (allMembers ?? [])
                .filter((m) => m.user_id !== user.id)
                .map((m) => m.user_id),
            ),
          ];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
          const profMap = new Map(
            (profiles ?? []).map((p) => [p.id, p]),
          );
          for (const m of allMembers ?? []) {
            if (m.user_id === user.id) continue;
            const c = groupMap.get(m.conversation_id);
            if (!c) continue;
            const p = profMap.get(m.user_id);
            if (p) {
              c.title = p.display_name ?? c.title ?? t("chat.user");
              c.avatar_url = c.avatar_url ?? p.avatar_url;
            }
          }
        }

        if (!cancelled) setConvs([...groupMap.values()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, excludeConversationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter((c) => c.title.toLowerCase().includes(q));
  }, [convs, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (!user || !message || selected.size === 0) return;
    setSendingId("__all__");
    try {
      const rows = [...selected].map((conversation_id) => ({
        conversation_id,
        sender_id: user.id,
        content: message.content,
        attachment_url: message.attachment_url,
        attachment_type: message.attachment_type,
        attachment_name: message.attachment_name,
      }));
      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;

      // Fire-and-forget push to each target
      const pushPreview = message.content?.trim()
        ? message.content.trim().slice(0, 60)
        : message.attachment_type?.startsWith("image")
          ? t("chat.photoAttachment")
          : message.attachment_type?.startsWith("video")
            ? t("chat.videoAttachment")
            : message.attachment_type?.startsWith("audio")
              ? t("chat.audioAttachment")
              : t("chat.fileAttachment");

      for (const cid of selected) {
        void sendMessagePush({
          data: { conversationId: cid, preview: pushPreview },
        }).catch(() => {});
      }

      toast.success(
        selected.size === 1
          ? t("chat.messageForwarded")
          : t("chat.messageForwardedMultiple", { count: selected.size }),
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? t("chat.forwardError"));
    } finally {
      setSendingId(null);
    }
  }

  const preview = message?.content?.trim()
    ? message.content.trim()
    : message?.attachment_type?.startsWith("image")
      ? t("chat.photoAttachment")
      : message?.attachment_type?.startsWith("video")
        ? t("chat.videoAttachment")
        : message?.attachment_type?.startsWith("audio")
          ? t("chat.audioAttachment")
          : message?.attachment_name ?? t("chat.fileAttachment");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.forwardMessage")}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground line-clamp-2">
          {preview}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.searchConversation")}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto -mx-1">
          {loading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {t("chat.noConversationFound")}
            </div>
          ) : (
            filtered.map((c) => {
              const isSel = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition ${
                    isSel ? "bg-primary/15" : "hover:bg-accent/40"
                  }`}
                >
                  <Avatar className="size-10">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {c.title?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium truncate">
                      {c.title || t("chat.conversation")}
                    </div>
                    {c.is_group && (
                      <div className="text-[11px] text-muted-foreground">{t("chat.group")}</div>
                    )}
                  </div>
                  <div
                    className={`size-5 rounded-full border-2 ${
                      isSel
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40"
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("chat.cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={selected.size === 0 || sendingId !== null}
          >
            {sendingId ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Send className="size-4 mr-2" />
            )}
            {selected.size > 0 ? t("chat.forwardCount", { count: selected.size }) : t("chat.forward")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
