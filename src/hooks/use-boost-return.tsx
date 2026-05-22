import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Detects the post-checkout return (?boost=success&session_id=...) and
// polls the boost row until it flips to active, then shows feedback.
export function useBoostReturn() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("boost") !== "success") return;
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    handled.current = true;

    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    const toastId = toast.loading("Confirmando pagamento...");

    let attempts = 0;
    const maxAttempts = 15; // 15 x 1s = 15s
    const poll = async () => {
      attempts++;
      const { data: boost } = await supabase
        .from("status_boosts")
        .select("id, status, views_total")
        .eq("checkout_session_id", sessionId)
        .maybeSingle();

      if (boost?.status === "active") {
        toast.success("Impulso ativado!", {
          id: toastId,
          description: `${boost.views_total} visualizações disponíveis.`,
        });
        navigate({ to: "/profile" });
        return;
      }
      if (boost?.status === "failed") {
        toast.error("Pagamento não concluído", { id: toastId });
        return;
      }
      if (attempts >= maxAttempts) {
        toast.message("Pagamento em processamento", {
          id: toastId,
          description: "Vamos te notificar quando ativar.",
        });
        return;
      }
      setTimeout(poll, 1000);
    };
    setTimeout(poll, 800);
  }, [navigate]);
}
