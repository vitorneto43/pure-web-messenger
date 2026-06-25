import { Capacitor } from "@capacitor/core";

export const INVITER_KEY = "wc_invited_by";
export const CHANNEL_KEY = "wc_invite_channel";
export const CLICK_KEY = "wc_invite_click";

export type InviteChannel =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "kwai"
  | "share"
  | "copy"
  | "other";

export function buildInviteUrl(userId: string, channel: InviteChannel = "share") {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://webconnectchat.com";
  return `${origin}/invite/${userId}?c=${channel}`;
}

export function inviteMessage(url: string) {
  return `Conheça a WaveChat, a rede social brasileira com chats, grupos, posts, stories, lives e chamadas de voz e vídeo. Entre através do meu convite: ${url}`;
}

function openExternal(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function shareInvite(userId: string, channel: InviteChannel) {
  const url = buildInviteUrl(userId, channel);
  const text = inviteMessage(url);

  switch (channel) {
    case "whatsapp":
      openExternal(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
      return { ok: true };
    case "facebook":
      openExternal(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
      );
      return { ok: true };
    case "instagram":
      // Instagram não permite share por URL — copia o texto e abre o app
      try {
        await navigator.clipboard.writeText(text);
      } catch {}
      openExternal("https://www.instagram.com/");
      return { ok: true, copied: true };
    case "tiktok":
      try {
        await navigator.clipboard.writeText(text);
      } catch {}
      openExternal("https://www.tiktok.com/");
      return { ok: true, copied: true };
    case "kwai":
      try {
        await navigator.clipboard.writeText(text);
      } catch {}
      openExternal("https://www.kwai.com/");
      return { ok: true, copied: true };
    case "copy":
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
      return { ok: true, copied: true };
    case "share":
    default: {
      // Native first
      try {
        if (Capacitor.isNativePlatform()) {
          const mod: any = await import("@capacitor/share").catch(() => null);
          if (mod?.Share?.share) {
            await mod.Share.share({ title: "WaveChat", text, url, dialogTitle: "Convidar amigos" });
            return { ok: true };
          }
        }
      } catch {}
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        try {
          await (navigator as any).share({ title: "WaveChat", text, url });
          return { ok: true };
        } catch {}
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
      return { ok: true, copied: true };
    }
  }
}

export function readPendingInviter(): { inviterId: string; channel?: string; clickId?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const inviterId = localStorage.getItem(INVITER_KEY);
    if (!inviterId) return null;
    return {
      inviterId,
      channel: localStorage.getItem(CHANNEL_KEY) ?? undefined,
      clickId: localStorage.getItem(CLICK_KEY) ?? undefined,
    };
  } catch {
    return null;
  }
}

export function clearPendingInviter() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(INVITER_KEY);
    localStorage.removeItem(CHANNEL_KEY);
    localStorage.removeItem(CLICK_KEY);
  } catch {}
}
