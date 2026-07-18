import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, Star, Sparkles, Rocket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Sort = "streak_desc" | "streak_asc" | "name" | "last_publish";
type Filter = "all" | "creator" | "verified" | "organic";

interface Row {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  last_publish_date: string | null;
  organic_boost: boolean;
  is_content_creator: boolean;
  is_activity_verified: boolean;
  content_creator_since: string | null;
  verified_since: string | null;
  organic_boost_since: string | null;
}

export function ActivityRewardsTab() {
  const [sort, setSort] = useState<Sort>("streak_desc");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-activity-rewards", sort, filter, search],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_activity_rewards", {
        _sort: sort,
        _filter: filter,
        _search: search || null,
        _limit: 200,
        _offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const stats = {
    total: rows.length,
    creators: rows.filter((r) => r.is_content_creator).length,
    verified: rows.filter((r) => r.is_activity_verified).length,
    organic: rows.filter((r) => r.organic_boost).length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="size-6 text-orange-500" /> Recompensas por Atividade
        </h2>
        <p className="text-sm text-muted-foreground">
          Sequência diária de publicação · +15 dias: Criador · +30 dias: Verificado · +60 dias: Impulso Orgânico
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Flame} label="Usuários com sequência" value={stats.total} color="text-orange-500" />
        <StatCard icon={Sparkles} label="Criadores (≥15d)" value={stats.creators} color="text-blue-500" />
        <StatCard icon={Star} label="Verificados por atividade (≥30d)" value={stats.verified} color="text-emerald-500" />
        <StatCard icon={Rocket} label="Impulso Orgânico (≥60d)" value={stats.organic} color="text-amber-500" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ranking</CardTitle>
          <CardDescription>Filtre, ordene e busque usuários.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Buscar por @ ou nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="creator">Criadores</SelectItem>
                <SelectItem value="verified">Verificados (atividade)</SelectItem>
                <SelectItem value="organic">Impulso Orgânico</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="streak_desc">Sequência (maior)</SelectItem>
                <SelectItem value="streak_asc">Sequência (menor)</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
                <SelectItem value="last_publish">Última publicação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {q.isLoading && <Loader2 className="size-5 animate-spin" />}
          {!q.isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Usuário</th>
                  <th className="text-right py-2 px-2">Sequência</th>
                  <th className="text-right py-2 px-2">Maior</th>
                  <th className="text-left py-2 px-2">Última publicação</th>
                  <th className="text-left py-2 px-2">Selos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt="" className="size-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="size-7 rounded-full bg-muted shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.display_name ?? r.username ?? "—"}</p>
                          {r.username && <p className="text-xs text-muted-foreground truncate">@{r.username}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Flame className="size-4 text-orange-500" /> {r.current_streak}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{r.longest_streak}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {r.last_publish_date
                        ? formatDistanceToNow(new Date(r.last_publish_date), { addSuffix: true, locale: ptBR })
                        : "—"}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-1">
                        {r.is_content_creator && (
                          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400">
                            <Sparkles className="size-3 mr-1" /> Criador
                          </Badge>
                        )}
                        {r.is_activity_verified && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <Star className="size-3 mr-1" /> Verificado
                          </Badge>
                        )}
                        {r.organic_boost && (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Rocket className="size-3 mr-1" /> Orgânico
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={`size-4 ${color}`} />
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
