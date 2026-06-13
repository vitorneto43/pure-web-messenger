
REVOKE EXECUTE ON FUNCTION public.recompute_ip_risk(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_device_risk(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_device_seen(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_ip_seen(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propagate_severe_ban(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_ban(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_account_rate_limit(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.check_account_rate_limit(uuid, text) TO authenticated;
