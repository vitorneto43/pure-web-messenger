import { toast } from "sonner";

export interface ShareableMessage {
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
}

async function tryCapacitorShare(msg: ShareableMessage): Promise<boolean> {
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

async function tryShareFile(msg: ShareableMessage): Promise<boolean> {
  if (!msg.attachment_url) return false;
  try {
    const nav = navigator as any;
    if (!nav.canShare || !nav.share) return false;
    const res = await fetch(msg.attachment_url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const name =
      msg.attachment_name ||
      msg.attachment_url.split("/").pop()?.split("?")[0] ||
      "arquivo";
    const file = new File([blob], name, {
      type: msg.attachment_type || blob.type || "application/octet-stream",
    });
    if (!nav.canShare({ files: [file] })) return false;
    await nav.share({
      files: [file],
      text: msg.content ?? undefined,
      title: "WaveChat",
    });
    return true;
  } catch (e: any) {
    if (e?.name === "AbortError") return true;
    return false;
  }
}

export async function shareMessageExternally(msg: ShareableMessage) {
  // 1) Native (Capacitor) share — opens system share sheet on Android/iOS
  if (await tryCapacitorShare(msg)) return;

  // 2) Web Share API with file (mobile browsers)
  if (msg.attachment_url) {
    const ok = await tryShareFile(msg);
    if (ok) return;
  }

  // 3) Web Share API with text + URL (no clipboard fallback for files)
  const text = msg.content?.trim() ?? "";
  const url = msg.attachment_url ?? undefined;
  const nav = navigator as any;
  if (nav.share) {
    try {
      await nav.share({ title: "WaveChat", text: text || undefined, url });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  // 4) Desktop last resort
  const payload = [text, url].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(payload || "");
    toast.success("Copiado — cole no app desejado");
  } catch {
    toast.error("Não foi possível compartilhar neste dispositivo");
  }
}
