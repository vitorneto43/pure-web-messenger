import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2, QrCode, Link2, MessageCircle, Loader2 } from "lucide-react";
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
  const { user } = useAuth();
  const username = (user?.user_metadata as UserMetadata | undefined)?.username;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const link = username ? `${base}/auth?invite=${encodeURIComponent(username)}` : `${base}/auth`;
  const shareText = `Vamos conversar no WaveChat! Crie sua conta: ${link}`;
  const qrShareText = "Convite WaveChat";

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
      .catch(() => toast.error("Falha ao gerar QR Code"));
    return () => {
      cancelled = true;
    };
  }, [open, tab, link]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      void logInviteAction(user?.id, "copy");
      toast.success("Link copiado!");
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  async function nativeShare() {
    void logInviteAction(user?.id, "native");
    try {
      const nativeSharePlugin = getCapacitor()?.Plugins?.Share;
      if (nativeSharePlugin?.share) {
        await nativeSharePlugin.share({
          title: "WaveChat",
          text: shareText,
          url: link,
          dialogTitle: "Compartilhar",
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({ title: "WaveChat", text: shareText, url: link });
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
      toast.error("Aguarde o QR Code carregar");
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
        toast.success("QR copiado — cole em qualquer app");
        return;
      }
      throw new Error("clipboard-image-unsupported");
    } catch {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Imagem não suportada — link copiado");
      } catch {
        toast.error("Não foi possível copiar");
      }
    }
  }

  async function copyQrLink() {
    try {
      await navigator.clipboard.writeText(link);
      void logInviteAction(user?.id, "qr-link-copy");
      toast.success("Link copiado — cole onde quiser");
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    void logInviteAction(user?.id, "whatsapp");
    window.open(url, "_blank", "noopener");
  }

  async function shareQR() {
    if (!qrUrl) {
      toast.error("Aguarde o QR Code carregar");
      return;
    }
    void logInviteAction(user?.id, "qr");

    const nav = navigator;
    const capacitor = getCapacitor();
    const fileName = `wavechat-qr-${username ?? "convite"}.png`;
    const qrFile = dataUrlToFile(qrUrl, fileName);

    // Primeiro tenta compartilhar o ARQUIVO PNG do QR Code. No app isso precisa
    // acontecer direto no clique, antes de qualquer fallback de texto/link.
    if (nav.share) {
      try {
        if (!nav.canShare || nav.canShare({ files: [qrFile] })) {
          await nav.share({ files: [qrFile], title: "QR Code WaveChat", text: qrShareText });
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
          title: "QR Code WaveChat",
          text: shareText,
          url: link,
          dialogTitle: "Compartilhar QR",
        });
        return;
      } catch (error: unknown) {
        if (isAbortError(error)) return;
      }
    }

    // Web/desktop: tenta compartilhar o PNG do QR
    try {
      if (nav.share && nav.canShare?.({ files: [qrFile] })) {
        try {
          await nav.share({ files: [qrFile], title: "QR Code WaveChat", text: qrShareText });
          return;
        } catch (error: unknown) {
          if (isAbortError(error)) return;
        }
      }

      // Último recurso (desktop): baixa o PNG
      const url = URL.createObjectURL(qrFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      // Fallback final: copia o link
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copiado — cole onde quiser compartilhar");
      } catch {
        toast.error("Não foi possível compartilhar");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chamar amigos</DialogTitle>
          <DialogDescription>
            Quanto mais amigos no WaveChat, melhor a experiência. A recompensa só é liberada quando
            seus amigos <strong>criarem a conta</strong> pelo seu link — a cada 3 cadastros
            confirmados, você ganha <strong>100 visualizações grátis</strong> para impulsionar
            status.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="link">
              <Link2 className="size-4 mr-1.5" /> Link
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="size-4 mr-1.5" /> QR Code
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
                <MessageCircle className="size-4 mr-1.5" /> WhatsApp
              </Button>
              <Button onClick={nativeShare} variant="secondary">
                <Share2 className="size-4 mr-1.5" /> Compartilhar
              </Button>
              <Button onClick={copyLink} variant="outline" className="col-span-2">
                <Copy className="size-4 mr-1.5" /> Copiar link
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Seu @{username ?? "usuário"} é o seu nome aqui dentro — quem clicar no link vai cair
              direto numa tela para conversar com você.
            </p>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3 mt-4">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-md relative min-h-[292px] min-w-[292px] grid place-items-center">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="QR Code do convite WaveChat"
                    className="size-[260px] max-w-full object-contain"
                  />
                ) : (
                  <div className="grid place-items-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-[260px]">
                Peça para a pessoa apontar a câmera do celular para este QR — ela cai direto numa
                conversa com você.
              </p>
              <Button onClick={shareQR} size="sm" disabled={!qrUrl}>
                <Share2 className="size-4 mr-1.5" /> Compartilhar QR
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
