import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PeopleYouMayKnow } from "@/components/PeopleYouMayKnow";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversationId: string) => void;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(Math.max(3, local.length - visible.length));
  return `${visible}${hidden}@${domain}`;
}

export function NewChatDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase.rpc("search_users", { q });
    setResults((data as any[]) ?? []);
    setSearching(false);
  }

  async function startChat(otherUserId: string) {
    if (!user) return;
    if (otherUserId === user.id) {
      toast.error("Você não pode iniciar uma conversa consigo mesmo.");
      return;
    }
    setCreating(true);
    try {
      // Find existing 1:1
      const { data: myConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations!inner(is_group)")
        .eq("user_id", user.id);
      const candidateIds = (myConvs ?? [])
        .filter((m: any) => !m.conversations.is_group)
        .map((m) => m.conversation_id);
      if (candidateIds.length) {
        const { data: matches } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", otherUserId)
          .in("conversation_id", candidateIds);
        if (matches && matches.length) {
          onCreated(matches[0].conversation_id);
          return;
        }
      }
      // Create new
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .insert({ is_group: false, created_by: user.id })
        .select()
        .single();
      if (convErr) throw convErr;
      const { error: memErr } = await supabase.from("conversation_members").insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: otherUserId },
      ]);
      if (memErr) throw memErr;
      onCreated(conv.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>Busque por nome ou usuário.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="ex: joao_silva"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin -mx-1 px-1">
          {searching && <Loader2 className="size-4 animate-spin mx-auto my-4" />}
          {!searching && query && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              Nenhum usuário encontrado
            </p>
          )}
          {!query && (
            <div className="py-2">
              <PeopleYouMayKnow onPick={(id) => startChat(id)} />
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              disabled={creating}
              onClick={() => startChat(r.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 disabled:opacity-50"
            >
              <Avatar className="size-9">
                <AvatarImage src={r.avatar_url ?? undefined} />
                <AvatarFallback>{r.display_name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.display_name}</div>
                <div className="text-xs text-muted-foreground truncate">@{r.username}</div>
                {r.email && (
                  <div className="text-[11px] font-mono text-muted-foreground/80 truncate">
                    {maskEmail(r.email)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
