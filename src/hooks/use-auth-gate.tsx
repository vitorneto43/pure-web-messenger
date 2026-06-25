import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthGateDialog, type AuthGateAction } from "@/components/AuthGateDialog";

/**
 * useAuthGate — wrapper para ações que exigem login.
 * - Se logado: executa o callback.
 * - Se não: abre modal de login. Após autenticar, executa a ação pendente
 *   automaticamente, sem redirecionar nem perder contexto.
 */
export function useAuthGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<AuthGateAction>("default");
  const pendingRef = useRef<null | (() => unknown)>(null);
  const wasGuestRef = useRef(!user);

  const gate = useCallback(
    (act: AuthGateAction, fn: () => unknown) => {
      if (user) return fn();
      pendingRef.current = fn;
      setAction(act);
      setOpen(true);
    },
    [user],
  );

  // Após autenticar (transição guest -> user), executa a ação pendente.
  useEffect(() => {
    if (user && wasGuestRef.current) {
      wasGuestRef.current = false;
      const fn = pendingRef.current;
      pendingRef.current = null;
      setOpen(false);
      if (fn) {
        // pequeno delay para permitir hidratação de hooks dependentes da sessão
        setTimeout(() => {
          try {
            fn();
          } catch {
            /* noop */
          }
        }, 50);
      }
    } else if (!user) {
      wasGuestRef.current = true;
    }
  }, [user]);

  const GateDialog = <AuthGateDialog open={open} onOpenChange={setOpen} action={action} />;

  return { gate, GateDialog, isAuthed: !!user };
}
