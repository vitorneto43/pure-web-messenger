import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna true se os dois usuários se seguem mutuamente.
 * Requisito de produto: chats 1:1 só podem ser abertos/usados se ambos se seguirem.
 */
export async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false;
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_id, following_id")
    .or(
      `and(follower_id.eq.${userA},following_id.eq.${userB}),and(follower_id.eq.${userB},following_id.eq.${userA})`,
    );
  if (error) return false;
  const aFollowsB = (data ?? []).some(
    (r: any) => r.follower_id === userA && r.following_id === userB,
  );
  const bFollowsA = (data ?? []).some(
    (r: any) => r.follower_id === userB && r.following_id === userA,
  );
  return aFollowsB && bFollowsA;
}

export const MUTUAL_FOLLOW_MESSAGE =
  "Vocês só podem conversar se ambos se seguirem. Siga essa pessoa e peça que ela também te siga.";
