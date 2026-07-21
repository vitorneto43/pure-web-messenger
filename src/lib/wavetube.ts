import { supabase } from "@/integrations/supabase/client";

export const WAVETUBE_CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "musica", label: "Música" },
  { value: "jogos", label: "Jogos" },
  { value: "educacao", label: "Educação" },
  { value: "comedia", label: "Comédia" },
  { value: "noticias", label: "Notícias" },
  { value: "esportes", label: "Esportes" },
  { value: "vlogs", label: "Vlogs" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "financas", label: "Finanças" },
  { value: "culinaria", label: "Culinária" },
  { value: "moda", label: "Moda & Beleza" },
  { value: "arte", label: "Arte" },
  { value: "religiao", label: "Religião" },
  { value: "outros", label: "Outros" },
];

export function formatDuration(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

export function formatViews(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

/** Sign a wavetube storage path for playback (24h). Accepts path or full URL. */
export async function signWavetubeUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const { data, error } = await supabase.storage.from("wavetube").createSignedUrl(pathOrUrl, 60 * 60 * 24);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Capture a JPEG thumbnail from a local video File at ~25% of duration. */
export async function captureVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      video.onloadedmetadata = () => {
        const target = Math.min(video.duration * 0.25, 5);
        video.currentTime = isFinite(target) ? target : 0;
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        const w = Math.min(video.videoWidth || 1280, 1280);
        const ratio = (video.videoHeight || 720) / (video.videoWidth || 1280);
        canvas.width = w;
        canvas.height = Math.round(w * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url);
          resolve(b);
        }, "image/jpeg", 0.85);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(video.duration || 0));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}
