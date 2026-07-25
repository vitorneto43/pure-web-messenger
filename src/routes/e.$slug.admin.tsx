import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Copy, RefreshCcw, ShieldCheck, UserMinus, Ban, CheckCircle2, Save, Plus, Trash2, Ticket, BarChart3, Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { optimizeAvatarUrl } from "@/lib/avatar-optimize";
import { Switch } from "@/components/ui/switch";
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
  const [allowCrosspost, setAllowCrosspost] = useState(true);
  const [crosspostAdminOnly, setCrosspostAdminOnly] = useState(false);
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

  async function refreshInvites(id: string) {
    setLoadingInvites(true);
    try {
      const list = await listEcosystemInvites(id);
      setInvites(list);
    } catch (e: any) {
      toast.error("Falha ao carregar convites", { description: e?.message });
    } finally {
      setLoadingInvites(false);
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
        setAllowCrosspost(e.allow_public_crosspost ?? true);
        setCrosspostAdminOnly(e.public_crosspost_requires_admin ?? false);
        await refreshMembers(e.id);
        await refreshInvites(e.id);
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
        allow_public_crosspost: allowCrosspost,
        public_crosspost_requires_admin: crosspostAdminOnly,
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

  async function handleCreateInvite() {
    if (!eco) return;
    setCreatingInvite(true);
    try {
      const maxUses = invMaxUses.trim() ? Math.max(1, parseInt(invMaxUses, 10) || 0) : null;
      const days = invExpiresDays.trim() ? Math.max(1, parseInt(invExpiresDays, 10) || 0) : null;
      const expires_at = days ? new Date(Date.now() + days * 86400_000).toISOString() : null;
      await createEcosystemInvite({
        ecosystem_id: eco.id,
        role_on_join: invRole,
        max_uses: maxUses,
        expires_at,
        email: invEmail.trim() || null,
      });
      setInvMaxUses(""); setInvExpiresDays(""); setInvEmail(""); setInvRole("member");
      await refreshInvites(eco.id);
      toast.success("Convite criado.");
    } catch (e: any) {
      toast.error("Falha ao criar convite", { description: e?.message });
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    if (!confirm("Revogar este convite? O link deixará de funcionar.")) return;
    try {
      await revokeEcosystemInvite(id);
      if (eco) await refreshInvites(eco.id);
      toast.success("Convite revogado.");
    } catch (e: any) {
      toast.error("Falha ao revogar", { description: e?.message });
    }
  }

  function inviteLink(code: string) {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/join/${code}`;
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
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/e/$slug/metrics" params={{ slug }}>
                <BarChart3 className="size-4" /> Métricas
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/e/$slug/billing" params={{ slug }}>
                <Crown className="size-4" /> Plano
              </Link>
            </Button>
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

        {/* Cross-post policy — decide if members can also publish to public Wavechat */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold">Estratégia de publicação</h2>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              Decida como o conteúdo dos membros aparece: só neste ecossistema, também no feed público da Wavechat, ou ambos.
            </p>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Permitir publicação no feed público</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                Quando ativado, os membros podem escolher "Ambos" ou "Público" ao publicar posts, stories, vídeos e lives. Desligue para manter tudo restrito ao ecossistema.
              </p>
            </div>
            <Switch checked={allowCrosspost} onCheckedChange={setAllowCrosspost} />
          </div>

          <div className={`flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 ${!allowCrosspost ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Restringir a admins e moderadores</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                Só admins e moderadores podem cross-postar publicamente. Útil para instituições que querem controlar a comunicação externa.
              </p>
            </div>
            <Switch
              checked={crosspostAdminOnly}
              onCheckedChange={setCrosspostAdminOnly}
              disabled={!allowCrosspost}
            />
          </div>

          <Button onClick={saveSettings} disabled={saving} variant="outline" className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Salvar estratégia
          </Button>
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

        {/* Named invites */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-primary" />
            <h2 className="text-sm font-bold">Convites personalizados</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Crie links de convite com cargo, prazo de expiração e limite de usos.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cargo ao entrar</Label>
              <select
                value={invRole}
                onChange={(e) => setInvRole(e.target.value as EcosystemRole)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="member">Membro</option>
                <option value="moderator">Moderador</option>
                {isOwner && <option value="admin">Admin</option>}
              </select>
            </div>
            <div>
              <Label className="text-xs">Limite de usos</Label>
              <Input
                type="number"
                min={1}
                value={invMaxUses}
                onChange={(e) => setInvMaxUses(e.target.value)}
                placeholder="Ilimitado"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Expira em (dias)</Label>
              <Input
                type="number"
                min={1}
                value={invExpiresDays}
                onChange={(e) => setInvExpiresDays(e.target.value)}
                placeholder="Sem prazo"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">E-mail (opcional)</Label>
              <Input
                type="email"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="convidado@..."
                className="h-9"
              />
            </div>
          </div>
          <Button onClick={handleCreateInvite} disabled={creatingInvite} size="sm" className="w-full">
            {creatingInvite ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
            Criar convite
          </Button>

          <div className="pt-2">
            {loadingInvites ? (
              <div className="py-4 grid place-items-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : invites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum convite personalizado ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invites.map((inv) => {
                  const url = inviteLink(inv.code);
                  const expired = inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
                  const exhausted = inv.max_uses != null && inv.uses >= inv.max_uses;
                  const inactive = expired || exhausted;
                  return (
                    <li key={inv.id} className="py-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <code className="block text-[11px] truncate">{url}</code>
                        <p className="text-[10px] text-muted-foreground">
                          {inv.role_on_join === "admin" ? "Admin" : inv.role_on_join === "moderator" ? "Moderador" : "Membro"}
                          {" · "}
                          {inv.uses}{inv.max_uses ? `/${inv.max_uses}` : ""} usos
                          {inv.expires_at ? ` · expira ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
                          {inv.email ? ` · ${inv.email}` : ""}
                          {inactive ? " · inativo" : ""}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Copiar"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(url);
                            toast.success("Link copiado!");
                          } catch {
                            toast.error("Não foi possível copiar.");
                          }
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Revogar"
                        onClick={() => handleRevokeInvite(inv.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
                      <AvatarImage src={optimizeAvatarUrl(m.profile?.avatar_url, 72)} />
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
