import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server functions públicas (sem auth) para a página /descobrir.
// Usam supabaseAdmin internamente mas projetam APENAS colunas seguras
// e filtram por visibility='public' para evitar vazar perfis privados.

const limitSchema = z.object({
  limit: z.number().int().min(1).max(50).default(24),
});

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

export const getRecommendedProfilesPublic = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => limitSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ profiles: PublicProfile[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, last_seen, visibility")
      .eq("visibility", "public")
      .order("last_seen", { ascending: false })
      .limit(data.limit);
    if (error) {
      console.error("getRecommendedProfilesPublic", error);
      return { profiles: [] };
    }
    const profiles: PublicProfile[] = (rows ?? []).map((r) => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      bio: r.bio,
    }));
    return { profiles };
  });

export type PublicStats = {
  total_members: number;
  online_now: number;
  live_now: number;
  posts_today: number;
};

export const getPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [members, online, lives, posts] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("visibility", "public"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen", fiveMinAgo),
      supabaseAdmin.from("live_sessions").select("id", { count: "exact", head: true }).eq("status", "live"),
      supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    ]);

    return {
      total_members: members.count ?? 0,
      online_now: online.count ?? 0,
      live_now: lives.count ?? 0,
      posts_today: posts.count ?? 0,
    };
  },
);

