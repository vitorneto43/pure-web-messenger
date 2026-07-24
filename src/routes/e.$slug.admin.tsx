import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Copy, RefreshCcw, ShieldCheck, UserMinus, Ban, CheckCircle2, Save, Plus, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  getEcosystemBySlug,
  getMyRole,
  listEcosystemMembers,
  updateMemberRole,
  setMemberStatus,
  removeMember,
  updateEcosystem,
  rotateJoinCode,
  listEcosystemInvites,
  createEcosystemInvite,
  revokeEcosystemInvite,
  type Ecosystem,
  type EcosystemMember,
  type EcosystemRole,
  type EcosystemInvite,
} from "@/lib/ecosystems";

export const Route = createFileRoute("/e/$slug/admin")({
  component: EcosystemAdmin,
  head: () => ({
    meta: [
      { title: "Administração — Ecossistema Wavechat" },
      { name: "description", content: "Painel de administração do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EcosystemAdmin() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eco, setEco] = useState<Ecosystem | null | undefined>(undefined);
  const [role, setRole] = useState<EcosystemRole | null>(null);
  const [members, setMembers] = useState<EcosystemMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [invites, setInvites] = useState<EcosystemInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [invRole, setInvRole] = useState<EcosystemRole>("member");
  const [invMaxUses, setInvMaxUses] = useState<string>("");
  const [invExpiresDays, setInvExpiresDays] = useState<string>("");
  const [invEmail, setInvEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [saving, setSaving] = useState(false);

  async function refreshMembers(id: string) {
    setLoadingMembers(true);
    try {
      const list = await listEcosystemMembers(id);
      setMembers(list);
    } catch (e: any) {
      toast.error("Falha ao carregar membros", { description: e?.message });
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        setEco(e);
        if (!e || !user) return;
        const r = await getMyRole(e.id);
        setRole(r);
        if (r !== "owner" && r !== "admin") return;
        setName(e.name);
        setDescription(e.description ?? "");
        setWebsite(e.website ?? "");
        setContactEmail(e.contact_email ?? "");
        setPrimaryColor(e.primary_color ?? "");
        await refreshMembers(e.id);
      } catch {
        setEco(null);
      }
    })();
  }, [slug, user?.id]);

  if (eco === undefined) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!eco) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div>
          <p className="text-sm text-muted-foreground mb-3">Ecossistema não encontrado.</p>
          <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }
  if (role !== "owner" && role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div>
          <p className="text-sm text-muted-foreground mb-3">Apenas administradores podem acessar este painel.</p>
          <Button asChild variant="outline">
            <Link to="/e/$slug" params={{ slug }}>Voltar ao ecossistema</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = role === "owner";
  const inviteUrl = eco.join_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${eco.join_code}`
    : null;

  async function saveSettings() {
    if (!eco) return;
    setSaving(true);
    try {
      const patch: any = {
        name: name.trim() || eco.name,
        description: description.trim() || null,
        website: website.trim() || null,
        contact_email: contactEmail.trim() || null,
        primary_color: primaryColor.trim() || null,
      };
      const updated = await updateEcosystem(eco.id, patch);
      setEco(updated);
      toast.success("Configurações salvas.");
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  async function rotateCode() {
    if (!eco) return;
    try {
      const code = await rotateJoinCode(eco.id);
      setEco({ ...eco, join_code: code });
      toast.success("Novo código de convite gerado.");
    } catch (e: any) {
      toast.error("Falha ao gerar código", { description: e?.message });
    }
  }

  async function handleRoleChange(m: EcosystemMember, newRole: EcosystemRole) {
    try {
      await updateMemberRole(m.ecosystem_id, m.user_id, newRole);
      await refreshMembers(m.ecosystem_id);
      toast.success("Cargo atualizado.");
    } catch (e: any) {
      toast.error("Falha ao alterar cargo", { description: e?.message });
    }
  }

  async function handleBan(m: EcosystemMember, next: "active" | "banned") {
    try {
      await setMemberStatus(m.ecosystem_id, m.user_id, next);
      await refreshMembers(m.ecosystem_id);
      toast.success(next === "banned" ? "Membro banido." : "Membro reativado.");
    } catch (e: any) {
      toast.error("Falha ao atualizar status", { description: e?.message });
    }
  }

  async function handleRemove(m: EcosystemMember) {
    if (!confirm("Remover este membro do ecossistema?")) return;
    try {
      await removeMember(m.ecosystem_id, m.user_id);
      await refreshMembers(m.ecosystem_id);
      toast.success("Membro removido.");
    } catch (e: any) {
      toast.error("Falha ao remover", { description: e?.message });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-[720px] flex items-center gap-2 px-3 py-2.5">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/e/$slug", params: { slug } })} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold leading-tight truncate">Admin — {eco.name}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {members.length} {members.length === 1 ? "membro" : "membros"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-3 py-4 space-y-6">
        {/* Settings */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold">Configurações</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Site</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
              <div>
                <Label className="text-xs">E-mail de contato</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contato@..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor primária (hex)</Label>
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#6366F1" />
            </div>
            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </section>

        {/* Invite link */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <h2 className="text-sm font-bold">Convite</h2>
          {inviteUrl ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background px-2 py-1.5 rounded-md border border-border truncate">
                {inviteUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    toast.success("Link copiado!");
                  } catch {
                    toast.error("Não foi possível copiar.");
                  }
                }}
              >
                <Copy className="size-3.5 mr-1" /> Copiar
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum código de convite ativo.</p>
          )}
          <Button size="sm" variant="ghost" onClick={rotateCode}>
            <RefreshCcw className="size-3.5 mr-1" /> Gerar novo código
          </Button>
        </section>

        {/* Members */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold mb-3">Membros</h2>
          {loadingMembers ? (
            <div className="py-8 grid place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum membro ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => {
                const name = m.profile?.display_name || m.profile?.username || "Usuário";
                const isSelf = m.user_id === user?.id;
                const isMemberOwner = m.role === "owner";
                const canEdit = !isMemberOwner && (isOwner || m.role === "member" || m.role === "moderator");
                return (
                  <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                      <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {name}{isSelf && <span className="text-muted-foreground text-xs"> (você)</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {m.profile?.username ? `@${m.profile.username} · ` : ""}
                        {m.status === "banned" ? "Banido" : "Ativo"}
                      </p>
                    </div>
                    <select
                      value={m.role}
                      disabled={!canEdit || isSelf}
                      onChange={(e) => handleRoleChange(m, e.target.value as EcosystemRole)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                    >
                      <option value="member">Membro</option>
                      <option value="moderator">Moderador</option>
                      <option value="admin">Admin</option>
                      {isMemberOwner && <option value="owner">Dono</option>}
                    </select>
                    {!isSelf && !isMemberOwner && (
                      <>
                        {m.status === "banned" ? (
                          <Button size="icon" variant="ghost" title="Reativar" onClick={() => handleBan(m, "active")}>
                            <CheckCircle2 className="size-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" title="Banir" onClick={() => handleBan(m, "banned")}>
                            <Ban className="size-4 text-amber-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Remover" onClick={() => handleRemove(m)}>
                          <UserMinus className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {isMemberOwner && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                        <ShieldCheck className="size-3.5" /> Dono
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
