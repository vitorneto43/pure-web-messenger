import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}

export function NewGroupDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) return setResults([]);
    const { data } = await supabase.rpc("search_users", { q });
    setResults((data as any[]) ?? []);
  }

  function toggle(p: any) {
    setSelected((s) =>
      s.find((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]
    );
  }

  async function create() {
    if (!user) return;
    if (!name.trim()) return toast.error(t("chat.groupNameRequired"));
    if (selected.length < 1) return toast.error(t("chat.addAtLeastOneMember"));
    setBusy(true);
    try {
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ name: name.trim(), is_group: true, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      const members = [
        { conversation_id: conv.id, user_id: user.id, role: "admin" },
        ...selected.map((s) => ({ conversation_id: conv.id, user_id: s.id, role: "member" })),
      ];
      const { error: memErr } = await supabase.from("conversation_members").insert(members);
      if (memErr) throw memErr;
      onCreated(conv.id);
      setName("");
      setSelected([]);
      setQuery("");
      setResults([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.newGroup")}</DialogTitle>
          <DialogDescription>{t("chat.createGroupDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("chat.groupName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder={t("chat.groupNamePlaceholder")}
              className="mt-1.5"
            />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full"
                >
                  {s.display_name}
                  <button onClick={() => toggle(s)}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder={t("chat.searchPeople")}
              className="pl-9"
            />
          </div>
          <div className="max-h-52 overflow-y-auto scrollbar-thin">
            {results.map((r) => {
              const checked = selected.some((s) => s.id === r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggle(r)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 ${
                    checked ? "bg-accent/20" : ""
                  }`}
                >
                  <Avatar className="size-9">
                    <AvatarImage src={r.avatar_url ?? undefined} />
                    <AvatarFallback>{r.display_name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium">{r.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{r.username}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    className="accent-primary"
                  />
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("chat.cancel")}
          </Button>
          <Button onClick={create} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin mr-2" />} {t("chat.createGroup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
