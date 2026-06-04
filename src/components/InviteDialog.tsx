import { useEffect, useRef, useState } from "react";
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

  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [tab, setTab] = useState("link");

  useEffect(() => {
    if (!open || tab !== "qr") return;
    const canvas = canvasEl.current;
    if (!canvas) return;
    setQrReady(false);
    QRCode.toCanvas(canvas, link, {
      width: 260,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(() => setQrReady(true))
      .catch(() => toast.error("Falha ao gerar QR Code"));
  }, [open, tab, link]);




  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  async function nativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "WaveChat", text: shareText, url: link });
        return;
      }
    } catch {}
    copyLink();
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener");
  }

  function downloadQR() {
    if (!canvasEl.current) return;
    const url = canvasEl.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `wavechat-qr-${username ?? "convite"}.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chamar amigos</DialogTitle>
          <DialogDescription>
            Quanto mais amigos no WaveChat, melhor a experiência. A cada 3 amigos que entrarem pelo
            seu convite, você ganha <strong>100 visualizações grátis</strong> para impulsionar status.
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
              <div className="rounded-2xl bg-white p-4 shadow-md relative">
                <canvas ref={canvasEl} className="block" />
                {!qrReady && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-[260px]">
                Peça para a pessoa apontar a câmera do celular para este QR — ela cai direto numa
                conversa com você.
              </p>
              <Button onClick={downloadQR} variant="outline" size="sm">
                <Download className="size-4 mr-1.5" /> Baixar QR
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
