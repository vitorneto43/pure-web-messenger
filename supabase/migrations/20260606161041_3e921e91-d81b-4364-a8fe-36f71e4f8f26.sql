CREATE OR REPLACE FUNCTION public.redeem_free_boost(_status_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _reward_id uuid;
  _views int;
  _boost_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT user_id INTO _owner FROM public.statuses WHERE id = _status_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Status not found'; END IF;
  IF _owner <> _uid THEN RAISE EXCEPTION 'Not your status'; END IF;

  SELECT id, views_amount INTO _reward_id, _views
    FROM public.invite_rewards
    WHERE user_id = _uid AND redeemed = false
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

  IF _reward_id IS NULL THEN
    RAISE EXCEPTION 'No free views available';
  END IF;

  INSERT INTO public.status_boosts (
    status_id, user_id, package, views_total, views_remaining,
    amount_cents, currency, status, activated_at, is_free_reward, environment
  ) VALUES (
    _status_id, _uid, 'boost_100', _views, _views,
    0, 'brl', 'active', now(), true, 'production'
  ) RETURNING id INTO _boost_id;

  UPDATE public.invite_rewards
    SET redeemed = true, redeemed_at = now()
    WHERE id = _reward_id;

  -- Mantém o status acessível enquanto o impulso estiver ativo (até 30 dias)
  UPDATE public.statuses
    SET expires_at = GREATEST(expires_at, now() + interval '30 days')
    WHERE id = _status_id;

  RETURN jsonb_build_object('boost_id', _boost_id, 'views', _views);
END;
$function$;