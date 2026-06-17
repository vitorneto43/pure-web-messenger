import { useEffect, useState } from "react";
import { Loader2, Globe, ExternalLink, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listGroupReportsAdmin } from "@/lib/groups.functions";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

const REASON_LABEL: Record<string, string> = {
  spam: "Spam", adult: "Conteúdo adulto", violence: "Violência",
  scam: "Golpe/Fraude", copyright: "Direitos autorais", other: "Outros",
};

export function GroupReportsTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [groups, setGroups] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await listGroupReportsAdmin();
      setReports(r.reports);
      const ids = Array.from(new Set(r.reports.map((x: any) => x.conversation_id)));
      if (ids.length) {
        const { data: gs } = await supabase
          .from("conversations")
          .select("id, name, avatar_url, visibility, member_count")
          .in("id", ids);
        const map: Record<string, any> = {};
        (gs ?? []).forEach((g) => { map[g.id] = g; });
        setGroups(map);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function resolve(id: string, status: "dismissed" | "actioned") {
    setBusy(id);
    try {
      const { error } = await supabase
        .from("group_reports")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Atualizado");
      setReports((rs) => rs.filter((r) => r.id !== id));
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function hideGroup(convId: string) {
    if (!confirm("Tornar este grupo privado (some das buscas)?")) return;
    setBusy(convId);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ visibility: "private" })
        .eq("id", convId);
      if (error) throw error;
      toast.success("Grupo escondido");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

  const pending = reports.filter(r => r.status === "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4" /> Grupos denunciados ({pending.length} pendentes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma denúncia pendente.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => {
              const g = groups[r.conversation_id];
              return (
                <div key={r.id} className="border border-border rounded-lg p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{g?.name ?? r.conversation_id}</span>
                      <Badge variant="destructive" className="text-xs">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
                      {g && <span className="text-xs text-muted-foreground">{g.member_count} membros · {g.visibility}</span>}
                    </div>
                    {r.details && <p className="text-xs text-muted-foreground mt-1">{r.details}</p>}
                    <div className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {g?.visibility === "public" && (
                      <Link to="/g/$groupId" params={{ groupId: r.conversation_id }} target="_blank">
                        <Button size="sm" variant="ghost"><ExternalLink className="size-3.5" /></Button>
                      </Link>
                    )}
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => resolve(r.id, "dismissed")}>
                      <X className="size-3.5 mr-1" /> Dispensar
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy === r.id || busy === r.conversation_id}
                      onClick={async () => { await hideGroup(r.conversation_id); await resolve(r.id, "actioned"); }}>
                      <Check className="size-3.5 mr-1" /> Esconder
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
