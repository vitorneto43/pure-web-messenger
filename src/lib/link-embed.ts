// Returns an embeddable iframe URL + aspect ratio for known providers.
export interface EmbedInfo {
  src: string;
  aspect: string; // tailwind aspect class e.g. "aspect-video"
  allow?: string;
  title: string;
  sandbox?: string;
}

export function getEmbedInfo(rawUrl: string): EmbedInfo | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname;

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return yt(v, u.searchParams.get("t"));
    const shortsMatch = path.match(/^\/shorts\/([\w-]{6,})/);
    if (shortsMatch) return { ...yt(shortsMatch[1], null), aspect: "aspect-[9/16]" };
    const embedMatch = path.match(/^\/embed\/([\w-]{6,})/);
    if (embedMatch) return yt(embedMatch[1], null);
  }
  if (host === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    if (id) return yt(id, u.searchParams.get("t"));
  }

  // Vimeo
  if (host === "vimeo.com") {
    const id = path.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return {
        src: `https://player.vimeo.com/video/${id}`,
        aspect: "aspect-video",
        allow: "autoplay; fullscreen; picture-in-picture",
        title: "Vimeo player",
      };
    }
  }

  // TikTok
  const tiktok = path.match(/\/video\/(\d+)/);
  if ((host === "tiktok.com" || host.endsWith(".tiktok.com")) && tiktok) {
    return {
      src: `https://www.tiktok.com/embed/v2/${tiktok[1]}`,
      aspect: "aspect-[9/16]",
      title: "TikTok video",
    };
  }

  // Twitter / X — use platform embed via publish.twitter.com fallback (no JS).
  if (host === "twitter.com" || host === "x.com" || host === "mobile.twitter.com") {
    const m = path.match(/^\/[^/]+\/status\/(\d+)/);
    if (m) {
      return {
        src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark`,
        aspect: "aspect-[4/5]",
        title: "Post",
      };
    }
  }

  // Instagram (post/reel)
  if (host === "instagram.com") {
    const m = path.match(/^\/(p|reel|tv)\/([\w-]+)/);
    if (m) {
      return {
        src: `https://www.instagram.com/${m[1]}/${m[2]}/embed`,
        aspect: "aspect-[4/5]",
        title: "Instagram",
      };
    }
  }

  // Facebook: o iframe plugins.facebook.com costuma ser bloqueado por
  // X-Frame-Options/CSP em apps de terceiros ("conexão recusada").
  // Em vez disso, deixamos cair no card de preview tradicional (OG tags),
  // que mostra imagem, título e descrição do post/vídeo.

  // Spotify
  if (host === "open.spotify.com") {
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return {
        src: `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`,
        aspect: "aspect-[5/2]",
        allow: "encrypted-media",
        title: "Spotify",
      };
    }
  }

  // SoundCloud
  if (host === "soundcloud.com") {
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(rawUrl)}&color=%23ff5500`,
      aspect: "aspect-[5/2]",
      title: "SoundCloud",
    };
  }

  return null;
}

function yt(id: string, t: string | null): EmbedInfo {
  const start = t ? `?start=${parseTime(t)}` : "";
  return {
    src: `https://www.youtube-nocookie.com/embed/${id}${start}`,
    aspect: "aspect-video",
    allow:
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    title: "YouTube video player",
  };
}

function parseTime(t: string): number {
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2] || "0", 10) * 60) + parseInt(m[3] || "0", 10);
}
