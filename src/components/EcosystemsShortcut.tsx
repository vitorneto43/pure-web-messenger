import { Link } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { useEcosystems } from "@/hooks/use-ecosystem";
import { useAuth } from "@/hooks/use-auth";

export function EcosystemsShortcut() {
  const { user } = useAuth();
  const { ecosystems, loading } = useEcosystems();
  if (!user) return null;

  if (loading) return null;

  if (ecosystems.length === 0) {
    return (
      <Link
        to="/ecosystems/new"
        className="mb-3 flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 hover:bg-primary/10 transition"
      >
        <div className="size-10 rounded-full bg-primary/15 grid place-items-center shrink-0">
          <Building2 className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-tight flex items-center gap-1">
            Wavechat for Business, Study & mais
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              novo
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">
            Crie um espaço privado para sua empresa, universidade ou clube
          </div>
        </div>
        <Plus className="size-4 text-primary shrink-0" />
      </Link>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card px-2 py-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Meus ecossistemas
        </span>
        <Link
          to="/ecosystems/new"
          className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
        >
          <Plus className="size-3" /> Novo
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {ecosystems.map((e) => (
          <Link
            key={e.id}
            to="/e/$slug"
            params={{ slug: e.slug }}
            className="shrink-0 w-28 rounded-xl border border-border bg-background p-2 flex flex-col items-center text-center hover:border-primary/40 transition"
          >
            <div className="size-10 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 grid place-items-center overflow-hidden mb-1">
              {e.logo_url ? (
                <img src={e.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="size-5 text-primary" />
              )}
            </div>
            <div className="text-[11px] font-semibold leading-tight truncate w-full">{e.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
