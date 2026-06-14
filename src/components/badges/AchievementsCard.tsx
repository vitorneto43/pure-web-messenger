import { useUserBadges } from "@/hooks/use-user-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  verification: "Verificação",
  historical: "Histórico",
  followers: "Seguidores",
  invites: "Convites",
  profile: "Perfil",
  activity: "Atividade",
};

export function AchievementsCard({ userId }: { userId: string | null | undefined }) {
  const { data, isLoading } = useUserBadges(userId);
  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  const byCategory: Record<string, typeof data> = {};
  for (const b of data) {
    (byCategory[b.category] ||= []).push(b);
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" /> Conquistas
          <span className="text-xs font-normal text-muted-foreground ml-auto">{data.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map((b) => (
                <div
                  key={b.code}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-muted/30"
                  title={b.description}
                >
                  <span className="text-2xl leading-none shrink-0">{b.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: b.color }}>
                      {b.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                      {b.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
