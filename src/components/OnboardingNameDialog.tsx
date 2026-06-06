import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 24);

export function OnboardingNameDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded, display_name, username")
        .eq("id", user.id)
        .maybeSingle();
      if (data && !data.onboarded) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const suggestedName =
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && meta.name) ||
          data.display_name ||
          "";
        setDisplayName(typeof suggestedName === "string" ? suggestedName : "");
        setUsername(normalize(data.username ?? ""));
        setOpen(true);
      }
    })();
  }, [user]);

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error("Como você quer ser chamado?");
      return;
    }
    const u = normalize(username);
    if (u.length < 3) {
      toast.error("Nome de usuário precisa de pelo menos 3 letras");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("complete_onboarding", {
        _display_name: displayName,
        _username: u,
      });
      if (error) throw error;
      toast.success(`Bem-vindo(a), ${displayName}!`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* bloqueado até preencher */ }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto size-12 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center mb-2">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">Como você quer ser chamado?</DialogTitle>
          <DialogDescription className="text-center">
            Personalize seu nome no Wavechat. Isso aparece para seus amigos nas conversas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ob-name">Seu nome</Label>
            <Input
              id="ob-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: João Silva"
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ob-user">Nome de usuário</Label>
            <Input
              id="ob-user"
              value={username}
              onChange={(e) => setUsername(normalize(e.target.value))}
              placeholder="joao_silva"
              autoCapitalize="none"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Só letras, números e _ — entre 3 e 24 caracteres.
            </p>
          </div>
          <Button onClick={handleSave} disabled={busy} className="w-full">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
