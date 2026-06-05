import "@/i18n";
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
import { useTranslation } from "react-i18next";

type PermState = "default" | "granted" | "denied" | "unsupported";

export function NotificationSettings() {
  const { t } = useTranslation();
  const isNativeApp =
    typeof window !== "undefined" &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  if (isNativeApp) return null;

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
      toast.error(t("app.notif.toastOpenPublished"));
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPerm(perm as PermState);
      if (perm !== "granted") {
        toast.error(t("app.notif.toastPermDenied"));
        return;
      }
      const reg = await registerServiceWorker();
      if (!reg) throw new Error("Falha ao registrar service worker");
      const sub = await subscribeToPush(reg);
      if (!sub) throw new Error("Falha ao se inscrever para push");
      await saveSubscription({ data: subscriptionToRow(sub) });
      setSubscribed(true);
      toast.success(t("app.notif.toastActivated"));
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
      body: t("app.notif.testBody"),
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
          <h3 className="font-semibold">{t("app.notif.title")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t("app.notif.desc")}</p>

          <div className="mt-3 text-xs">
            {perm === "unsupported" && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className="size-3.5" />
                {t("app.notif.unsupported")}
              </div>
            )}
            {perm === "granted" && subscribed && (
              <div className="flex items-center gap-1.5 text-green-500">
                <CheckCircle2 className="size-3.5" />
                {t("app.notif.active")}
              </div>
            )}
            {perm === "granted" && !subscribed && (
              <div className="flex items-center gap-1.5 text-amber-500">
                <AlertCircle className="size-3.5" />
                {t("app.notif.permittedNotSub")}
              </div>
            )}
            {perm === "default" && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className="size-3.5" />
                {t("app.notif.notActive")}
              </div>
            )}
            {perm === "denied" && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="size-3.5" />
                {t("app.notif.blocked")}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {perm !== "unsupported" && perm !== "denied" && (
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                {subscribed ? t("app.notif.btnReactivate") : t("app.notif.btnActivate")}
              </Button>
            )}
            {perm === "granted" && subscribed && (
              <Button size="sm" variant="secondary" onClick={testNotification}>
                {t("app.notif.btnTest")}
              </Button>
            )}
          </div>

          {perm === "denied" && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">{t("app.notif.unlockTitle")}</summary>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>{t("app.notif.unlockStep1")}</li>
                <li>{t("app.notif.unlockStep2")}</li>
                <li>{t("app.notif.unlockStep3")}</li>
                <li>{t("app.notif.unlockStep4")}</li>
              </ol>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
