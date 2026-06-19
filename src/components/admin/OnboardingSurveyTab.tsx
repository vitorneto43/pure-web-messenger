import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOnboardingSurveyStats } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileSpreadsheet, FileText, ClipboardList } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316"];

type Recent = {
  id: string; user_id: string;
  reason_joined: string; source_channel: string; favorite_feature: string;
  main_goal: string; age_range: string; created_at: string;
  username: string | null; display_name: string | null;
  country: string | null; city: string | null;
};

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function toCSV(rows: Recent[]): string {
  const head = ["created_at","username","display_name","country","city","reason_joined","source_channel","favorite_feature","main_goal","age_range"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([
      r.created_at, r.username ?? "", r.display_name ?? "", r.country ?? "", r.city ?? "",
      r.reason_joined, r.source_channel, r.favorite_feature, r.main_goal, r.age_range,
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function exportPDF(rows: Recent[]) {
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pesquisa de Onboarding</title>
    <style>body{font-family:system-ui,sans-serif;padding:20px;color:#111} h1{font-size:18px} table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #ddd;padding:6px;text-align:left} th{background:#f3f4f6}</style>
  </head><body>
    <h1>Pesquisa de Onboarding — WaveChat</h1>
    <p>${rows.length} respostas — exportado em ${esc(new Date().toLocaleString("pt-BR"))}</p>
    <table><thead><tr>
      <th>Data</th><th>Usuário</th><th>País</th><th>Cidade</th>
      <th>Motivo</th><th>Canal</th><th>Atrativo</th><th>Objetivo</th><th>Idade</th>
    </tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td>${esc(new Date(r.created_at).toLocaleString("pt-BR"))}</td>
      <td>${esc(r.display_name ?? r.username ?? "")}</td>
      <td>${esc(r.country ?? "")}</td><td>${esc(r.city ?? "")}</td>
      <td>${esc(r.reason_joined)}</td><td>${esc(r.source_channel)}</td>
      <td>${esc(r.favorite_feature)}</td><td>${esc(r.main_goal)}</td><td>${esc(r.age_range)}</td>
    </tr>`).join("")}
    </tbody></table>
    <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

export function OnboardingSurveyTab() {
  const fn = useServerFn(getOnboardingSurveyStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "onboarding-survey"],
    queryFn: () => fn(),
  });

  const [country, setCountry] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [age, setAge] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filtered = useMemo<Recent[]>(() => {
    const all = data?.recent ?? [];
    return all.filter((r) => {
      if (country !== "all" && (r.country ?? "desconhecido") !== country) return false;
      if (city !== "all" && (r.city ?? "desconhecido") !== city) return false;
      if (age !== "all" && r.age_range !== age) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [data, country, city, age, from, to]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    (data?.recent ?? []).forEach((r) => set.add(r.country ?? "desconhecido"));
    return Array.from(set).sort();
  }, [data]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    (data?.recent ?? []).forEach((r) => set.add(r.city ?? "desconhecido"));
    return Array.from(set).sort();
  }, [data]);

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  const totals = [
    { label: "Total de respostas", value: data.total },
    { label: "Hoje", value: data.today },
    { label: "Semana", value: data.week },
    { label: "Mês", value: data.month },
  ];

  const total = data.total || 1;
  const find = (arr: Array<{ name: string; count: number }>, name: string) =>
    arr.find((x) => x.name === name)?.count ?? 0;

  const quickCards = [
    { label: "Vieram para conhecer novas pessoas", v: find(data.byReason, "Conhecer novas pessoas") },
    { label: "Vieram por influenciadores", v: find(data.bySource, "Influenciador") },
    { label: "Vieram pelo Google", v: find(data.bySource, "Google") },
    { label: "Vieram pelo Instagram", v: find(data.bySource, "Instagram") },
    { label: "Vieram por indicação", v: find(data.bySource, "Indicação de amigo") },
    { label: "Interessados em networking", v: find(data.byFeature, "Networking profissional") + find(data.byGoal, "Trabalho e networking") },
    { label: "Atraídos por privacidade sem telefone", v: find(data.byFeature, "Privacidade sem telefone") },
    { label: "Querem fazer novas amizades", v: find(data.byGoal, "Fazer novas amizades") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Pesquisa de Onboarding</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {totals.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-2xl font-bold">{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Cartões executivos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickCards.map((c) => (
            <div key={c.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold">{pct(c.v, total)}</p>
              <p className="text-xs text-muted-foreground">{c.v} de {total}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros e exportação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">País</label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cidade</label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Faixa etária</label>
            <Select value={age} onValueChange={setAge}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {data.byAge.map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => downloadBlob(`onboarding-survey-${Date.now()}.csv`, new Blob([toCSV(filtered)], { type: "text/csv;charset=utf-8" }))}>
              <Download className="size-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadBlob(`onboarding-survey-${Date.now()}.xls`, new Blob([toCSV(filtered)], { type: "application/vnd.ms-excel" }))}>
              <FileSpreadsheet className="size-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPDF(filtered)}>
              <FileText className="size-4 mr-1" /> PDF
            </Button>
            <Badge variant="secondary">{filtered.length} respostas filtradas</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Motivo de entrada" data={data.byReason} kind="bar" />
        <ChartCard title="Canal de aquisição" data={data.bySource} kind="pie" />
        <ChartCard title="Funcionalidade mais atrativa" data={data.byFeature} kind="bar" />
        <ChartCard title="Objetivo principal" data={data.byGoal} kind="pie" />
        <ChartCard title="Faixa etária" data={data.byAge} kind="bar" />
        <ChartCard title="Países" data={data.byCountry} kind="bar" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Respostas recentes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-2">Data</th>
                <th className="pr-2">Usuário</th>
                <th className="pr-2">Local</th>
                <th className="pr-2">Motivo</th>
                <th className="pr-2">Canal</th>
                <th className="pr-2">Atrativo</th>
                <th className="pr-2">Objetivo</th>
                <th>Idade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 pr-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="pr-2">{r.display_name ?? r.username ?? "—"}</td>
                  <td className="pr-2">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="pr-2">{r.reason_joined}</td>
                  <td className="pr-2">{r.source_channel}</td>
                  <td className="pr-2">{r.favorite_feature}</td>
                  <td className="pr-2">{r.main_goal}</td>
                  <td>{r.age_range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartCard({ title, data, kind }: { title: string; data: Array<{ name: string; count: number }>; kind: "bar" | "pie" }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="name" outerRadius={90} label>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
