import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

function ageFrom(birth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const d = new Date(birth + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function BirthDateGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [needsBirth, setNeedsBirth] = useState(false);
  const [needsTerms, setNeedsTerms] = useState(false);
  const [birth, setBirth] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("birth_date, terms_accepted_at")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const nb = !data.birth_date;
      const nt = !data.terms_accepted_at;
      setNeedsBirth(nb);
      setNeedsTerms(nt);
      if (nb || nt) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSave() {
    if (!accepted) {
      toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }
    const age = ageFrom(birth);
    if (age === null) {
      toast.error("Informe uma data de nascimento válida.");
      return;
    }
    if (age < 15) {
      toast.error("Você precisa ter pelo menos 15 anos para utilizar a Wavechat.", {
        duration: 8000,
      });
      setBusy(true);
      try {
        await supabase.auth.signOut();
      } finally {
        setBusy(false);
        setOpen(false);
      }
      return;
    }
    setBusy(true);
    try {
      const { error: bErr } = await supabase.rpc("set_birth_date", { _birth_date: birth });
      if (bErr) {
        if (/15 anos/i.test(bErr.message)) {
          toast.error("Você precisa ter pelo menos 15 anos para utilizar a Wavechat.", {
            duration: 8000,
          });
          await supabase.auth.signOut();
          setOpen(false);
          return;
        }
        throw bErr;
      }
      const { error: tErr } = await supabase.rpc("accept_terms" as never);
      if (tErr) throw tErr;
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
            <ShieldCheck className="size-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">Antes de continuar</DialogTitle>
          <DialogDescription className="text-center">
            Precisamos confirmar sua idade e o aceite dos nossos termos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="bd-birth">Data de nascimento</Label>
            <Input
              id="bd-birth"
              type="date"
              value={birth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirth(e.target.value)}
              autoFocus
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-card/40 p-3 cursor-pointer hover:bg-accent/30 transition">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-5 accent-primary cursor-pointer"
            />
            <span className="text-sm text-foreground">
              Li e aceito os{" "}
              <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          <Button
            onClick={handleSave}
            disabled={busy || !accepted || !birth}
            className="w-full"
          >
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
