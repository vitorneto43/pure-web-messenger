CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  event_name text NOT NULL,
  path text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert events" ON public.analytics_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins view events" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_analytics_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_name_created ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX idx_analytics_events_session ON public.analytics_events (session_id);

CREATE OR REPLACE FUNCTION public.admin_usage_analytics(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _since timestamptz := now() - (_days || ' days')::interval;
  _total_events int;
  _unique_sessions int;
  _page_views int;
  _by_event jsonb;
  _by_path jsonb;
  _funnel jsonb;
  _series jsonb;
  _visits_total int;
  _signup_clicks int;
  _signup_completed int;
  _help_clicks int;
  _login_clicks int;
BEGIN
  SELECT COUNT(*) INTO _total_events FROM public.analytics_events WHERE created_at >= _since;
  SELECT COUNT(DISTINCT session_id) INTO _unique_sessions FROM public.analytics_events WHERE created_at >= _since AND session_id IS NOT NULL;
  SELECT COUNT(*) INTO _page_views FROM public.analytics_events WHERE created_at >= _since AND event_name = 'page_view';
  SELECT COUNT(DISTINCT session_id) INTO _visits_total FROM public.analytics_events WHERE created_at >= _since AND event_name = 'page_view';
  SELECT COUNT(*) INTO _signup_clicks FROM public.analytics_events WHERE created_at >= _since AND event_name = 'signup_click';
  SELECT COUNT(*) INTO _signup_completed FROM public.analytics_events WHERE created_at >= _since AND event_name = 'signup_completed';
  SELECT COUNT(*) INTO _help_clicks FROM public.analytics_events WHERE created_at >= _since AND event_name = 'help_click';
  SELECT COUNT(*) INTO _login_clicks FROM public.analytics_events WHERE created_at >= _since AND event_name = 'login_click';

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_event FROM (
    SELECT event_name AS name, COUNT(*)::int AS count
    FROM public.analytics_events WHERE created_at >= _since
    GROUP BY event_name
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _by_path FROM (
    SELECT COALESCE(path,'—') AS path, COUNT(*)::int AS views,
           COUNT(DISTINCT session_id)::int AS unique_sessions
    FROM public.analytics_events
    WHERE created_at >= _since AND event_name = 'page_view'
    GROUP BY path ORDER BY COUNT(*) DESC LIMIT 30
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _series FROM (
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
           COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS views,
           COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'page_view')::int AS visits,
           COUNT(*) FILTER (WHERE event_name = 'signup_click')::int AS signup_clicks,
           COUNT(*) FILTER (WHERE event_name = 'signup_completed')::int AS signups
    FROM public.analytics_events WHERE created_at >= _since
    GROUP BY 1 ORDER BY 1
  ) t;

  _funnel := jsonb_build_object(
    'visits', _visits_total,
    'signup_clicks', _signup_clicks,
    'signup_completed', _signup_completed,
    'login_clicks', _login_clicks,
    'help_clicks', _help_clicks,
    'abandon_after_click', GREATEST(_signup_clicks - _signup_completed, 0),
    'click_through_rate', CASE WHEN _visits_total > 0 THEN round((_signup_clicks::numeric / _visits_total) * 100, 2) ELSE 0 END,
    'conversion_rate', CASE WHEN _signup_clicks > 0 THEN round((_signup_completed::numeric / _signup_clicks) * 100, 2) ELSE 0 END
  );

  RETURN jsonb_build_object(
    'totalEvents', _total_events,
    'uniqueSessions', _unique_sessions,
    'pageViews', _page_views,
    'byEvent', _by_event,
    'byPath', _by_path,
    'funnel', _funnel,
    'series', _series,
    'days', _days
  );
END;
$$;