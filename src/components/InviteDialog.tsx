import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2, QrCode, Link2, Download, MessageCircle, Loader2 } from "lucide-react";
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

async function logInviteAction(userId: string | undefined, target: string) {
  if (!userId) return;
  try {
    await supabase.from("share_logs").insert({
      user_id: userId,
      content_type: "invite",
      target,
    });
  } catch {}
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InviteDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const username = (user?.user_metadata as any)?.username as string | undefined;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const link = username
    ? `${base}/auth?invite=${encodeURIComponent(username)}`
    : `${base}/auth`;
  const shareText = `Vamos conversar no WaveChat! Crie sua conta: ${link}`;

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [tab, setTab] = useState("link");
  const [showFullQR, setShowFullQR] = useState(false);

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
    try {
      if (navigator.share) {
        await navigator.share({ title: "WaveChat", text: shareText, url: link });
        void logInviteAction(user?.id, "native");
        return;
      }
    } catch {}
    copyLink();
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
    const fileName = `wavechat-qr-${username ?? "convite"}.png`;
    void logInviteAction(user?.id, "qr");

    try {
      const blob = await fetch(qrUrl).then((r) => r.blob());
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as any;

      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: "QR Code WaveChat",
            text: shareText,
          });
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return;
        }
      }

      // Fallback web: tenta share só com texto/link, senão baixa
      if (nav.share) {
        try {
          await nav.share({ title: "WaveChat", text: shareText, url: link });
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      toast.error("Não foi possível compartilhar o QR Code");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chamar amigos</DialogTitle>
          <DialogDescription>
            Quanto mais amigos no WaveChat, melhor a experiência. A recompensa só é liberada quando
            seus amigos <strong>criarem a conta</strong> pelo seu link — a cada 3 cadastros confirmados,
            você ganha <strong>100 visualizações grátis</strong> para impulsionar status.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="link"><Link2 className="size-4 mr-1.5" /> Link</TabsTrigger>
            <TabsTrigger value="qr"><QrCode className="size-4 mr-1.5" /> QR Code</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 mt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono break-all">
              {link}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={shareWhatsApp} className="bg-green-600 hover:bg-green-700 text-white">
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
              Seu @{username ?? "usuário"} é o seu nome aqui dentro — quem clicar no link vai cair direto
              numa tela para conversar com você.
            </p>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3 mt-4">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-md relative min-h-[292px] min-w-[292px] grid place-items-center">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code do convite WaveChat" className="size-[260px] max-w-full object-contain" />
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
              <Button onClick={downloadQR} variant="outline" size="sm" disabled={!qrUrl}>
                <Download className="size-4 mr-1.5" /> Baixar QR
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {showFullQR && qrUrl && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center gap-4 p-6"
            onClick={() => setShowFullQR(false)}
          >
            <p className="text-white text-center text-sm max-w-[300px]">
              O download direto não funciona dentro do app. Toque em <strong>"Abrir no navegador"</strong> e use o menu do Chrome para salvar a imagem.
            </p>
            <img
              src={qrUrl}
              alt="QR Code WaveChat"
              className="bg-white p-4 rounded-2xl max-w-[80vw] max-h-[50vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={openQRInBrowser}>
                Abrir no navegador
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowFullQR(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
