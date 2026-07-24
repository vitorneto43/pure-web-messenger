GRANT EXECUTE ON FUNCTION public.is_ecosystem_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ecosystem_admin(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ecosystem_role(uuid, uuid) TO anon, authenticated;