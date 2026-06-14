import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Award, X } from "lucide-react";

interface BadgeRow {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  is_automatic: boolean;
}

interface UserRow { id: string; username: string; display_name: string; avatar_url: string | null }
interface AwardRow {
  user_id: string; awarded_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
}

export function BadgesTab() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("verified");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [owners, setOwners] = useState<AwardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).from("badges").select("*").order("display_priority", { ascending: false });
      setBadges((data as BadgeRow[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    void loadOwners();
  }, [selectedCode]);

  async function loadOwners() {
    if (!selectedCode) return;
    setLoading(true);
    const { data: badge } = await (supabase as any).from("badges").select("id").eq("code", selectedCode).maybeSingle();
    if (!badge) { setOwners([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("user_badges")
      .select("user_id, awarded_at, profiles:user_id(username, display_name, avatar_url)")
      .eq("badge_id", badge.id)
      .order("awarded_at", { ascending: false })
      .limit(200);
    setOwners((data as AwardRow[]) ?? []);
    setLoading(false);
  }

  async function doSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    setSearchResults((data as UserRow[]) ?? []);
  }

  async function award(userId: string) {
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_award_badge", { _user_id: userId, _badge_code: selectedCode });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Selo concedido");
    setSearch(""); setSearchResults([]);
    void loadOwners();
  }

  async function revoke(userId: string) {
    if (!confirm("Remover este selo do usuário?")) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_revoke_badge", { _user_id: userId, _badge_code: selectedCode });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Selo removido");
    void loadOwners();
  }

  const selected = badges.find((b) => b.code === selectedCode);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Award className="size-4" /> Catálogo de Selos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {badges.map((b) => (
              <button
                key={b.code}
                onClick={() => setSelectedCode(b.code)}
                className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                  selectedCode === b.code ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <span className="text-2xl leading-none">{b.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: b.color }}>{b.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{b.description}</p>
                  <p className="text-[9px] mt-0.5 text-muted-foreground/70">
                    {b.is_automatic ? "Automático" : "Manual"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-xl">{selected.icon}</span>
              {selected.name}
              <span className="text-xs font-normal text-muted-foreground ml-auto">{owners.length} usuário(s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {selected.is_automatic
                  ? "Este selo é concedido automaticamente. Você ainda pode conceder ou remover manualmente, mas o sistema poderá recalcular."
                  : "Conceder manualmente:"}
              </p>
              <Input
                placeholder="Buscar usuário por @ ou nome..."
                value={search}
                onChange={(e) => void doSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/30">
                      <Avatar className="size-8"><AvatarImage src={u.avatar_url ?? undefined} /><AvatarFallback>{u.display_name?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                      </div>
                      <Button size="sm" disabled={busy} onClick={() => void award(u.id)}>Conceder</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Possuem este selo</p>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin" /></div>
              ) : owners.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">Ninguém ainda.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {owners.map((a) => (
                    <div key={a.user_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/30">
                      <Avatar className="size-8"><AvatarImage src={a.profiles?.avatar_url ?? undefined} /><AvatarFallback>{a.profiles?.display_name?.[0] ?? "?"}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.profiles?.display_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">@{a.profiles?.username ?? "—"} · {new Date(a.awarded_at).toLocaleDateString()}</p>
                      </div>
                      <Button size="icon" variant="ghost" disabled={busy} onClick={() => void revoke(a.user_id)} aria-label="Remover">
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
