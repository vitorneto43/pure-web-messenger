import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setAppBadge } from "@/lib/app-badge";

// Globally maintain the installed-app icon badge count.
// Counts unread messages (newer than my conversation_members.last_read_at) + unread notifications.
export function useAppBadgeSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function recompute() {
      if (!user) return;
      try {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("conversation_id, last_read_at")
          .eq("user_id", user.id);
        const convIds = (members ?? []).map((m) => m.conversation_id);
        const readMap = new Map(
          (members ?? []).map((m) => [m.conversation_id, m.last_read_at]),
        );

        let unreadMsgs = 0;
        if (convIds.length) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("conversation_id, sender_id, created_at")
            .in("conversation_id", convIds)
            .neq("sender_id", user.id)
            .order("created_at", { ascending: false })
            .limit(500);
          for (const m of msgs ?? []) {
            const last = readMap.get(m.conversation_id);
            if (!last || new Date(m.created_at) > new Date(last as string)) unreadMsgs += 1;
          }
        }

        const { count: notifUnread } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null);

        if (cancelled) return;
        setAppBadge(unreadMsgs + (notifUnread ?? 0));
      } catch {
        /* ignore */
      }
    }

    recompute();

    const ch = supabase
      .channel(`badge-sync-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => recompute())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => recompute(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` },
        () => recompute(),
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [user?.id]);
}
