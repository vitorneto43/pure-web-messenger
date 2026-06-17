import { useEffect, useState } from "react";
import { Crown, Loader2, LogOut, Search, Share2, ShieldOff, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listPendingJoinRequests,
  decideJoinRequest,
  updateGroupSettings,
} from "@/lib/groups.functions";
import { Globe, Lock, Settings2, Check } from "lucide-react";

interface MemberRow {
  user_id: string;
  role: string;
  profile?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface Props {
  conversationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupName: string;
  onDeleted?: () => void;
}

export function GroupSettingsDialog({ conversationId, open, onOpenChange, groupName, onDeleted }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [pendingReqs, setPendingReqs] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const meIsAdmin = members.find((m) => m.user_id === user?.id)?.role === "admin";
  const isPublic = groupInfo?.visibility === "public";

  async function load() {
    setLoading(true);
    const { data: gRow } = await supabase
      .from("conversations")
      .select("id, name, description, avatar_url, visibility, category, join_policy, rules, pinned_message, member_count")
      .eq("id", conversationId).maybeSingle();
    setGroupInfo(gRow);
    const { data: rows } = await supabase
      .from("conversation_members")
      .select("user_id, role")
      .eq("conversation_id", conversationId);
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids)
      : { data: [] as any[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    setMembers(
      (rows ?? []).map((r) => ({
        user_id: r.user_id,
        role: r.role,
        profile: profMap.get(r.user_id),
      })),
    );
    setLoading(false);
  }

  async function loadPending() {
    if (!meIsAdmin || !isPublic || groupInfo?.join_policy !== "request") return;
    try {
      const r = await listPendingJoinRequests({ data: { id: conversationId } });
      setPendingReqs(r.requests);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (open) load();
  }, [open, conversationId]);

  useEffect(() => {
    if (open) void loadPending();
  }, [open, meIsAdmin, isPublic, groupInfo?.join_policy]);

  async function decide(requestId: string, decision: "approved" | "rejected") {
    setBusy(true);
    try {
      await decideJoinRequest({ data: { requestId, decision } });
      toast.success(decision === "approved" ? "Aprovado" : "Recusado");
      setPendingReqs(p => p.filter(r => r.id !== requestId));
      if (decision === "approved") await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) return setSearchResults([]);
    setSearching(true);
    const { data } = await supabase.rpc("search_users", { q });
    const memberIds = new Set(members.map((m) => m.user_id));
    setSearchResults(((data as any[]) ?? []).filter((u) => !memberIds.has(u.id)));
    setSearching(false);
  }

  async function addMember(userId: string) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: conversationId, user_id: userId, role: "member" });
      if (error) throw error;
      toast.success(t("chat.memberAdded"));
      setQuery("");
      setSearchResults([]);
      setAddOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("conversation_members")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
      toast.success(t("chat.memberRemoved"));
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin(userId: string, currentRole: string) {
    setBusy(true);
    try {
      const newRole = currentRole === "admin" ? "member" : "admin";
      const { error } = await supabase
        .from("conversation_members")
        .update({ role: newRole })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
      toast.success(newRole === "admin" ? t("chat.promotedToAdmin") : t("chat.removedFromAdmin"));
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function leaveGroup() {
    if (!user) return;
    setBusy(true);
    try {
      // Soft-leave: keep membership row so chat history stays visible in
      // the sidebar; user just can't send new messages.
      const { error } = await (supabase as any)
        .from("conversation_members")
        .update({ left_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(t("chat.leftGroup"));
      onOpenChange(false);
      navigate({ to: "/chat" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      setConfirmLeave(false);
    }
  }

  async function deleteGroup() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);
      if (error) throw error;
      toast.success(t("chat.groupDeleted"));
      onOpenChange(false);
      onDeleted?.();
      navigate({ to: "/chat" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{groupName}</DialogTitle>
            <DialogDescription>
              {t("chat.participantsCount", { count: members.length })}
              {meIsAdmin && t("chat.youAreAdmin")}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {groupInfo && (
                <div className="rounded-lg border border-border p-2.5 text-xs flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    {isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                    {isPublic ? "Comunidade pública" : "Grupo privado"}
                    {isPublic && groupInfo.join_policy === "request" && <span>· aprovação</span>}
                    {isPublic && groupInfo.join_policy === "open" && <span>· entrada livre</span>}
                  </span>
                  {meIsAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                      <Settings2 className="size-3.5 mr-1" /> Editar
                    </Button>
                  )}
                </div>
              )}

              {groupInfo?.pinned_message && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 text-xs">
                  <div className="font-semibold text-primary mb-1 flex items-center gap-1">📌 Mensagem fixada</div>
                  <p className="whitespace-pre-wrap text-foreground/90">{groupInfo.pinned_message}</p>
                </div>
              )}

              {groupInfo?.description && (
                <div className="rounded-lg border border-border p-2.5 text-xs">
                  <div className="font-semibold mb-1">Descrição</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{groupInfo.description}</p>
                </div>
              )}

              {groupInfo?.rules && (
                <div className="rounded-lg border border-border p-2.5 text-xs">
                  <div className="font-semibold mb-1">📋 Regras do grupo</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{groupInfo.rules}</p>
                </div>
              )}

              {isPublic && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    const url = `${window.location.origin}/g/${conversationId}`;
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: groupName, url });
                      } else {
                        await navigator.clipboard.writeText(url);
                        toast.success("Link copiado");
                      }
                    } catch { /* user cancelled */ }
                  }}
                >
                  <Share2 className="size-4 mr-2" /> Compartilhar grupo
                </Button>
              )}

              {meIsAdmin && isPublic && groupInfo?.join_policy === "request" && pendingReqs.length > 0 && (
                <div className="rounded-lg border border-border p-2 space-y-1">
                  <div className="text-xs font-semibold px-1">Solicitações pendentes ({pendingReqs.length})</div>
                  {pendingReqs.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 p-1.5">
                      <Avatar className="size-8">
                        <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                        <AvatarFallback>{r.profile?.display_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{r.profile?.display_name ?? "Usuário"}</div>
                        <div className="text-xs text-muted-foreground truncate">@{r.profile?.username}</div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(r.id, "approved")}>
                        <Check className="size-4 text-green-500" />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(r.id, "rejected")}>
                        <X className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {meIsAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="w-full justify-start"
                >
                  <UserPlus className="size-4 mr-2" /> {t("chat.addParticipant")}
                </Button>
              )}


              <div className="max-h-72 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-1">
                {members.map((m) => {
                  const isMe = m.user_id === user?.id;
                  const isAdmin = m.role === "admin";
                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30"
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {m.profile?.display_name ?? t("chat.user")}
                          {isMe && <span className="text-xs text-muted-foreground">{t("chat.youBadge")}</span>}
                          {isAdmin && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              <Crown className="size-2.5" /> admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{m.profile?.username}
                        </div>
                      </div>
                      {meIsAdmin && !isMe && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            title={isAdmin ? t("chat.removeAdmin") : t("chat.makeAdmin")}
                            onClick={() => toggleAdmin(m.user_id, m.role)}
                          >
                            {isAdmin ? (
                              <ShieldOff className="size-4" />
                            ) : (
                              <Crown className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            title={t("chat.removeFromGroup")}
                            onClick={() => removeMember(m.user_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2 sm:space-x-0">
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmLeave(true)}
                  disabled={busy}
                >
                  <LogOut className="size-4 mr-2" /> {t("chat.leaveGroup")}
                </Button>
                {meIsAdmin && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4 mr-2" /> {t("chat.deleteGroup")}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add member sub-dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.addParticipant")}</DialogTitle>
            <DialogDescription>{t("chat.searchByNameOrUser")}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder={t("chat.searchUserPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {searching && <Loader2 className="size-4 animate-spin mx-auto my-4" />}
            {!searching && query && searchResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                {t("chat.noUsersAvailable")}
              </p>
            )}
            {searchResults.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => addMember(r.id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 disabled:opacity-50"
              >
                <Avatar className="size-9">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{r.display_name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{r.username}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave confirmation */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.leaveGroupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chat.leaveGroupDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("chat.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={leaveGroup} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />} {t("chat.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.deleteGroupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chat.deleteGroupDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("chat.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteGroup}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="size-4 animate-spin mr-2" />} {t("chat.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {groupInfo && (
        <EditGroupDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          group={groupInfo}
          onSaved={(patch) => { setGroupInfo({ ...groupInfo, ...patch }); }}
        />
      )}
    </>
  );
}

const CATEGORIES = [
  { value: "business", label: "Negócios" }, { value: "tech", label: "Tecnologia" },
  { value: "games", label: "Games" }, { value: "music", label: "Música" },
  { value: "entertainment", label: "Entretenimento" }, { value: "relationships", label: "Relacionamentos" },
  { value: "travel", label: "Viagens" }, { value: "sports", label: "Esportes" },
  { value: "education", label: "Educação" }, { value: "other", label: "Outros" },
] as const;

function EditGroupDialog({ open, onOpenChange, group, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; group: any; onSaved: (patch: any) => void }) {
  const [name, setName] = useState(group.name ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [visibility, setVisibility] = useState<"private"|"public">(group.visibility ?? "private");
  const [category, setCategory] = useState<string>(group.category ?? "other");
  const [joinPolicy, setJoinPolicy] = useState<"open"|"request">(group.join_policy ?? "request");
  const [rules, setRules] = useState(group.rules ?? "");
  const [pinned, setPinned] = useState(group.pinned_message ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(group.name ?? "");
      setDescription(group.description ?? "");
      setVisibility(group.visibility ?? "private");
      setCategory(group.category ?? "other");
      setJoinPolicy(group.join_policy ?? "request");
      setRules(group.rules ?? "");
      setPinned(group.pinned_message ?? "");
    }
  }, [open, group]);

  async function save() {
    setBusy(true);
    try {
      const patch: any = {
        id: group.id,
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        category: visibility === "public" ? (category as any) : null,
        join_policy: visibility === "public" ? joinPolicy : "request",
        rules: rules.trim() || null,
        pinned_message: pinned.trim() || null,
      };
      await updateGroupSettings({ data: patch });
      toast.success("Grupo atualizado");
      onSaved({ name: patch.name, description: patch.description, visibility, category: patch.category, join_policy: patch.join_policy, rules: patch.rules, pinned_message: patch.pinned_message });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar grupo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className="mt-1.5 min-h-20" placeholder="Sobre o que é este grupo" />
          </div>
          <div>
            <label className="text-sm font-medium">📌 Mensagem fixada</label>
            <Textarea value={pinned} onChange={(e) => setPinned(e.target.value)} maxLength={1000} className="mt-1.5 min-h-16" placeholder="Aviso destacado no topo do grupo" />
          </div>
          <div>
            <label className="text-sm font-medium">📋 Regras do grupo</label>
            <Textarea value={rules} onChange={(e) => setRules(e.target.value)} maxLength={2000} className="mt-1.5 min-h-24" placeholder="1. Respeite os membros&#10;2. Sem spam&#10;3. ..." />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button type="button" onClick={() => setVisibility("private")}
                className={`p-2.5 rounded-lg border text-sm flex items-center gap-2 ${visibility==="private"?"border-primary bg-primary/5":"border-border"}`}>
                <Lock className="size-3.5" /> Privado
              </button>
              <button type="button" onClick={() => setVisibility("public")}
                className={`p-2.5 rounded-lg border text-sm flex items-center gap-2 ${visibility==="public"?"border-primary bg-primary/5":"border-border"}`}>
                <Globe className="size-3.5" /> Público
              </button>
            </div>
          </div>
          {visibility === "public" && (
            <>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Como entrar</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button type="button" onClick={() => setJoinPolicy("open")}
                    className={`p-2.5 rounded-lg border text-sm ${joinPolicy==="open"?"border-primary bg-primary/5":"border-border"}`}>Livre</button>
                  <button type="button" onClick={() => setJoinPolicy("request")}
                    className={`p-2.5 rounded-lg border text-sm ${joinPolicy==="request"?"border-primary bg-primary/5":"border-border"}`}>Aprovação</button>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin mr-2" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

