import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { LiveAvatarRing } from "@/components/live/LiveAvatarRing";

/**
 * Faixa horizontal mostrando quem está online agora.
 * Visível para todos os usuários autenticados — incentiva interação em tempo real.
 */
export function OnlineUsersStrip() {
  const { publicUsers, count } = useOnlinePresence();

  if (count === 0) {
    return (
      <div className="px-3 pt-2">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-muted-foreground/40" />
          </span>
          Ninguém online agora. Seja o primeiro a interagir!
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-2">
      <div className="rounded-lg border border-border bg-card/50 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>Online agora</span>
            <span className="text-muted-foreground">· {count}</span>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {publicUsers.slice(0, 30).map((u) => {
            const initial = (u.display_name || u.username || "?").charAt(0).toUpperCase();
            const content = (
              <div className="flex flex-col items-center gap-1 w-14 shrink-0">
                <div className="relative">
                  <Avatar className="size-12 ring-2 ring-emerald-500/60">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-background" />
                </div>
                <span className="text-[10px] leading-tight text-center truncate w-full">
                  {u.display_name || u.username || "Usuário"}
                </span>
              </div>
            );
            return u.username ? (
              <Link
                key={u.user_id}
                to="/u/$username"
                params={{ username: u.username }}
                className="hover:opacity-80 transition-opacity"
              >
                {content}
              </Link>
            ) : (
              <div key={u.user_id}>{content}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
