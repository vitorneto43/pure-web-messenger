import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listHighRiskUsers,
  listSuspiciousDevices,
  listHighRiskIps,
  blockDeviceFingerprint,
  setIpRiskLevel,
} from "@/lib/security.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Smartphone, Globe, UserX, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const riskColor: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-500",
  medium: "bg-amber-500/15 text-amber-500",
  high: "bg-orange-500/15 text-orange-500",
  critical: "bg-destructive/15 text-destructive",
};

export function SecurityTab({ isSuperadmin }: { isSuperadmin: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" /> Segurança & Reputação
        </h2>
        <p className="text-sm text-muted-foreground">
          Trust score, dispositivos reincidentes e classificação de IPs. IPs nunca são bloqueados
          permanentemente — apenas classificados como sinal de risco.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><UserX className="size-4 mr-1.5" /> Usuários de risco</TabsTrigger>
          <TabsTrigger value="devices"><Smartphone className="size-4 mr-1.5" /> Dispositivos</TabsTrigger>
          <TabsTrigger value="ips"><Globe className="size-4 mr-1.5" /> IPs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4"><UsersList /></TabsContent>
        <TabsContent value="devices" className="mt-4"><DevicesList isSuperadmin={isSuperadmin} /></TabsContent>
        <TabsContent value="ips" className="mt-4"><IpsList isSuperadmin={isSuperadmin} /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersList() {
  const fn = useServerFn(listHighRiskUsers);
  const q = useQuery({ queryKey: ["sec-users"], queryFn: () => fn() });
  if (q.isLoading) return <Loader2 className="size-5 animate-spin" />;
  return (
    <div className="space-y-2">
      {(q.data?.users ?? []).map((u: any) => (
        <Card key={u.user_id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {u.profile?.display_name ?? u.profile?.username ?? u.user_id.slice(0, 8)}
              <Badge className={u.score < 30 ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"}>
                Score {u.score}
              </Badge>
              {u.profile?.banned_at && <Badge variant="destructive">Banido</Badge>}
              {u.profile?.suspended_until && new Date(u.profile.suspended_until) > new Date() && (
                <Badge className="bg-amber-500/15 text-amber-500">Suspenso</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {u.profile?.strike_count ?? 0} avisos · atualizado{" "}
              {formatDistanceToNow(new Date(u.updated_at), { addSuffix: true, locale: ptBR })}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
      {q.data?.users?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum usuário com score baixo.</p>
      )}
    </div>
  );
}

function DevicesList({ isSuperadmin }: { isSuperadmin: boolean }) {
  const fn = useServerFn(listSuspiciousDevices);
  const blockFn = useServerFn(blockDeviceFingerprint);
  const q = useQuery({ queryKey: ["sec-devices"], queryFn: () => fn() });
  const m = useMutation({
    mutationFn: (vars: { fingerprint_hash: string; block: boolean; reason?: string }) =>
      blockFn({ data: vars }),
    onSuccess: () => { toast.success("Atualizado"); q.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (q.isLoading) return <Loader2 className="size-5 animate-spin" />;
  return (
    <div className="space-y-2">
      {(q.data?.devices ?? []).map((d: any) => (
        <Card key={d.fingerprint_hash}>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={riskColor[d.risk_level]}>{d.risk_level}</Badge>
                {d.is_blocked && <Badge variant="destructive">Bloqueado</Badge>}
                <code className="text-xs text-muted-foreground">{d.fingerprint_hash.slice(0, 16)}…</code>
              </div>
              {isSuperadmin && (
                <Button
                  size="sm"
                  variant={d.is_blocked ? "outline" : "destructive"}
                  onClick={() =>
                    m.mutate({
                      fingerprint_hash: d.fingerprint_hash,
                      block: !d.is_blocked,
                      reason: d.is_blocked ? undefined : "Bloqueado manualmente",
                    })
                  }
                  disabled={m.isPending}
                >
                  {d.is_blocked ? <><Unlock className="size-4 mr-1" /> Desbloquear</> : <><Lock className="size-4 mr-1" /> Bloquear</>}
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {d.account_count} contas · {d.banned_account_count} banidas · visto{" "}
              {formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale: ptBR })}
              {d.blocked_reason && <> · motivo: {d.blocked_reason}</>}
            </div>
          </CardContent>
        </Card>
      ))}
      {q.data?.devices?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum dispositivo suspeito.</p>
      )}
    </div>
  );
}

function IpsList({ isSuperadmin }: { isSuperadmin: boolean }) {
  const fn = useServerFn(listHighRiskIps);
  const setFn = useServerFn(setIpRiskLevel);
  const q = useQuery({ queryKey: ["sec-ips"], queryFn: () => fn() });
  const m = useMutation({
    mutationFn: (vars: { ip_hash: string; risk_level: "low" | "medium" | "high" | "critical" }) =>
      setFn({ data: vars }),
    onSuccess: () => { toast.success("Classificação atualizada"); q.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (q.isLoading) return <Loader2 className="size-5 animate-spin" />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        IPs nunca são bloqueados em massa — apenas classificados. Use isso como sinal de risco em
        conjunto com fingerprint e trust score.
      </p>
      {(q.data?.ips ?? []).map((ip: any) => (
        <Card key={ip.ip_hash}>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={riskColor[ip.risk_level]}>{ip.risk_level}</Badge>
                <code className="text-xs text-muted-foreground">{ip.ip_hash.slice(0, 16)}…</code>
                {ip.country && <span className="text-xs">{ip.country}{ip.region ? ` / ${ip.region}` : ""}</span>}
              </div>
              {isSuperadmin && (
                <Select
                  value={ip.risk_level}
                  onValueChange={(v) => m.mutate({ ip_hash: ip.ip_hash, risk_level: v as any })}
                >
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {ip.accounts_created} contas · {ip.accounts_banned} banidas
              {ip.notes && <> · {ip.notes}</>}
            </div>
          </CardContent>
        </Card>
      ))}
      {q.data?.ips?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum IP classificado acima de baixo risco.</p>
      )}
    </div>
  );
}
