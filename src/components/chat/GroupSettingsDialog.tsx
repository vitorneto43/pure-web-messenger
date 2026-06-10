import { useEffect, useState } from "react";
import { Crown, Loader2, LogOut, Search, ShieldOff, Trash2, UserMinus, UserPlus, X } from "lucide-react";
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

  const meIsAdmin = members.find((m) => m.user_id === user?.id)?.role === "admin";

  async function load() {
    setLoading(true);
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

  useEffect(() => {
    if (open) load();
  }, [open, conversationId]);

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
    </>
  );
}
