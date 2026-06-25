import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminInviteOverview,
  listInviteRelations,
  listAmbassadorTiers,
  upsertAmbassadorTier,
  deleteAmbassadorTier,
  getAmbassadorSettings,
  updateAmbassadorSettings,
} from "@/lib/invites.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#22c55e", "#1877F2", "#dc2743", "#000000", "#FF6E00", "#6366f1", "#94a3b8", "#a855f7"];
const LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok",
  kwai: "Kwai", share: "Compartilhar", copy: "Link", other: "Outros",
};

export function InvitesAdminTab() {
  const overviewFn = useServerFn(getAdminInviteOverview);
  const relationsFn = useServerFn(listInviteRelations);
  const tiersFn = useServerFn(listAmbassadorTiers);
  const settingsFn = useServerFn(getAmbassadorSettings);
  const updateSettingsFn = useServerFn(updateAmbassadorSettings);
  const upsertTierFn = useServerFn(upsertAmbassadorTier);
  const deleteTierFn = useServerFn(deleteAmbassadorTier);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");

  const overview = useQuery({ queryKey: ["admin-invite-overview"], queryFn: () => overviewFn() });
  const relations = useQuery({
    queryKey: ["admin-invite-relations", search],
    queryFn: () => relationsFn({ data: { search, limit: 200 } }),
  });
  const tiers = useQuery({ queryKey: ["ambassador-tiers"], queryFn: () => tiersFn() });
  const settings = useQuery({ queryKey: ["ambassador-settings"], queryFn: () => settingsFn() });

  const setSetting = useMutation({
    mutationFn: (data: { ranking_public?: boolean; rewards_enabled?: boolean }) => updateSettingsFn({ data }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["ambassador-settings"] });
    },
  });

  const saveTier = useMutation({
    mutationFn: (data: any) => upsertTierFn({ data }),
    onSuccess: () => {
      toast.success("Nível salvo");
      qc.invalidateQueries({ queryKey: ["ambassador-tiers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const removeTier = useMutation({
    mutationFn: (id: string) => deleteTierFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Nível removido");
      qc.invalidateQueries({ queryKey: ["ambassador-tiers"] });
    },
  });

  if (overview.isLoading)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );

  const d = overview.data!;
  const pieData = Object.entries(d.by_channel ?? {}).map(([k, v]) => ({
    name: LABELS[k] ?? k, value: v,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cliques totais" value={d.total_clicks} />
        <Stat label="Cadastros via convite" value={d.total_signups} />
        <Stat label="Inviters únicos" value={d.unique_inviters} />
        <Stat
          label="Conversão"
          value={d.total_clicks ? `${((d.total_signups / d.total_clicks) * 100).toFixed(1)}%` : "—"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Crescimento (30 dias)</CardTitle></CardHeader>
        <CardContent style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.daily}>
              <XAxis dataKey="day" fontSize={10} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="clicks" stroke="#6366f1" name="Cliques" />
              <Line type="monotone" dataKey="signups" stroke="#22c55e" name="Cadastros" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Origem dos convites</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Cadastros por canal</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {Object.entries(d.signups_by_channel ?? {}).map(([k, v]) => (
                <li key={k} className="flex justify-between text-sm">
                  <span>{LABELS[k] ?? k}</span><span className="font-semibold">{v}</span>
                </li>
              ))}
              {Object.keys(d.signups_by_channel ?? {}).length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum cadastro ainda.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="rp">Ranking público de embaixadores</Label>
            <Switch
              id="rp"
              checked={!!settings.data?.ranking_public}
              onCheckedChange={(v) => setSetting.mutate({ ranking_public: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="re">Recompensas ativas</Label>
            <Switch
              id="re"
              checked={!!settings.data?.rewards_enabled}
              onCheckedChange={(v) => setSetting.mutate({ rewards_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Níveis de Embaixador</CardTitle>
          <NewTierButton onSave={(payload) => saveTier.mutate(payload)} />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(tiers.data ?? []).map((t: any) => (
              <TierRow
                key={t.id}
                tier={t}
                onSave={(payload) => saveTier.mutate({ id: t.id, ...payload })}
                onDelete={() => removeTier.mutate(t.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Quem convidou quem</CardTitle></CardHeader>
        <CardContent>
          <Input placeholder="Buscar por usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
          {relations.isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-1">Convidou</th>
                    <th>Novo usuário</th>
                    <th>Canal</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {(relations.data ?? []).map((r: any) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-1">@{r.inviter?.username ?? "—"}</td>
                      <td>@{r.invited?.username ?? "—"}</td>
                      <td>{LABELS[r.channel] ?? r.channel}</td>
                      <td className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(relations.data ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sem convites ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function TierRow({ tier, onSave, onDelete }: { tier: any; onSave: (p: any) => void; onDelete: () => void }) {
  const [name, setName] = useState(tier.name);
  const [icon, setIcon] = useState(tier.icon);
  const [min, setMin] = useState<number>(tier.min_invites);
  const [active, setActive] = useState<boolean>(tier.active);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
      <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-16" />
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[140px]" />
      <Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} className="w-24" />
      <div className="flex items-center gap-1">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs">ativo</span>
      </div>
      <Button size="sm" onClick={() => onSave({ name, icon, min_invites: min, active })}>Salvar</Button>
      <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="size-4" /></Button>
    </div>
  );
}

function NewTierButton({ onSave }: { onSave: (p: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏅");
  const [min, setMin] = useState(1);
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1" /> Novo nível
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 h-8" />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="h-8 w-32" />
      <Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} className="w-20 h-8" />
      <Button size="sm" onClick={() => { onSave({ name, icon, min_invites: min }); setOpen(false); }}>OK</Button>
    </div>
  );
}
