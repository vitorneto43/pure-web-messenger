import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://webconnectchat.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/descobrir", changefreq: "daily", priority: "0.9" },
          { path: "/posts", changefreq: "hourly", priority: "0.9" },
          { path: "/live", changefreq: "hourly", priority: "0.9" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/guide", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/support", changefreq: "monthly", priority: "0.5" },
          { path: "/diretrizes", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        // Dynamic: public profiles + public posts
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [profiles, posts] = await Promise.all([
            supabaseAdmin
              .from("profiles")
              .select("username, updated_at, last_seen")
              .eq("visibility", "public")
              .is("banned_at", null)
              .not("username", "is", null)
              .order("last_seen", { ascending: false })
              .limit(5000),
            supabaseAdmin
              .from("posts")
              .select("id, updated_at, created_at")
              .eq("visibility", "public")
              .order("created_at", { ascending: false })
              .limit(5000),
          ]);
          for (const p of profiles.data ?? []) {
            if (!p.username) continue;
            entries.push({
              path: `/u/${p.username}`,
              lastmod: (p.updated_at ?? p.last_seen ?? undefined) as string | undefined,
              changefreq: "weekly",
              priority: "0.7",
            });
          }
          for (const p of posts.data ?? []) {
            entries.push({
              path: `/p/${p.id}`,
              lastmod: (p.updated_at ?? p.created_at ?? undefined) as string | undefined,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch (err) {
          console.error("sitemap dynamic entries failed", err);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
