// Download helper that works on web AND inside the Capacitor Android app.
// On native, browsers ignore the `download` attribute and there's no
// "Downloads" UI for blob URLs, so we write the file to the device via
// @capacitor/filesystem and then open a share sheet so the user can save it
// to Photos, Files, WhatsApp, etc.
import { toast } from "sonner";

function isImage(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)(\?|$)/i.test(url);
}

function getMimeFromName(fileName: string, fallback = "application/octet-stream") {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return fallback;
}

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const r = String(reader.result || "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.readAsDataURL(blob);
  });
}

async function downloadOnNative(url: string, fileName: string): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const mime = blob.type || getMimeFromName(fileName);
    const dataUrl = `data:${mime};base64,${await blobToBase64(blob)}`;

    // Status media should be saved directly to the Android gallery.
    if (isImage(url) || mime.startsWith("image/") || mime.startsWith("video/")) {
      const { saveNativeMediaToGallery } = await import("@/integrations/native-call");
      const ok = await saveNativeMediaToGallery(dataUrl, fileName);
      if (ok) {
        toast.success(mime.startsWith("video/") ? "Vídeo salvo na galeria" : "Salvo na galeria");
        return true;
      }
    }

    // Anything else (video/audio/doc): write to cache and open the share sheet
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({
      path: `downloads/${Date.now()}-${fileName}`,
      data: dataUrl.slice(dataUrl.indexOf(",") + 1),
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({
        title: fileName,
        url: written.uri,
        dialogTitle: "Salvar ou compartilhar",
      });
      return true;
    } catch (e: any) {
      if (e?.message?.toLowerCase?.().includes("cancel")) return true;
      throw e;
    }
  } catch (e) {
    console.warn("[download] native failed", e);
    return false;
  }
}

// Force-download a remote file by fetching it as a blob and triggering
// a synthetic anchor click. Works around browsers that ignore the
// `download` attribute on cross-origin URLs (Supabase storage, etc).
export async function downloadFile(url: string, fileName?: string) {
  const name = fileName || guessName(url);

  if (await isNative()) {
    if (await downloadOnNative(url, name)) return;
    // fall through to web fallback only if native path completely failed
  }

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
  } catch {
    // Fallback: open in new tab so user can save manually
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function guessName(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "arquivo";
    return decodeURIComponent(last);
  } catch {
    return "arquivo";
  }
}
