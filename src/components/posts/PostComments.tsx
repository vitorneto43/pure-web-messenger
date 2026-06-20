import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Send, MessageSquare, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import { formatTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
  reactions_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: string;
  onCountChange?: (n: number) => void;
}

export function PostComments({ open, onOpenChange, postId, onCountChange }: Props) {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).rpc("get_public_post_comments", { _post_id: postId });
    setItems((data ?? []) as CommentRow[]);
    setLoading(false);
  }

  useEffect(() => { if (open) void load(); }, [open, postId]);

  const grouped = useMemo(() => {
    const roots = items.filter(c => !c.parent_id);
    const byId = new Map(items.map(c => [c.id, c]));
    const collect = (rootId: string): CommentRow[] => {
      const direct = items.filter(c => c.parent_id === rootId);
      const all: CommentRow[] = [];
      for (const d of direct) { all.push(d); all.push(...collect(d.id)); }
      return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
    };
    return roots.map(r => ({
      root: r,
      replies: collect(r.id).map(rep => ({
        row: rep,
        replyToUsername: rep.parent_id && rep.parent_id !== r.id ? byId.get(rep.parent_id)?.username ?? null : null,
      })),
    }));
  }, [items]);

  async function send() {
    gate("comment", async () => {
      if (!user || !text.trim()) return;
      setSending(true);
      try {
        const { error } = await (supabase as any).from("post_comments").insert({
          post_id: postId, user_id: user.id, parent_id: replyTo?.id ?? null, content: text.trim(),
        });
        if (error) throw error;
        setText(""); setReplyTo(null);
        await load();
        onCountChange?.(items.length + 1);
      } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
    });
  }

  async function chatWith(uid: string) {
    gate("message", async () => {
      if (!user) return;
      try {
        const id = await getOrCreateDirectConversation(user.id, uid);
        onOpenChange(false);
        navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
      } catch (e: any) { toast.error(e.message); }
    });
  }

  async function react(c: CommentRow) {
    gate("react", async () => {
      if (!user) return;
      await (supabase as any).from("post_comment_reactions").upsert(
        { comment_id: c.id, user_id: user.id, emoji: "❤️" }, { onConflict: "comment_id,user_id" }
      );
      void load();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        {GateDialog}
        <SheetHeader className="p-4 border-b"><SheetTitle>Comentários</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading && <Loader2 className="size-6 animate-spin mx-auto mt-6 opacity-60" />}
          {!loading && grouped.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-10">Seja o primeiro a comentar</p>
          )}
          {grouped.map(({ root, replies }) => (
            <CommentBlock key={root.id} c={root} onReply={() => setReplyTo(root)} onChat={() => chatWith(root.user_id)} onReact={() => react(root)}>
              {replies.length > 0 && (
                <div className="ml-10 mt-2 space-y-3 border-l border-border pl-3">
                  {replies.map(({ row, replyToUsername }) => (
                    <CommentBlock key={row.id} c={row} compact replyToUsername={replyToUsername}
                      onReply={() => setReplyTo(row)} onChat={() => chatWith(row.user_id)} onReact={() => react(row)} />
                  ))}
                </div>
              )}
            </CommentBlock>
          ))}
        </div>
        <div className="border-t p-3">
          {replyTo && (
            <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
              <span>Respondendo a @{replyTo.username}</span>
              <button onClick={() => setReplyTo(null)} className="underline">cancelar</button>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={user ? "Escreva..." : "Entre para comentar"} maxLength={500}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            <Button onClick={send} disabled={sending || !text.trim()} size="icon">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CommentBlock({ c, onReply, onChat, onReact, compact, replyToUsername, children }: {
  c: CommentRow; onReply?: () => void; onChat: () => void; onReact: () => void; compact?: boolean; replyToUsername?: string | null; children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex gap-2">
        <Avatar className={cn(compact ? "size-7" : "size-9")}>
          <AvatarImage src={c.avatar_url ?? undefined} />
          <AvatarFallback>{c.display_name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-2xl px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-xs">{c.display_name}</span>
              <span className="text-[10px] text-muted-foreground">@{c.username}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">
              {replyToUsername && <span className="text-primary font-medium mr-1">@{replyToUsername}</span>}
              {c.content}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span>{formatTime(c.created_at)}</span>
            <button onClick={onReact} className="flex items-center gap-1 hover:text-rose-500"><Heart className="size-3" />{c.reactions_count || ""}</button>
            {onReply && <button onClick={onReply} className="hover:text-foreground">Responder</button>}
            <button onClick={onChat} className="flex items-center gap-1 hover:text-foreground"><MessageSquare className="size-3" />Chat</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
