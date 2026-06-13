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
