import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Anuncia globalmente, via Realtime Presence, quando outros usuários ficam online.
 * Mostra um toast "Fulano entrou agora" com link para o perfil.
 */
export function useOnlineAnnouncements() {
  const { user } = useAuth();
  const announcedRef = useRef<Set<string>>(new Set());
  const bootRef = useRef(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      // Busca perfil para tracking
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, visibility")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const channel = supabase.channel("online-users", {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          // No primeiro sync, registra todos como conhecidos para não soltar enxurrada de toasts
          if (bootRef.current) {
            const state = channel.presenceState() as Record<string, any[]>;
            for (const id of Object.keys(state)) announcedRef.current.add(id);
            bootRef.current = false;
          }
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
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
    };
  }, [user?.id]);
}
