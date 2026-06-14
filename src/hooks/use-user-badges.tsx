import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tier: number;
  display_priority: number;
  awarded_at: string;
}

export function useUserBadges(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-badges", userId],
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<UserBadge[]> => {
      if (!userId) return [];
      const { data, error } = await (supabase as any).rpc("get_user_badges", { _user_id: userId });
      if (error) throw error;
      return (data as UserBadge[]) ?? [];
    },
  });
}
