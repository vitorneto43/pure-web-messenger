import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isPreviewOrIframe,
  registerServiceWorker,
  subscribeToPush,
  subscriptionToRow,
} from "@/lib/push-client";
import { saveSubscription } from "@/lib/push.functions";

type PermState = "default" | "granted" | "denied" | "unsupported";

export function NotificationSettings() {
  const [perm, setPerm] = useState<PermState>("default");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission as PermState);
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  async function enable() {
    if (isPreviewOrIframe()) {
      toast.error("Abra o app publicado para ativar notificações.");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPerm(perm as PermState);
      if (perm !== "granted") {
        toast.error("Permissão negada. Ative nas configurações do navegador.");
        return;
      }
      const reg = await registerServiceWorker();
      if (!reg) throw new Error("Falha ao registrar service worker");
      const sub = await subscribeToPush(reg);
      if (!sub) throw new Error("Falha ao se inscrever para push");
      await saveSubscription({ data: subscriptionToRow(sub) });
      setSubscribed(true);
      toast.success("Notificações ativadas neste dispositivo");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao ativar notificações");
    } finally {
      setBusy(false);
    }
  }

  async function testNotification() {
    if (perm !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return toast.error("Service worker não registrado");
    await reg.showNotification("Wavechat", {
      body: "Notificações funcionando! 🎉",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "test",
    });
  }

  return (
    <div className="rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          {perm === "granted" ? (
            <Bell className="size-5 text-primary" />
          ) : (
            <BellOff className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Notificações</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receba alertas de mensagens e chamadas neste dispositivo.
          </p>

          <div className="mt-3 text-xs">
            {perm === "unsupported" && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className="size-3.5" />
                Navegador não suporta notificações push.
              </div>
            )}
            {perm === "granted" && subscribed && (
              <div className="flex items-center gap-1.5 text-green-500">
                <CheckCircle2 className="size-3.5" />
                Ativadas neste dispositivo
              </div>
            )}
            {perm === "granted" && !subscribed && (
              <div className="flex items-center gap-1.5 text-amber-500">
                <AlertCircle className="size-3.5" />
                Permitido, mas não inscrito — clique em ativar
              </div>
            )}
            {perm === "default" && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className="size-3.5" />
                Ainda não ativadas
              </div>
            )}
            {perm === "denied" && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="size-3.5" />
                Bloqueadas — ative manualmente no navegador
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {perm !== "unsupported" && perm !== "denied" && (
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                {subscribed ? "Reativar" : "Ativar notificações"}
              </Button>
            )}
            {perm === "granted" && subscribed && (
              <Button size="sm" variant="secondary" onClick={testNotification}>
                Testar
              </Button>
            )}
          </div>

          {perm === "denied" && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Como desbloquear</summary>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Toque no cadeado/ícone ao lado do endereço do site.</li>
                <li>Vá em "Permissões" ou "Configurações do site".</li>
                <li>Mude "Notificações" para "Permitir".</li>
                <li>Recarregue a página e volte aqui.</li>
              </ol>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
