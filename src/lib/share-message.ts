import { toast } from "sonner";
import { watermarkImage } from "./watermark";

export interface ShareableMessage {
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  /** When true, image attachments will be watermarked with the WaveChat brand badge. */
  brandWatermark?: boolean;
}

function isImage(type: string | null | undefined, url: string | null | undefined) {
  if (type && type.startsWith("image/")) return true;
  if (!url) return false;
  return /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(url);
}

function isVideo(type: string | null | undefined, url: string | null | undefined) {
  if (type && type.startsWith("video/")) return true;
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

function pickName(msg: ShareableMessage, ext?: string) {
  const base =
    msg.attachment_name ||
    msg.attachment_url?.split("/").pop()?.split("?")[0] ||
    "wavechat-arquivo";
  if (!ext) return base;
  return base.replace(/\.[^.]+$/, "") + "." + ext;
}

async function fetchAsFile(msg: ShareableMessage): Promise<File | null> {
  if (!msg.attachment_url) return null;
  try {
    const res = await fetch(msg.attachment_url);
    if (!res.ok) return null;
    let blob = await res.blob();
    let type = msg.attachment_type || blob.type || "application/octet-stream";
    let name = pickName(msg);

    if (msg.brandWatermark && isImage(type, msg.attachment_url)) {
      const stamped = await watermarkImage(blob);
      blob = stamped;
      type = "image/jpeg";
      name = pickName(msg, "jpg");
    }
    return new File([blob], name, { type });
  } catch {
    return null;
  }
}

async function tryWebShareFile(file: File, text?: string): Promise<boolean> {
  try {
    const nav = navigator as any;
    if (!nav.share || !nav.canShare) return false;
    if (!nav.canShare({ files: [file] })) return false;
    await nav.share({ files: [file], text: text || undefined, title: "WaveChat" });
    return true;
  } catch (e: any) {
    if (e?.name === "AbortError") return true;
    return false;
  }
}

async function tryCapacitorFileShare(file: File, text?: string): Promise<boolean> {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return false;
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const r = String(reader.result || "");
        const i = r.indexOf(",");
        resolve(i >= 0 ? r.slice(i + 1) : r);
      };
      reader.readAsDataURL(file);
    });
    const path = `share-${Date.now()}-${file.name}`;
    const written = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: "WaveChat",
      text: text || undefined,
      url: written.uri,
      dialogTitle: "Compartilhar",
    });
    return true;
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("cancel")) return true;
    return false;
  }
}

async function tryCapacitorTextShare(msg: ShareableMessage): Promise<boolean> {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return false;
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: "WaveChat",
      text: msg.content ?? undefined,
      url: msg.attachment_url ?? undefined,
      dialogTitle: "Compartilhar",
    });
    return true;
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("cancel")) return true;
    return false;
  }
}

export async function shareMessageExternally(msg: ShareableMessage) {
  const text = msg.content?.trim() ?? "";
  const brandedText = msg.brandWatermark
    ? [text, "— Compartilhado pelo WaveChat"].filter(Boolean).join("\n")
    : text;

  // If we have a media attachment, share the FILE itself (not a link)
  if (msg.attachment_url && (isImage(msg.attachment_type, msg.attachment_url) || isVideo(msg.attachment_type, msg.attachment_url) || msg.attachment_type)) {
    const file = await fetchAsFile(msg);
    if (file) {
      // Web Share API with files works in modern Android WebView too
      if (await tryWebShareFile(file, brandedText)) return;
      // Native fallback: write to cache and share via Capacitor
      if (await tryCapacitorFileShare(file, brandedText)) return;
    }
  }

  // Text-only message: Capacitor native share
  if (!msg.attachment_url) {
    if (await tryCapacitorTextShare(msg)) return;
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title: "WaveChat", text: brandedText || undefined });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
  }

  // Last resort
  try {
    await navigator.clipboard.writeText([brandedText, msg.attachment_url].filter(Boolean).join("\n"));
    toast.success("Copiado — cole no app desejado");
  } catch {
    toast.error("Não foi possível compartilhar neste dispositivo");
  }
}
