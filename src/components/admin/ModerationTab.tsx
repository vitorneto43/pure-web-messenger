import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listReports,
  applyModerationAction,
  getUserModerationHistory,
} from "@/lib/moderation.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldAlert, Eye, AlertTriangle, Ban, CheckCircle2, XCircle, History } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReportStatus = "pending" | "in_review" | "resolved" | "rejected" | "all";

export function ModerationTab() {
  const [tab, setTab] = useState<ReportStatus>("pending");
  const listFn = useServerFn(listReports);
  const query = useQuery({
    queryKey: ["mod-reports", tab],
    queryFn: () => listFn({ data: { status: tab } }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="size-6 text-destructive" /> Moderação
        </h2>
        <p className="text-sm text-muted-foreground">
          Analise denúncias e aplique ações para manter a comunidade segura.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportStatus)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="in_review">Em análise</TabsTrigger>
          <TabsTrigger value="resolved">Resolvidas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {query.isLoading && <Loader2 className="size-5 animate-spin" />}
          {query.data?.reports?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma denúncia.</p>
          )}
          {(query.data?.reports ?? []).map((r: any) => (
            <ReportCard key={r.id} report={r} onChanged={() => query.refetch()} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ report, onChanged }: { report: any; onChanged: () => void }) {
  const [actionOpen, setActionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const statusBadge: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-500",
    in_review: "bg-blue-500/15 text-blue-500",
    resolved: "bg-emerald-500/15 text-emerald-500",
    rejected: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {report.target_type} · {report.reason}
              <Badge className={statusBadge[report.status] ?? ""}>{report.status}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR })}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {report.reported_user_id && (
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                <History className="size-4" />
              </Button>
            )}
            {report.status === "pending" && (
              <Button size="sm" onClick={() => setActionOpen(true)}>
                Analisar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-1.5">
        {report.details && <p className="text-muted-foreground italic">"{report.details}"</p>}
        {report.target_content && (
          <div className="rounded-md border bg-muted/40 p-2 space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Conteúdo denunciado
              {report.target_content.deleted_for_everyone_at && " (removido)"}
            </div>
            {(report.target_content.content || report.target_content.caption) && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {report.target_content.content ?? report.target_content.caption}
              </p>
            )}
            {report.target_content.attachment_url && (
              <a
                href={report.target_content.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline break-all"
              >
                {report.target_content.attachment_name ?? report.target_content.attachment_url}
              </a>
            )}
            {report.target_content.media_url && (
              <a
                href={report.target_content.media_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline break-all"
              >
                {report.target_content.media_url}
              </a>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="text-muted-foreground">Denunciado:</span>{" "}
            {report.reported_user?.display_name ?? report.reported_user?.username ?? "—"}
            {report.reported_user?.strike_count != null && ` (${report.reported_user.strike_count} avisos)`}
          </span>
          <span>
            <span className="text-muted-foreground">Por:</span>{" "}
            {report.reporter?.display_name ?? report.reporter?.username ?? "—"}
          </span>
          <span>
            <span className="text-muted-foreground">ID:</span> {String(report.target_id).slice(0, 12)}…
          </span>
        </div>
        {report.reported_user?.banned_at && (
          <Badge variant="destructive" className="mt-1">Já banido</Badge>
        )}
        {report.reported_user?.suspended_until && new Date(report.reported_user.suspended_until) > new Date() && (
          <Badge className="bg-amber-500/15 text-amber-500 mt-1">Suspenso</Badge>
        )}
      </CardContent>

      {actionOpen && <ActionDialog report={report} onClose={() => { setActionOpen(false); onChanged(); }} />}
      {historyOpen && (
        <HistoryDialog userId={report.reported_user_id} onClose={() => setHistoryOpen(false)} />
      )}
    </Card>
  );
}

function ActionDialog({ report, onClose }: { report: any; onClose: () => void }) {
  const [action, setAction] = useState("warning");
  const [severity, setSeverity] = useState<"light" | "grave" | "gravissima">("light");
  const [days, setDays] = useState<number>(3);
  const [reason, setReason] = useState("");
  const applyFn = useServerFn(applyModerationAction);
  const mutation = useMutation({
    mutationFn: () =>
      applyFn({
        data: {
          report_id: report.id,
          action: action as any,
          severity,
          duration_days: action === "suspended" ? days : undefined,
          reason: reason || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Ação aplicada");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Ação</label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warning">⚠️ Aviso</SelectItem>
                <SelectItem value="content_removed">🗑️ Remover conteúdo</SelectItem>
                <SelectItem value="suspended">⏸️ Suspender</SelectItem>
                <SelectItem value="banned">🚫 Banir permanentemente</SelectItem>
                <SelectItem value="unsuspended">↩️ Remover suspensão</SelectItem>
                <SelectItem value="unbanned">↩️ Remover banimento</SelectItem>
                <SelectItem value="report_rejected">❌ Rejeitar denúncia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(action === "warning" || action === "suspended" || action === "banned" || action === "content_removed") && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Severidade</label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Leve</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                  <SelectItem value="gravissima">Gravíssima</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {action === "suspended" && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Dias</label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Motivo (mostrado ao usuário)</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const fn = useServerFn(getUserModerationHistory);
  const q = useQuery({ queryKey: ["mod-history", userId], queryFn: () => fn({ data: { user_id: userId } }) });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico do usuário</DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Ações de moderação</p>
              {q.data?.actions?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
              {(q.data?.actions ?? []).map((a: any) => (
                <div key={a.id} className="text-sm border-l-2 border-border pl-3 py-1.5">
                  <p className="font-medium">{a.action_type} <Badge variant="outline">{a.severity}</Badge></p>
                  {a.reason && <p className="text-muted-foreground text-xs">{a.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Denúncias recebidas</p>
              {q.data?.reports?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
              {(q.data?.reports ?? []).map((r: any) => (
                <div key={r.id} className="text-sm border-l-2 border-border pl-3 py-1.5">
                  <p>{r.reason} <Badge variant="outline">{r.status}</Badge></p>
                  <p className="text-xs text-muted-foreground">{r.target_type}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
