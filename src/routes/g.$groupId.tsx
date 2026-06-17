import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Globe, Loader2, MoreVertical, Share2, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getGroupPublic,
  getGroupMembershipStatus,
  joinOpenGroup,
  requestJoinGroup,
  reportGroup,
  type PublicGroup,
  type GroupCategory,
} from "@/lib/groups.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  business: "Negócios", tech: "Tecnologia", games: "Games", music: "Música",
  entertainment: "Entretenimento", relationships: "Relacionamentos",
  travel: "Viagens", sports: "Esportes", education: "Educação", other: "Outros",
};

export const Route = createFileRoute("/g/$groupId")({
  loader: async ({ params }) => {
    const res = await getGroupPublic({ data: { id: params.groupId } });
    return res;
  },
  head: ({ loaderData }) => {
    const g = loaderData?.group;
    if (!g) return { meta: [{ title: "Grupo — WaveChat" }] };
    const desc = (g.description ?? `Comunidade no WaveChat com ${g.member_count} membros.`).slice(0, 160);
    return {
      meta: [
        { title: `${g.name ?? "Grupo"} — WaveChat` },
        { name: "description", content: desc },
        { property: "og:title", content: `${g.name ?? "Grupo"} — WaveChat` },
        { property: "og:description", content: desc },
        ...(g.avatar_url ? [{ property: "og:image", content: g.avatar_url }] : []),
      ],
    };
  },
  component: GroupPage,
  errorComponent: () => <NotFound />,
  notFoundComponent: () => <NotFound />,
});

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold mb-2">Grupo não encontrado</h1>
        <p className="text-sm text-muted-foreground mb-4">Ele pode ser privado ou não existir mais.</p>
        <Link to="/descobrir"><Button>Descobrir comunidades</Button></Link>
      </div>
    </div>
  );
}

function GroupPage() {
  const { group, admins } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ isMember: boolean; isAdmin: boolean; requestStatus: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!group || !user) return;
    getGroupMembershipStatus({ data: { id: group.id } }).then(setStatus).catch(() => {});
  }, [group?.id, user?.id]);

  if (!group) return <NotFound />;

  async function handleJoin() {
    if (!user) { navigate({ to: "/auth" }); return; }
    setBusy(true);
    try {
      if (group!.join_policy === "open") {
        await joinOpenGroup({ data: { id: group!.id } });
        toast.success("Você entrou no grupo!");
        navigate({ to: "/chat/$conversationId", params: { conversationId: group!.id } });
      } else {
        await requestJoinGroup({ data: { id: group!.id } });
        toast.success("Solicitação enviada");
        setStatus(s => s ? { ...s, requestStatus: "pending" } : s);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao entrar");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => history.length > 1 ? history.back() : navigate({ to: "/descobrir" })} className="p-1.5 -ml-1.5 rounded-lg hover:bg-accent/40">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-sm font-medium">Comunidade</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="p-1.5 -mr-1.5 rounded-lg hover:bg-accent/40">
              <MoreVertical className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => user ? setReportOpen(true) : navigate({ to: "/auth" })}>
                <ShieldAlert className="size-4 mr-2" /> Denunciar grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex flex-col items-center text-center mb-6">
          <Avatar className="size-24 mb-3">
            <AvatarImage src={group.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{group.name?.slice(0, 2).toUpperCase() ?? "GR"}</AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold">{group.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
            <Globe className="size-3.5" /> <span>Público</span>
            {group.category && <><span>·</span><Badge variant="secondary">{CATEGORY_LABEL[group.category as GroupCategory]}</Badge></>}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <Users className="size-4" /> {group.member_count} {group.member_count === 1 ? "membro" : "membros"}
            <span>·</span> <span>desde {new Date(group.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
          </div>
        </div>

        {group.description && (
          <div className="max-h-48 overflow-y-auto mb-4">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap text-center">{group.description}</p>
          </div>
        )}

        {group.pinned_message && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm mb-4 max-h-48 overflow-y-auto">
            <div className="font-semibold text-primary mb-1">📌 Mensagem fixada</div>
            <p className="whitespace-pre-wrap text-foreground/90">{group.pinned_message}</p>
          </div>
        )}

        {group.rules && (
          <div className="rounded-lg border border-border p-3 text-sm mb-4 max-h-48 overflow-y-auto">
            <div className="font-semibold mb-1">📋 Regras do grupo</div>
            <p className="whitespace-pre-wrap text-muted-foreground">{group.rules}</p>
          </div>
        )}

        <div className="mb-6">
          {!user ? (
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Criar conta para entrar</Button>
          ) : status?.isMember ? (
            <Button className="w-full" onClick={() => navigate({ to: "/chat/$conversationId", params: { conversationId: group.id } })}>
              Abrir grupo
            </Button>
          ) : status?.requestStatus === "pending" ? (
            <Button className="w-full" disabled variant="secondary">Solicitação pendente</Button>
          ) : (
            <Button className="w-full" onClick={handleJoin} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              {group.join_policy === "open" ? "Entrar no grupo" : "Solicitar entrada"}
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full mb-6"
          onClick={async () => {
            const url = `${window.location.origin}/g/${group.id}`;
            try {
              if (navigator.share) await navigator.share({ title: group.name ?? "Grupo", url });
              else { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
            } catch { /* cancelled */ }
          }}
        >
          <Share2 className="size-4 mr-2" /> Compartilhar grupo
        </Button>


        {admins.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2">Administradores</h2>
            <div className="flex flex-wrap gap-2">
              {admins.map((a: { id: string; username: string; display_name: string; avatar_url: string | null }) => (
                <Link
                  key={a.id}
                  to="/u/$username"
                  params={{ username: a.username }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/30"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={a.avatar_url ?? undefined} />
                    <AvatarFallback>{a.display_name.slice(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <div className="text-sm font-medium">{a.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{a.username}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <ReportGroupDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        groupId={group.id}
      />
    </div>
  );
}

function ReportGroupDialog({ open, onOpenChange, groupId }: { open: boolean; onOpenChange: (v: boolean) => void; groupId: string }) {
  const [reason, setReason] = useState<string>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await reportGroup({ data: { id: groupId, reason: reason as any, details: details.trim() || undefined } });
      toast.success("Denúncia enviada. Obrigado!");
      onOpenChange(false);
      setDetails("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Denunciar grupo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Motivo</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="adult">Conteúdo adulto</SelectItem>
                <SelectItem value="violence">Violência</SelectItem>
                <SelectItem value="scam">Golpe / Fraude</SelectItem>
                <SelectItem value="copyright">Direitos autorais</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Detalhes (opcional)</label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin mr-2" />} Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
