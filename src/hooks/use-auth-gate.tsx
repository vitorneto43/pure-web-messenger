import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthGateDialog, type AuthGateAction } from "@/components/AuthGateDialog";

/**
 * useAuthGate — wrapper para ações que exigem login.
 * - Se logado: executa o callback.
 * - Se não: abre modal pedindo cadastro/login.
 *
 * Exemplo:
 *   const { gate, GateDialog } = useAuthGate();
 *   <Button onClick={() => gate("follow", () => toggleFollow())}>Seguir</Button>
 *   {GateDialog}
 */
export function useAuthGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<AuthGateAction>("default");

  const gate = useCallback(
    (act: AuthGateAction, fn: () => unknown) => {
      if (user) return fn();
      setAction(act);
      setOpen(true);
    },
    [user],
  );

  const GateDialog = <AuthGateDialog open={open} onOpenChange={setOpen} action={action} />;

  return { gate, GateDialog, isAuthed: !!user };
}
