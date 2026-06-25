import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { buildInviteUrl, inviteMessage, shareInvite, type InviteChannel } from "@/lib/share-invite";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/track";

type Props = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const CHANNELS: Array<{ key: InviteChannel; label: string; bg: string; emoji: string }> = [
  { key: "whatsapp", label: "WhatsApp", bg: "bg-[#25D366] text-white hover:bg-[#1ebe5a]", emoji: "🟢" },
  { key: "facebook", label: "Facebook", bg: "bg-[#1877F2] text-white hover:bg-[#1366d6]", emoji: "📘" },
  { key: "instagram", label: "Instagram", bg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white", emoji: "📸" },
  { key: "tiktok", label: "TikTok", bg: "bg-black text-white hover:bg-zinc-800", emoji: "🎵" },
  { key: "kwai", label: "Kwai", bg: "bg-[#FF6E00] text-white hover:bg-[#e66400]", emoji: "🟧" },
  { key: "share", label: "Compartilhar", bg: "bg-primary text-primary-foreground", emoji: "📤" },
];

export function InviteFriendsSheet({ trigger, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const url = user ? buildInviteUrl(user.id, "copy") : "";

  async function handleShare(channel: InviteChannel) {
    if (!user) {
      toast.error("Faça login para convidar amigos");
      return;
    }
    await shareInvite(user.id, channel);
    void track("invite_sent", { channel, inviter_id: user.id });
    if (channel === "instagram" || channel === "tiktok" || channel === "kwai") {
      toast.success(`Mensagem copiada — cole no ${channel}`);
    } else if (channel === "share") {
      toast.success("Compartilhamento aberto");
    }
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
      void track("invite_sent", { channel: "copy", inviter_id: user?.id });
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function copyMessage() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(inviteMessage(url));
      toast.success("Mensagem copiada");
    } catch {}
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">👥 Convidar amigos</SheetTitle>
        </SheetHeader>

        {!user ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Entre na sua conta para gerar seu link de convite exclusivo.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Seu link exclusivo</p>
              <div className="flex gap-2">
                <Input readOnly value={url} className="font-mono text-xs" />
                <Button size="icon" variant="secondary" onClick={copyLink} aria-label="Copiar link">
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => handleShare(c.key)}
                  className={`h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition ${c.bg}`}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copyMessage}>
                <LinkIcon className="size-4 mr-2" /> Copiar mensagem
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => handleShare("share")}>
                <Share2 className="size-4 mr-2" /> Outro app
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Convide 1, 5, 10, 25, 50, 100+ amigos e ganhe o selo 🏅 Embaixador WaveChat.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
