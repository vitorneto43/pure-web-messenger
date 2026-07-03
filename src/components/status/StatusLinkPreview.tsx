import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchLinkPreview, type LinkPreview } from "@/lib/link-preview.functions";
import { getEmbedInfo } from "@/lib/link-embed";

const URL_REGEX = /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/i;

export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_REGEX);
  if (!m) return null;
  const raw = m[0].replace(/[)\].,;:!?]+$/, "");
  const candidate = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}


export function StatusLinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchPreview = useServerFn(fetchLinkPreview);
  const embed = useMemo(() => getEmbedInfo(url), [url]);
  const host = useMemo(() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    // Guard: only call server if URL is actually parseable + http(s)
    let safe: string;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      safe = u.toString();
    } catch {
      return;
    }
    const cacheKey = `lp:${safe}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setPreview(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {}
    fetchPreview({ data: { url: safe } })
      .then((p) => {
        if (cancelled) return;
        setPreview(p);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(p)); } catch {}
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);


  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // Embeddable provider (YouTube, Vimeo, etc.) — render player inline
  if (embed) {
    return (
      <div
        onPointerDown={stop}
        onClick={stop}
        className="mx-auto w-full max-w-sm rounded-2xl overflow-hidden bg-white shadow-xl"
      >
        <div className={`w-full ${embed.aspect} bg-black`}>
          <iframe
            src={embed.src}
            title={embed.title}
            loading="lazy"
            allow={embed.allow}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        </div>
        <a
          href={preview?.url || url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="block p-3 text-left"
        >
          {preview?.title && (
            <div className="text-[15px] font-semibold text-neutral-900 leading-snug line-clamp-2">
              {preview.title}
            </div>
          )}
          {preview?.description && (
            <div className="text-[13px] text-neutral-600 mt-0.5 line-clamp-2">
              {preview.description}
            </div>
          )}
          <div className="text-[12px] text-neutral-500 mt-1.5">
            {preview?.siteName || host}
          </div>
        </a>
      </div>
    );
  }

  if (loading) return null;
  if (!preview || (!preview.title && !preview.image && !preview.description)) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={stop}
      onClick={stop}
      className="mx-auto block w-full max-w-sm rounded-2xl overflow-hidden bg-white shadow-xl hover:opacity-95 transition"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          className="w-full max-h-56 object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="p-3 text-left">
        {preview.title && (
          <div className="text-[15px] font-semibold text-neutral-900 leading-snug line-clamp-2">
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div className="text-[13px] text-neutral-600 mt-0.5 line-clamp-2">
            {preview.description}
          </div>
        )}
        <div className="text-[12px] text-neutral-500 mt-1.5">
          {host}
        </div>
      </div>
    </a>
  );
}
