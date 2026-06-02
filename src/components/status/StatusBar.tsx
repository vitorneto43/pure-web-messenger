import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreateStatusDialog } from "./CreateStatusDialog";
import { StatusViewer } from "./StatusViewer";

export interface StatusRow {
  id: string;
  user_id: string;
  kind: "text" | "image" | "video";
  content: string | null;
  media_url: string | null;
  caption: string | null;
  background: string | null;
  is_official: boolean | null;
  created_at: string;
  expires_at: string;
}

interface UserGroup {
  user: { id: string; display_name: string; avatar_url: string | null };
  statuses: StatusRow[];
  hasUnseen: boolean;
  isOfficial: boolean;
}

export function StatusBar() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [mine, setMine] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<{ statuses: StatusRow[]; index: number } | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("statuses")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as StatusRow[];

    const myRows = rows.filter((r) => r.user_id === user.id);
    setMine(myRows);

    const otherIds = Array.from(new Set(rows.filter((r) => r.user_id !== user.id).map((r) => r.user_id)));
    let profilesMap = new Map<string, any>();
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", otherIds);
      profilesMap = new Map((profs ?? []).map((p) => [p.id, p]));
    }

    // load my view records to mark unseen
    const otherStatusIds = rows.filter((r) => r.user_id !== user.id).map((r) => r.id);
    let seenSet = new Set<string>();
    if (otherStatusIds.length) {
      const { data: views } = await supabase
        .from("status_views")
        .select("status_id")
        .eq("viewer_id", user.id)
        .in("status_id", otherStatusIds);
      seenSet = new Set((views ?? []).map((v) => v.status_id));
    }

    const byUser = new Map<string, StatusRow[]>();
    for (const r of rows) {
      if (r.user_id === user.id) continue;
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(r);
    }
    const grouped: UserGroup[] = [];
    for (const [uid, list] of byUser) {
      const prof = profilesMap.get(uid);
      if (!prof) continue;
      grouped.push({
        user: prof,
        statuses: list,
        hasUnseen: list.some((s) => !seenSet.has(s.id)),
        isOfficial: list.some((s) => s.is_official === true),
      });
    }
    grouped.sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return 0;
    });
    setGroups(grouped);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // refresh expiry every minute
    return () => clearInterval(id);
  }, [user?.id]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("status-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <div className="border-b border-border px-3 py-3 bg-sidebar">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Status
        </span>
        {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {/* My status */}
        <button
          onClick={() => (mine.length ? setViewing({ statuses: mine, index: 0 }) : setCreateOpen(true))}
          className="flex flex-col items-center gap-1 shrink-0 group"
        >
          <div className="relative">
            <Avatar className={`size-14 ring-2 ring-offset-2 ring-offset-sidebar ${mine.length ? "ring-primary" : "ring-border"}`}>
              <AvatarImage src={(user.user_metadata as any)?.avatar_url} />
              <AvatarFallback className="bg-secondary text-sm">
                {(user.email?.[0] ?? "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCreateOpen(true);
              }}
              className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-primary text-primary-foreground grid place-items-center ring-2 ring-sidebar hover:scale-110 transition"
              aria-label="Criar status"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground max-w-[64px] truncate">
            {mine.length ? "Meu status" : "Adicionar"}
          </span>
        </button>

        {/* Others */}
        {groups.map((g) => (
          <button
            key={g.user.id}
            onClick={() => setViewing({ statuses: g.statuses, index: 0 })}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className="relative">
              <Avatar
                className={`size-14 ring-2 ring-offset-2 ring-offset-sidebar ${
                  g.isOfficial ? "ring-sky-500" : g.hasUnseen ? "ring-primary" : "ring-muted"
                }`}
              >
                <AvatarImage src={g.user.avatar_url ?? undefined} />
                <AvatarFallback className="bg-secondary text-sm">
                  {g.user.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {g.isOfficial && (
                <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-sky-500 text-white grid place-items-center ring-2 ring-sidebar">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
              )}
            </div>
            <span className="text-[10px] max-w-[64px] truncate flex items-center gap-0.5 justify-center">
              {g.user.display_name}
            </span>
          </button>
        ))}

        {groups.length === 0 && !loading && mine.length === 0 && (
          <p className="text-[11px] text-muted-foreground self-center ml-1">
            Sem status de contatos ainda.
          </p>
        )}
      </div>

      <CreateStatusDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      {viewing && (
        <StatusViewer
          statuses={viewing.statuses}
          startIndex={viewing.index}
          onClose={() => {
            setViewing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
