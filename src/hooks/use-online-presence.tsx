import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface OnlineUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  visibility: string | null;
  online_at: string;
}

interface OnlinePresenceContextValue {
  users: OnlineUser[]; // all currently online (excludes self)
  publicUsers: OnlineUser[]; // online users whose profile is public (visible to all)
  count: number; // public visible count
  isOnline: (userId: string) => boolean;
}

const OnlinePresenceContext = createContext<OnlinePresenceContextValue>({
  users: [],
  publicUsers: [],
  count: 0,
  isOnline: () => false,
});

export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const announcedRef = useRef<Set<string>>(new Set());
  const bootRef = useRef(true);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, visibility")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const channel = supabase.channel("online-users", {
        config: { presence: { key: user.id } },
      });

      const syncList = () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const list: OnlineUser[] = [];
        for (const [key, presences] of Object.entries(state)) {
          if (key === user.id) continue;
          const p = presences?.[0];
          if (!p) continue;
          list.push({
            user_id: key,
            username: p.username ?? null,
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
            visibility: p.visibility ?? "public",
            online_at: p.online_at ?? new Date().toISOString(),
          });
        }
        list.sort((a, b) => (b.online_at || "").localeCompare(a.online_at || ""));
        setUsers(list);
      };

      channel
        .on("presence", { event: "sync" }, () => {
          if (bootRef.current) {
            const state = channel.presenceState() as Record<string, any[]>;
            for (const id of Object.keys(state)) announcedRef.current.add(id);
            bootRef.current = false;
          }
          syncList();
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          syncList();
          if (bootRef.current) return;
          if (key === user.id) return;
          if (announcedRef.current.has(key)) return;
          announcedRef.current.add(key);
          const p: any = newPresences?.[0] ?? {};
          if (p.visibility === "private") return;
          const name = p.display_name || p.username || "Alguém";
          toast(
            <div className="flex items-center gap-2 text-sm">
              <Radio className="size-4 text-primary" />
              <span>
                <strong>{name}</strong> entrou agora
              </span>
            </div>,
            {
              description: p.username ? (
                <Link to="/u/$username" params={{ username: p.username }} className="text-primary text-xs">
                  Ver perfil
                </Link>
              ) : undefined,
              duration: 3500,
            },
          );
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          announcedRef.current.delete(key);
          syncList();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              user_id: user.id,
              username: prof?.username ?? null,
              display_name: prof?.display_name ?? null,
              avatar_url: prof?.avatar_url ?? null,
              visibility: prof?.visibility ?? "public",
              online_at: new Date().toISOString(),
            });
          }
        });

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      bootRef.current = true;
      announcedRef.current.clear();
      setUsers([]);
    };
  }, [user?.id]);

  const publicUsers = users.filter((u) => u.visibility !== "private");
  const onlineIds = new Set(users.map((u) => u.user_id));
  const value: OnlinePresenceContextValue = {
    users,
    publicUsers,
    count: publicUsers.length,
    isOnline: (id: string) => onlineIds.has(id),
  };

  return <OnlinePresenceContext.Provider value={value}>{children}</OnlinePresenceContext.Provider>;
}

export function useOnlinePresence() {
  return useContext(OnlinePresenceContext);
}
