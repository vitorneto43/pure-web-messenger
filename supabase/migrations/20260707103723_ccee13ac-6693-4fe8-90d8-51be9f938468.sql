CREATE OR REPLACE FUNCTION public.get_status_profile_cards(_user_ids uuid[])
 RETURNS TABLE(id uuid, display_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND p.banned_at IS NULL;
$function$;