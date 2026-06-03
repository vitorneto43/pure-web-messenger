REVOKE EXECUTE ON FUNCTION public.is_wavechat_official_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_wavechat_official_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_status_profile_cards(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_status_profile_cards(uuid[]) TO authenticated;