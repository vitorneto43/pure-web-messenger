
CREATE TABLE public.push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sender_id uuid,
  recipient_id uuid NOT NULL,
  conversation_id uuid,
  channel text NOT NULL CHECK (channel IN ('web','native')),
  kind text NOT NULL DEFAULT 'message',
  success boolean NOT NULL DEFAULT false,
  status_code int,
  error text,
  endpoint text,
  user_agent text
);
GRANT SELECT ON public.push_logs TO authenticated;
GRANT ALL ON public.push_logs TO service_role;
ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view push logs" ON public.push_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE INDEX idx_push_logs_created_at ON public.push_logs (created_at DESC);
CREATE INDEX idx_push_logs_recipient ON public.push_logs (recipient_id);

CREATE OR REPLACE FUNCTION public.admin_push_logs(_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - (_days || ' days')::interval;
  _total int; _success int; _failed int;
  _by_channel jsonb; _recent jsonb; _series jsonb;
BEGIN
  SELECT COUNT(*) INTO _total FROM public.push_logs WHERE created_at >= _since;
  SELECT COUNT(*) INTO _success FROM public.push_logs WHERE created_at >= _since AND success;
  SELECT COUNT(*) INTO _failed FROM public.push_logs WHERE created_at >= _since AND NOT success;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _by_channel FROM (
    SELECT channel, kind,
      COUNT(*) FILTER (WHERE success)::int AS success,
      COUNT(*) FILTER (WHERE NOT success)::int AS failed
    FROM public.push_logs WHERE created_at >= _since
    GROUP BY channel, kind ORDER BY channel, kind
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _recent FROM (
    SELECT l.id, l.created_at, l.channel, l.kind, l.success, l.status_code, l.error,
           l.recipient_id, l.sender_id, l.conversation_id,
           pr.username AS recipient_username, pr.display_name AS recipient_name,
           ps.username AS sender_username, ps.display_name AS sender_name
    FROM public.push_logs l
    LEFT JOIN public.profiles pr ON pr.id = l.recipient_id
    LEFT JOIN public.profiles ps ON ps.id = l.sender_id
    WHERE l.created_at >= _since
    ORDER BY l.created_at DESC LIMIT 200
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _series FROM (
    SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS date,
           COUNT(*) FILTER (WHERE success)::int AS success,
           COUNT(*) FILTER (WHERE NOT success)::int AS failed
    FROM public.push_logs WHERE created_at >= _since
    GROUP BY 1 ORDER BY 1
  ) t;

  RETURN jsonb_build_object(
    'total', _total, 'success', _success, 'failed', _failed,
    'byChannel', _by_channel, 'recent', _recent, 'series', _series, 'days', _days
  );
END; $$;
