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

export const fetchLinkPreview = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }): Promise<LinkPreview> => {
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

      return {
        url: finalUrl,
        title: title?.trim().slice(0, 200),
        description: description?.trim().slice(0, 300),
        image,
        siteName,
      };
    } catch {
      return { url: data.url };
    } finally {
      clearTimeout(timeout);
    }
  });
