-- Ensure Stories themselves are readable by everyone while they are active.
GRANT SELECT ON public.statuses TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read non-expired statuses" ON public.statuses;
CREATE POLICY "Anyone can read non-expired statuses"
ON public.statuses
FOR SELECT
TO anon, authenticated
USING (expires_at > now());

-- Older app bundles call these RPCs directly; make both available without requiring a new app version.
GRANT EXECUTE ON FUNCTION public.discover_public_statuses(integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_status_profile_cards(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_status_profile_cards(_user_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND p.banned_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.statuses s
      WHERE s.user_id = p.id
        AND s.expires_at > now()
    );
$function$;

-- Some installed app versions fetch profile cards directly instead of using the RPC.
-- Grant only the non-sensitive public columns needed to render Story avatars/names.
GRANT SELECT (id, username, display_name, avatar_url, show_city, banned_at) ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Story author profile cards visible publicly" ON public.profiles;
CREATE POLICY "Story author profile cards visible publicly"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  banned_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.statuses s
    WHERE s.user_id = profiles.id
      AND s.expires_at > now()
  )
);