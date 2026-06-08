import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2, QrCode, Link2, MessageCircle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { saveNativeImageToGallery } from "@/integrations/native-call";
import { useTranslation } from "react-i18next";

type NativeSharePlugin = {
  share?: (data: {
    title?: string;
    text?: string;
    url?: string;
    dialogTitle?: string;
  }) => Promise<void>;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: { Share?: NativeSharePlugin };
  };
};

type UserMetadata = { username?: string };

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function getCapacitor() {
  if (typeof window === "undefined") return undefined;
  return (window as CapacitorWindow).Capacitor;
}

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mime });
}

function dataUrlToBase64(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

async function isNativePlatform() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function shareQrOnNative(qrUrl: string, fileName: string, title: string, text: string, dialogTitle: string) {
  if (!(await isNativePlatform())) return false;
  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({
      path: `qr/${Date.now()}-${fileName}`,
      data: dataUrlToBase64(qrUrl),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title,
      text,
      files: [written.uri],
      dialogTitle,
    });
    return true;
  } catch (error: any) {
    if (error?.message?.toLowerCase?.().includes("cancel")) return true;
    if (isAbortError(error)) return true;
    console.error("Failed to share QR natively", error);
    return false;
  }
}

async function logInviteAction(userId: string | undefined, target: string) {
  if (!userId) return;
  try {
    await supabase.from("share_logs").insert({
      user_id: userId,
      content_type: "invite",
      target,
    });
  } catch {
    return;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InviteDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const username = (user?.user_metadata as UserMetadata | undefined)?.username;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const link = username ? `${base}/auth?invite=${encodeURIComponent(username)}` : `${base}/auth`;
  const shareText = t("app.invite.shareText", { link });
  const qrShareText = t("app.invite.shareQrText");

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [tab, setTab] = useState("link");

  useEffect(() => {
    if (!open || tab !== "qr") return;
    let cancelled = false;
    setQrUrl(null);
    QRCode.toDataURL(link, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => toast.error(t("app.invite.toastQrFail")));
    return () => {
      cancelled = true;
    };
  }, [open, tab, link, t]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      void logInviteAction(user?.id, "copy");
      toast.success(t("app.invite.toastLinkCopied"));
    } catch {
      toast.error(t("app.invite.toastCopyFail"));
    }
  }

  async function nativeShare() {
    void logInviteAction(user?.id, "native");
    try {
      const nativeSharePlugin = getCapacitor()?.Plugins?.Share;
      if (nativeSharePlugin?.share) {
        await nativeSharePlugin.share({
          title: t("app.invite.shareTitle"),
          text: shareText,
          url: link,
          dialogTitle: t("app.invite.shareDialogTitle"),
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({ title: t("app.invite.shareTitle"), text: shareText, url: link });
        return;
      }
    } catch {
      openWhatsAppFallback(shareText);
      return;
    }
    openWhatsAppFallback(shareText);
  }

  function openWhatsAppFallback(text: string) {
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encodedText}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) window.location.href = url;
  }

  async function copyQrImage() {
    if (!qrUrl) {
      toast.error(t("app.invite.toastQrWait"));
      return;
    }
    void logInviteAction(user?.id, "qr-copy");
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem })
        .ClipboardItem;
      if (navigator.clipboard && "write" in navigator.clipboard && ClipboardItemCtor) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({ [blob.type]: blob }),
        ]);
        toast.success(t("app.invite.toastQrCopied"));
        return;
      }
      throw new Error("clipboard-image-unsupported");
    } catch {
      try {
        await navigator.clipboard.writeText(link);
        toast.success(t("app.invite.toastImageUnsupported"));
      } catch {
        toast.error(t("app.invite.toastCantCopy"));
      }
    }
  }

  async function downloadQr() {
    if (!qrUrl) {
      toast.error(t("app.invite.toastQrWait"));
      return;
    }
    void logInviteAction(user?.id, "qr-download");
    const fileName = `wavechat-qr-${username ?? "convite"}.png`;
    const savedNative = await saveNativeImageToGallery(qrUrl, fileName);
    if (savedNative) {
      toast.success(t("app.invite.toastQrSavedGallery"));
      return;
    }

    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success(t("app.invite.toastQrSaved"));
    } catch {
      toast.error(t("app.invite.toastSaveFail"));
    }
  }

  async function copyQrLink() {
    try {
      await navigator.clipboard.writeText(link);
      void logInviteAction(user?.id, "qr-link-copy");
      toast.success(t("app.invite.toastLinkCopiedShare"));
    } catch {
      toast.error(t("app.invite.toastCopyFail"));
    }
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    void logInviteAction(user?.id, "whatsapp");
    window.open(url, "_blank", "noopener");
  }

  async function shareQR() {
    if (!qrUrl) {
      toast.error(t("app.invite.toastQrWait"));
      return;
    }
    void logInviteAction(user?.id, "qr");

    const nav = navigator;
    const capacitor = getCapacitor();
    const fileName = `wavechat-qr-${username ?? "convite"}.png`;
    const qrFile = dataUrlToFile(qrUrl, fileName);
    const nativeShared = await shareQrOnNative(
      qrUrl,
      fileName,
      `QR Code ${t("app.invite.shareTitle")}`,
      qrShareText,
      t("app.invite.shareQrTitle"),
    );
    if (nativeShared) return;

    if (nav.share) {
      try {
        if (!nav.canShare || nav.canShare({ files: [qrFile] })) {
          await nav.share({ files: [qrFile], title: `QR Code ${t("app.invite.shareTitle")}`, text: qrShareText });
          return;
        }
      } catch (error: unknown) {
        if (isAbortError(error)) return;
      }
    }

    const nativeSharePlugin = capacitor?.Plugins?.Share;
    if (nativeSharePlugin?.share) {
      try {
        await nativeSharePlugin.share({
          title: `QR Code ${t("app.invite.shareTitle")}`,
          text: shareText,
          url: link,
          dialogTitle: t("app.invite.shareQrTitle"),
        });
        return;
      } catch (error: unknown) {
        if (isAbortError(error)) return;
      }
    }

    try {
      if (nav.share && nav.canShare?.({ files: [qrFile] })) {
        try {
          await nav.share({ files: [qrFile], title: `QR Code ${t("app.invite.shareTitle")}`, text: qrShareText });
          return;
        } catch (error: unknown) {
          if (isAbortError(error)) return;
        }
      }

      const url = URL.createObjectURL(qrFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(link);
        toast.success(t("app.invite.toastLinkCopiedFallback"));
      } catch {
        toast.error(t("app.invite.toastCantShare"));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("app.invite.dialogTitle")}</DialogTitle>
          <DialogDescription
            dangerouslySetInnerHTML={{ __html: t("app.invite.dialogDesc") }}
          />
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="link">
              <Link2 className="size-4 mr-1.5" /> {t("app.invite.tabLink")}
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="size-4 mr-1.5" /> {t("app.invite.tabQr")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 mt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono break-all">
              {link}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={shareWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="size-4 mr-1.5" /> {t("app.invite.btnWhatsapp")}
              </Button>
              <Button onClick={nativeShare} variant="secondary">
                <Share2 className="size-4 mr-1.5" /> {t("app.invite.btnShare")}
              </Button>
              <Button onClick={copyLink} variant="outline" className="col-span-2">
                <Copy className="size-4 mr-1.5" /> {t("app.invite.btnCopyLink")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              {t("app.invite.userHint", { username: username ?? "usuário" })}
            </p>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3 mt-4">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-md relative min-h-[292px] min-w-[292px] grid place-items-center">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={t("app.invite.qrAlt")}
                    className="size-[260px] max-w-full object-contain"
                  />
                ) : (
                  <div className="grid place-items-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-[260px]">
                {t("app.invite.qrHint")}
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
                <Button onClick={shareQR} size="sm" disabled={!qrUrl} variant="secondary">
                  <Share2 className="size-4 mr-1.5" /> {t("app.invite.btnShare")}
                </Button>
                <Button onClick={downloadQr} size="sm" disabled={!qrUrl}>
                  <Download className="size-4 mr-1.5" /> {t("app.invite.btnSaveImage")}
                </Button>
                <Button onClick={copyQrImage} size="sm" variant="outline" disabled={!qrUrl}>
                  <Copy className="size-4 mr-1.5" /> {t("app.invite.btnCopyImage")}
                </Button>
                <Button onClick={copyQrLink} size="sm" variant="outline">
                  <Link2 className="size-4 mr-1.5" /> {t("app.invite.btnCopyLink")}
                </Button>
              </div>
              <p
                className="text-[11px] text-muted-foreground text-center max-w-[260px]"
                dangerouslySetInnerHTML={{ __html: t("app.invite.qrFooter") }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
