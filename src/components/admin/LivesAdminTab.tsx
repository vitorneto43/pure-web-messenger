import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Loader2, Radio, Users, Eye, Heart, Coins, MessageSquare, Video, Clock,
} from "lucide-react";
import { getAdminLives } from "@/lib/admin-lives.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function fmtDuration(s: number | null) {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export function LivesAdminTab() {
  const fn = useServerFn(getAdminLives);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-lives"],
    queryFn: () => fn(),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total de lives" value={t.total} icon={Radio} />
        <Stat label="Ao vivo agora" value={t.active} icon={Radio} />
        <Stat label="Encerradas" value={t.ended} icon={Video} />
        <Stat label="Criadores únicos" value={t.unique_hosts} icon={Users} />
        <Stat label="Pico de viewers (soma)" value={t.total_peak_viewers} icon={Eye} />
        <Stat label="Reações totais" value={t.total_reactions} icon={Heart} />
        <Stat label="Moedas em gifts" value={t.total_gift_coins} icon={Coins} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lives criadas (até 200 mais recentes)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma live criada ainda.</p>
          ) : (
            <div className="divide-y">
              {data.items.map((l) => {
                const name = l.host_display_name || l.host_username || l.host_id.slice(0, 8);
                return (
                  <div key={l.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                    <Link
                      to="/u/$username"
                      params={{ username: l.host_username ?? l.host_id }}
                      className="flex items-center gap-3 min-w-0 md:w-64"
                    >
                      <Avatar className="size-10 shrink-0">
                        {l.host_avatar_url && <AvatarImage src={l.host_avatar_url} />}
                        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {l.host_username && (
                          <p className="text-xs text-muted-foreground truncate">@{l.host_username}</p>
                        )}
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={l.status === "live" ? "default" : "secondary"}>
                          {l.status === "live" ? "AO VIVO" : "Encerrada"}
                        </Badge>
                        {l.has_recording && <Badge variant="outline">Gravada</Badge>}
                        {l.will_record && !l.has_recording && (
                          <Badge variant="outline">Pretendia gravar</Badge>
                        )}
                        <Link
                          to="/live/$liveId"
                          params={{ liveId: l.id }}
                          className="text-xs text-primary hover:underline truncate"
                        >
                          {l.title || "(sem título)"}
                        </Link>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><Clock className="size-3" />{fmtDate(l.started_at)}</span>
                        <span>Duração: {fmtDuration(l.duration_seconds)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:w-auto text-center">
                      <Metric icon={Eye} value={l.peak_viewers} label="Pico" />
                      <Metric icon={Users} value={l.unique_viewers} label="Únicos" />
                      <Metric icon={MessageSquare} value={l.chat_messages} label="Chat" />
                      <Metric icon={Heart} value={l.total_reactions} label="Reações" />
                      <Metric icon={Coins} value={l.total_gift_coins} label="Moedas" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label, value, icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-semibold mt-1">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon, value, label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-sm font-semibold">{value.toLocaleString("pt-BR")}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
