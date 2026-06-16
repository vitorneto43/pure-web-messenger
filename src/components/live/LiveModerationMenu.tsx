import { useEffect, useState } from "react";
import { MoreVertical, Flag, Ban, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReportContentDialog } from "@/components/ReportContentDialog";
import { blockUser, takedownLive } from "@/lib/moderation.functions";

const TAKEDOWN_REASONS = [
  { value: "minor", label: "Conteúdo envolvendo menor de idade" },
  { value: "sexual", label: "Nudez / conteúdo sexual" },
  { value: "violence", label: "Violência / sangue" },
  { value: "hate", label: "Discurso de ódio" },
  { value: "illegal", label: "Atividade ilegal" },
  { value: "other", label: "Outro" },
];

export function LiveModerationMenu({
  liveId,
  hostId,
  isHost,
  onTakendown,
}: {
  liveId: string;
  hostId: string;
  isHost: boolean;
  onTakendown?: () => void;
}) {
  const [meId, setMeId] = useState<string | null>(null);
  const [isMod, setIsMod] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [tdReason, setTdReason] = useState("");
  const [tdDetails, setTdDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const block = useServerFn(blockUser);
  const takedown = useServerFn(takedownLive);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setMeId(uid);
      if (!uid) return;
      const [mod, admin, sup] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "moderator" }),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: uid, _role: "superadmin" }),
      ]);
      setIsMod(!!(mod.data || admin.data || sup.data));
    })();
  }, []);

  if (!meId) return null;
  if (isHost && !isMod) return null;

  async function doBlock() {
    setBusy(true);
    try {
      await block({ data: { user_id: hostId } });
      toast.success("Host bloqueado. Você não verá mais conteúdo dele.");
      setBlockOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao bloquear");
    } finally {
      setBusy(false);
    }
  }

  async function doTakedown() {
    if (!tdReason) {
      toast.error("Escolha um motivo");
      return;
    }
    setBusy(true);
    try {
      await takedown({ data: { live_id: liveId, reason: tdReason, details: tdDetails.trim() || undefined } });
      toast.success("Live removida do ar.");
      setTakedownOpen(false);
      onTakendown?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover live");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="bg-black/50 hover:bg-black/70 text-white rounded-full size-9"
            aria-label="Mais opções"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!isHost && (
            <>
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag className="size-4 mr-2" /> Denunciar live
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBlockOpen(true)} className="text-destructive">
                <Ban className="size-4 mr-2" /> Bloquear host
              </DropdownMenuItem>
            </>
          )}
          {isMod && (
            <>
              {!isHost && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => setTakedownOpen(true)}
                className="text-destructive font-semibold"
              >
                <ShieldAlert className="size-4 mr-2" /> Tirar live do ar (mod)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportContentDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="live"
        targetId={liveId}
        reportedUserId={hostId}
      />

      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear este host?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não verá mais lives, posts ou mensagens dessa pessoa. Você pode desfazer depois nas configurações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doBlock} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={takedownOpen} onOpenChange={setTakedownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> Tirar live do ar
            </DialogTitle>
            <DialogDescription>
              Ação imediata de moderação. A transmissão será encerrada para todos. Use somente em casos graves (pedofilia, violência, sexo explícito, etc).
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={tdReason} onValueChange={setTdReason} className="space-y-1.5">
            {TAKEDOWN_REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30">
                <RadioGroupItem value={r.value} id={`td-${r.value}`} />
                <Label htmlFor={`td-${r.value}`} className="flex-1 cursor-pointer text-sm">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <Textarea
            placeholder="Detalhes (opcional)"
            value={tdDetails}
            onChange={(e) => setTdDetails(e.target.value)}
            maxLength={1000}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTakedownOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={doTakedown} disabled={busy || !tdReason}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Tirar do ar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
