import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getComplianceState,
  setComplianceEnabled,
  createComplianceRequest,
  listComplianceRequests,
  updateComplianceRequestStatus,
  exportUserDataForRequest,
  listAuditLogs,
  listComplianceAccessLogs,
} from "@/lib/compliance.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, FileText, ShieldCheck, Lock, Download, AlertTriangle, History, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = { isSuperadmin: boolean };

export function ComplianceTab({ isSuperadmin }: Props) {
  const qc = useQueryClient();
  const stateFn = useServerFn(getComplianceState);
  const setEnabledFn = useServerFn(setComplianceEnabled);

  const stateQ = useQuery({ queryKey: ["compliance-state"], queryFn: () => stateFn() });
  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => setEnabledFn({ data: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-state"] });
      toast.success("Estado atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabled = stateQ.data?.enabled ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="size-6 text-primary" /> Compliance / Autoridades
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Cooperação com autoridades sob ordem legal. Conversas privadas permanecem privadas
            e nenhum administrador comum acessa seu conteúdo. Apenas o SuperAdmin pode executar
            procedimentos excepcionais — todos registrados de forma imutável.
          </p>
        </div>
        <Card className="min-w-[280px]">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Módulo</p>
              <p className="font-semibold flex items-center gap-2">
                {enabled ? (
                  <><ShieldCheck className="size-4 text-emerald-500" />Habilitado</>
                ) : (
                  <><Lock className="size-4 text-muted-foreground" />Desabilitado</>
                )}
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={!isSuperadmin || setEnabled.isPending}
              onCheckedChange={(v) => setEnabled.mutate(v)}
            />
          </CardContent>
        </Card>
      </div>

      {!isSuperadmin && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0" />
            <div className="text-sm">
              Você não é SuperAdmin. Pode visualizar a trilha de auditoria, mas não pode criar
              solicitações nem executar acessos excepcionais.
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests"><FileText className="size-4 mr-1.5" />Solicitações</TabsTrigger>
          <TabsTrigger value="audit"><History className="size-4 mr-1.5" />Auditoria</TabsTrigger>
          {isSuperadmin && (
            <TabsTrigger value="access"><Lock className="size-4 mr-1.5" />Acessos</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <RequestsPanel enabled={enabled} isSuperadmin={isSuperadmin} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel />
        </TabsContent>
        {isSuperadmin && (
          <TabsContent value="access" className="mt-4">
            <AccessLogsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================================
function RequestsPanel({ enabled, isSuperadmin }: { enabled: boolean; isSuperadmin: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listComplianceRequests);
  const updFn = useServerFn(updateComplianceRequestStatus);

  const q = useQuery({
    queryKey: ["compliance-requests"],
    queryFn: () => listFn(),
    enabled: isSuperadmin,
  });

  const upd = useMutation({
    mutationFn: (vars: { id: string; status: "pending" | "approved" | "fulfilled" | "denied" | "expired" }) =>
      updFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-requests"] });
      toast.success("Solicitação atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuperadmin) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Apenas o SuperAdmin pode visualizar solicitações de autoridades.</CardContent></Card>;
  }

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} solicitação(ões)</p>
        <NewRequestDialog onCreated={() => qc.invalidateQueries({ queryKey: ["compliance-requests"] })} />
      </div>

      {q.isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>}

      {items.map((r: any) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">
                  Processo {r.process_number}
                </CardTitle>
                <CardDescription>{r.requesting_authority}</CardDescription>
              </div>
              <Badge variant={r.status === "approved" || r.status === "fulfilled" ? "default" : r.status === "denied" ? "destructive" : "secondary"}>
                {r.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Motivo:</span> {r.reason}</p>
            {r.target_user_id && <p><span className="text-muted-foreground">Usuário-alvo:</span> <code className="text-xs">{r.target_user_id}</code></p>}
            {r.legal_basis && <p><span className="text-muted-foreground">Base legal:</span> {r.legal_basis}</p>}
            <p className="text-xs text-muted-foreground">Criado em {new Date(r.created_at).toLocaleString("pt-BR")}</p>

            <div className="flex gap-2 flex-wrap pt-2">
              {r.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => upd.mutate({ id: r.id, status: "approved" })}>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: r.id, status: "denied" })}>Negar</Button>
                </>
              )}
              {(r.status === "approved" || r.status === "fulfilled") && r.target_user_id && (
                <ExportDialog requestId={r.id} disabled={!enabled} />
              )}
            </div>
            {!enabled && (r.status === "approved") && (
              <p className="text-xs text-amber-500">Habilite o módulo de Compliance para executar exportação.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {!q.isLoading && items.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma solicitação registrada.</CardContent></Card>
      )}
    </div>
  );
}

// ============================================================================
function NewRequestDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    process_number: "",
    requesting_authority: "",
    requester_name: "",
    requester_contact: "",
    legal_basis: "",
    reason: "",
    target_user_id: "",
    target_username: "",
    notes: "",
  });
  const createFn = useServerFn(createComplianceRequest);
  const mut = useMutation({
    mutationFn: () => createFn({
      data: {
        process_number: form.process_number,
        requesting_authority: form.requesting_authority,
        requester_name: form.requester_name || undefined,
        requester_contact: form.requester_contact || undefined,
        legal_basis: form.legal_basis || undefined,
        reason: form.reason,
        target_user_id: form.target_user_id || undefined,
        target_username: form.target_username || undefined,
        notes: form.notes || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Solicitação registrada");
      setOpen(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4 mr-1.5" />Nova solicitação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar solicitação de autoridade</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Número do processo *</Label><Input value={form.process_number} onChange={(e) => setForm({ ...form, process_number: e.target.value })} /></div>
          <div><Label>Autoridade solicitante *</Label><Input placeholder="Ex: Vara Criminal, Polícia Civil" value={form.requesting_authority} onChange={(e) => setForm({ ...form, requesting_authority: e.target.value })} /></div>
          <div><Label>Nome do solicitante</Label><Input value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} /></div>
          <div><Label>Contato</Label><Input value={form.requester_contact} onChange={(e) => setForm({ ...form, requester_contact: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Base legal</Label><Input placeholder="Ex: art. X da Lei Y" value={form.legal_basis} onChange={(e) => setForm({ ...form, legal_basis: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Motivo / objeto da solicitação *</Label><Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div><Label>ID do usuário-alvo</Label><Input placeholder="uuid" value={form.target_user_id} onChange={(e) => setForm({ ...form, target_user_id: e.target.value })} /></div>
          <div><Label>Username (referência)</Label><Input value={form.target_username} onChange={(e) => setForm({ ...form, target_username: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Anotações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.process_number || !form.requesting_authority || form.reason.length < 10}>
            {mut.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
function ExportDialog({ requestId, disabled }: { requestId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [includeMessages, setIncludeMessages] = useState(false);
  const expFn = useServerFn(exportUserDataForRequest);
  const mut = useMutation({
    mutationFn: () => expFn({ data: { request_id: requestId, reason, include_messages: includeMessages } }),
    onSuccess: (res: any) => {
      const blob = new Blob([res.payload_json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-export-${requestId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados — acesso registrado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}><Download className="size-4 mr-1.5" />Exportar dados</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar dados sob ordem legal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Esta ação será registrada permanentemente em compliance_access_logs com seu ID,
            IP, processo e justificativa. Use apenas mediante obrigação legal válida.
          </p>
          <div>
            <Label>Justificativa (mín. 10 caracteres) *</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeMessages} onChange={(e) => setIncludeMessages(e.target.checked)} />
            <span>Incluir mensagens enviadas pelo usuário-alvo</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || reason.length < 10}>
            {mut.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}Confirmar exportação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
function AuditPanel() {
  const [actionFilter, setActionFilter] = useState<string>("");
  const fn = useServerFn(listAuditLogs);
  const q = useQuery({
    queryKey: ["audit-logs", actionFilter],
    queryFn: () => fn({ data: { limit: 200, action: actionFilter || undefined } }),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 max-w-xs">
          <Label>Filtrar por ação</Label>
          <Input placeholder="ex: compliance.access" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
        </div>
      </div>
      {q.isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>}
      <div className="space-y-2">
        {(q.data?.items ?? []).map((row: any) => (
          <Card key={row.id}>
            <CardContent className="p-3 text-sm">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <p className="font-mono text-xs">{row.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.actor_role || "—"} · {new Date(row.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                {row.target_type && <Badge variant="outline" className="text-xs">{row.target_type}</Badge>}
              </div>
              {row.metadata && Object.keys(row.metadata).length > 0 && (
                <pre className="mt-2 text-xs bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(row.metadata, null, 2)}</pre>
              )}
            </CardContent>
          </Card>
        ))}
        {!q.isLoading && (q.data?.items?.length ?? 0) === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum evento registrado.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
function AccessLogsPanel() {
  const fn = useServerFn(listComplianceAccessLogs);
  const q = useQuery({ queryKey: ["compliance-access-logs"], queryFn: () => fn() });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Trilha imutável de todo acesso excepcional a dados privados sob ordem legal.
      </p>
      {q.isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>}
      {(q.data?.items ?? []).map((row: any) => (
        <Card key={row.id}>
          <CardContent className="p-3 text-sm space-y-1">
            <div className="flex justify-between gap-2 flex-wrap">
              <p className="font-mono text-xs">{row.data_accessed}</p>
              <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <p><span className="text-muted-foreground">Acessado por:</span> {row.accessor_email || row.accessor_id}</p>
            {row.process_number && <p><span className="text-muted-foreground">Processo:</span> {row.process_number}</p>}
            <p><span className="text-muted-foreground">Motivo:</span> {row.reason}</p>
            {row.target_user_id && <p><span className="text-muted-foreground">Usuário-alvo:</span> <code className="text-xs">{row.target_user_id}</code></p>}
            {row.data_summary && Object.keys(row.data_summary).length > 0 && (
              <pre className="mt-1 text-xs bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(row.data_summary, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      ))}
      {!q.isLoading && (q.data?.items?.length ?? 0) === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum acesso excepcional registrado.</CardContent></Card>
      )}
    </div>
  );
}
