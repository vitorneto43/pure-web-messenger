import { useEffect, useState } from "react";
import { Plus, Loader2, Globe2, Hash } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LiveAvatarRing } from "@/components/live/LiveAvatarRing";
import { Button } from "@/components/ui/button";
import { CreateStatusDialog } from "./CreateStatusDialog";
import { StatusViewer } from "./StatusViewer";
import { useTranslation } from "react-i18next";
import { getActiveLives } from "@/lib/live.functions";
import { useLiveHosts } from "@/hooks/use-live-hosts";

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
  cta_url?: string | null;
  cta_label?: string | null;
}

export interface UserGroup {
  user: { id: string; display_name: string; avatar_url: string | null };
  statuses: StatusRow[];
  hasUnseen: boolean;
  isOfficial: boolean;
  isSponsored: boolean;
  firstUnseenIndex: number;
  sponsoredStatusIds?: string[];
}

export function StatusBar() {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const { t } = useTranslation();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [mine, setMine] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<{
    groups: UserGroup[];
    groupIndex: number;
    statusIndex: number;
  } | null>(null);

  const fetchActiveLives = useServerFn(getActiveLives);
  const liveHostsMap = useLiveHosts();
  const { data: activeLives = [] } = useQuery({
    queryKey: ["status-bar-active-lives", Array.from(liveHostsMap.keys()).sort().join(",")],
    queryFn: () => fetchActiveLives(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  async function load() {
    setLoading(true);

    // Load my own statuses (only if signed in)
    let myRows: StatusRow[] = [];
    if (user) {
      const { data: mineData } = await supabase
        .from("statuses")
        .select("*")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      myRows = (mineData ?? []) as StatusRow[];
    }
    setMine(myRows);

    // Load everyone else's public statuses via the open discovery RPC.
    // This ensures stories from users with no relationship also appear.
    const { data } = await (supabase as any).rpc("discover_public_statuses", {
      _limit: 60,
      _offset: 0,
    });

    // Mark seen for signed-in viewers
    let seenSet = new Set<string>();
    if (user) {
      const otherStatusIds = (data ?? []).map((r: any) => r.status_id);
      if (otherStatusIds.length) {
        const { data: views } = await supabase
          .from("status_views")
          .select("status_id")
          .eq("viewer_id", user.id)
          .in("status_id", otherStatusIds);
        seenSet = new Set((views ?? []).map((v) => v.status_id));
      }
    }

    const byUser = new Map<string, UserGroup>();
    for (const r of data ?? []) {
      const status: StatusRow = {
        id: r.status_id,
        user_id: r.user_id,
        kind: r.kind,
        content: r.content,
        media_url: r.media_url,
        caption: r.caption,
        background: r.background,
        is_official: r.is_official,
        created_at: r.created_at,
        expires_at: r.expires_at,
        cta_url: r.cta_url,
        cta_label: r.cta_label,
      };
      const current = byUser.get(r.user_id);
      if (current) {
        current.statuses.push(status);
        if (!seenSet.has(status.id)) current.hasUnseen = true;
        if (r.is_boosted) {
          current.isSponsored = true;
          current.sponsoredStatusIds = [...(current.sponsoredStatusIds ?? []), r.status_id];
        }
      } else {
        byUser.set(r.user_id, {
          user: { id: r.user_id, display_name: r.display_name, avatar_url: r.avatar_url },
          statuses: [status],
          hasUnseen: !seenSet.has(status.id),
          isOfficial: !!r.is_official,
          isSponsored: !!r.is_boosted,
          firstUnseenIndex: 0,
          sponsoredStatusIds: r.is_boosted ? [r.status_id] : [],
        });
      }
    }
    const grouped = Array.from(byUser.values()).map((g) => ({
      ...g,
      firstUnseenIndex: Math.max(
        g.statuses.findIndex((s) => !seenSet.has(s.id)),
        0,
      ),
    }));
    grouped.sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
      if (a.isSponsored !== b.isSponsored) return a.isSponsored ? -1 : 1;
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

  const viewerGroups: UserGroup[] = [
    ...(mine.length
      ? [
          {
            user: {
              id: user!.id,
              display_name: t("status.myStatus"),
              avatar_url: (user!.user_metadata as any)?.avatar_url ?? null,
            },
            statuses: mine,
            hasUnseen: false,
            isOfficial: mine.some((s) => s.is_official === true),
            isSponsored: false,
            firstUnseenIndex: 0,
          },
        ]
      : []),
    ...groups,
  ];

  function openViewer(userId: string, statusIndex?: number) {
    const groupIndex = viewerGroups.findIndex((g) => g.user.id === userId);
    if (groupIndex >= 0) {
      const group = viewerGroups[groupIndex];
      setViewing({
        groups: viewerGroups,
        groupIndex,
        statusIndex: statusIndex ?? group.firstUnseenIndex,
      });
    }
  }

  return (
    <div className="border-b border-border px-3 py-3 bg-sidebar">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Stories
        </span>
        {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {GateDialog}
        {/* My status */}
        <div
          role="button"
          tabIndex={0}
          onClick={() =>
            gate("create_status", () =>
              mine.length && user ? openViewer(user.id) : setCreateOpen(true),
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              gate("create_status", () =>
                mine.length && user ? openViewer(user.id) : setCreateOpen(true),
              );
            }
          }}
          className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
        >
          <div className="relative">
            <Avatar
              className={`size-14 ring-2 ring-offset-2 ring-offset-sidebar ${mine.length ? "ring-primary" : "ring-border"}`}
            >
              <AvatarImage src={(user?.user_metadata as any)?.avatar_url} />
              <AvatarFallback className="bg-secondary text-sm">
                {(user?.email?.[0] ?? "V").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={(e) => {
                e.stopPropagation();
                gate("create_status", () => setCreateOpen(true));
              }}
              className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-primary text-primary-foreground grid place-items-center ring-2 ring-sidebar hover:scale-110 transition"
              aria-label={t("status.createStatus")}
            >
              <Plus className="size-3" />
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground max-w-[64px] truncate">
            {mine.length ? t("status.myStatus") : t("status.add")}
          </span>
        </div>

        {/* Discover public statuses */}
        <Link to="/descobrir-status" className="flex flex-col items-center gap-1 shrink-0">
          <div className="size-14 rounded-full grid place-items-center bg-gradient-to-br from-primary via-fuchsia-500 to-pink-500 ring-2 ring-offset-2 ring-offset-sidebar ring-primary/40 shadow-lg">
            <Globe2 className="size-6 text-white" />
          </div>
          <span className="text-[10px] text-muted-foreground max-w-[64px] truncate">Descobrir</span>
        </Link>

        {/* Trending hashtags */}
        <Link to="/hashtags" className="flex flex-col items-center gap-1 shrink-0">
          <div className="size-14 rounded-full grid place-items-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 ring-2 ring-offset-2 ring-offset-sidebar ring-orange-400/40 shadow-lg">
            <Hash className="size-6 text-white" />
          </div>
          <span className="text-[10px] text-muted-foreground max-w-[64px] truncate">Em alta</span>
        </Link>

        {/* Live hosts (no story yet) */}
        {activeLives
          .filter((l) => !groups.some((g) => g.user.id === l.host_id))
          .map((l) => {
            const name = l.host?.display_name || l.host?.username || "Ao vivo";
            return (
              <Link
                key={`live-${l.id}`}
                to="/live/$liveId"
                params={{ liveId: l.id }}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <LiveAvatarRing hostId={l.host_id} showPill clickable={false}>
                  <Avatar className="size-14">
                    <AvatarImage src={l.host?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-sm">
                      {name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </LiveAvatarRing>
                <span className="text-[10px] max-w-[64px] truncate text-red-500 font-semibold">
                  {name}
                </span>
              </Link>
            );
          })}

        {/* Others */}
        {groups.map((g) => (
          <button
            key={g.user.id}
            onClick={() => openViewer(g.user.id)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className="relative">
              <LiveAvatarRing hostId={g.user.id} showPill={false}>
                <Avatar
                  className={`size-14 ring-2 ring-offset-2 ring-offset-sidebar ${
                    g.isOfficial
                      ? "ring-sky-500"
                      : g.isSponsored
                        ? "ring-pink-500"
                        : g.hasUnseen
                          ? "ring-primary"
                          : "ring-muted"
                  }`}
                >
                  <AvatarImage src={g.user.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-secondary text-sm">
                    {g.user.display_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </LiveAvatarRing>
              {g.isOfficial && (
                <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-sky-500 text-white grid place-items-center ring-2 ring-sidebar">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
              )}
            </div>
            <span className="text-[10px] max-w-[64px] truncate flex items-center gap-0.5 justify-center">
              {g.isSponsored && !g.isOfficial ? (
                <span className="text-pink-500 font-semibold">{t("status.sponsored")}</span>
              ) : (
                g.user.display_name
              )}
            </span>
          </button>
        ))}

        {groups.length === 0 && !loading && mine.length === 0 && (
          <p className="text-[11px] text-muted-foreground self-center ml-1">
            {t("status.noContactStatuses")}
          </p>
        )}
      </div>

      <CreateStatusDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      {viewing && (
        <StatusViewer
          groups={viewing.groups}
          startGroupIndex={viewing.groupIndex}
          startStatusIndex={viewing.statusIndex}
          onClose={() => {
            setViewing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
