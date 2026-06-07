import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  video?: string;
  videoType?: string;
  videoWidth?: number;
  videoHeight?: number;
}


function pickMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i"
    );
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      "i"
    );
    const m2 = html.match(re2);
    if (m2) return decodeEntities(m2[1]);
  }
  return undefined;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function absUrl(maybe: string | undefined, base: string) {
  if (!maybe) return undefined;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return undefined;
  }
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "metadata.google.internal") return true;
  // IPv4 literal
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
  }
  // IPv6 literal (very conservative)
  if (h.includes(":")) {
    if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::") return true;
  }
  return false;
}

export const fetchLinkPreview = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }): Promise<LinkPreview> => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(data.url);
    } catch {
      return { url: data.url };
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { url: data.url };
    }
    if (isBlockedHost(parsedUrl.hostname)) {
      return { url: data.url };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(data.url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; WaveChatBot/1.0; +https://webconnectchat.com)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("text/html")) {
        return { url: data.url };
      }
      // Read at most ~256KB
      const reader = res.body?.getReader();
      let html = "";
      if (reader) {
        const dec = new TextDecoder("utf-8");
        let total = 0;
        while (total < 262_144) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          html += dec.decode(value, { stream: true });
          if (html.includes("</head>")) break;
        }
        try { await reader.cancel(); } catch {}
      } else {
        html = await res.text();
      }
      const finalUrl = res.url || data.url;
      const title =
        pickMeta(html, ["og:title", "twitter:title"]) ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
      const description = pickMeta(html, [
        "og:description",
        "twitter:description",
        "description",
      ]);
      const image = absUrl(
        pickMeta(html, ["og:image", "og:image:url", "twitter:image"]),
        finalUrl
      );
      const siteName =
        pickMeta(html, ["og:site_name"]) || new URL(finalUrl).hostname;
      const video = absUrl(
        pickMeta(html, ["og:video:secure_url", "og:video:url", "og:video", "twitter:player"]),
        finalUrl
      );
      const videoType = pickMeta(html, ["og:video:type", "twitter:player:stream:content_type"]);
      const vw = pickMeta(html, ["og:video:width", "twitter:player:width"]);
      const vh = pickMeta(html, ["og:video:height", "twitter:player:height"]);

      return {
        url: finalUrl,
        title: title?.trim().slice(0, 200),
        description: description?.trim().slice(0, 300),
        image,
        siteName,
        video,
        videoType,
        videoWidth: vw ? parseInt(vw, 10) || undefined : undefined,
        videoHeight: vh ? parseInt(vh, 10) || undefined : undefined,
      };

    } catch {
      return { url: data.url };
    } finally {
      clearTimeout(timeout);
    }
  });
