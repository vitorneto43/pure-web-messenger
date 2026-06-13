import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRestrictions } from "@/lib/moderation.functions";
import { useAuth } from "@/hooks/use-auth";
import { Ban, Clock, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ModerationGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const fn = useServerFn(getMyRestrictions);
  const { data } = useQuery({
    queryKey: ["my-restrictions", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    refetchInterval: 5 * 60_000,
  });
  const navigate = useNavigate();

  if (!data) return <>{children}</>;
  if (data.banned) {
    return (
      <RestrictionScreen
        icon={<Ban className="size-10 text-destructive" />}
        title="Sua conta foi banida"
        body={
          data.last_action?.reason ??
          "Detectamos violação grave das Diretrizes da Comunidade. O acesso foi permanentemente revogado."
        }
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/diretrizes" });
        }}
      />
    );
  }
  if (data.suspended && data.suspended_until) {
    return (
      <RestrictionScreen
        icon={<Clock className="size-10 text-amber-500" />}
        title="Sua conta está temporariamente suspensa"
        body={
          (data.last_action?.reason ?? "Sua conta foi suspensa por violação das Diretrizes da Comunidade.") +
          ` Acesso restaurado ${formatDistanceToNow(new Date(data.suspended_until), {
            addSuffix: true,
            locale: ptBR,
          })}.`
        }
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/diretrizes" });
        }}
      />
    );
  }
  return <>{children}</>;
}

function RestrictionScreen({
  icon,
  title,
  body,
  onSignOut,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <div className="size-16 rounded-full bg-muted grid place-items-center mx-auto">{icon}</div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline">
            <a href="/diretrizes">
              <ShieldAlert className="size-4 mr-2" /> Ler Diretrizes da Comunidade
            </a>
          </Button>
          <Button onClick={onSignOut} variant="ghost">
            <LogOut className="size-4 mr-2" /> Sair
          </Button>
          <Button asChild variant="link" size="sm">
            <a href="/support">Contestar esta decisão</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
