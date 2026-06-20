import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GuestBanner() {
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur px-3 py-1.5 flex items-center justify-between text-xs">
      <span className="text-muted-foreground inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Visitando como convidado
      </span>
      <Button size="sm" variant="default" className="h-7 px-3 text-xs" onClick={() => navigate({ to: "/auth", search: { mode: "login" } })}>
        <UserPlus className="size-3.5 mr-1" /> Entrar
      </Button>
    </div>
  );
}
