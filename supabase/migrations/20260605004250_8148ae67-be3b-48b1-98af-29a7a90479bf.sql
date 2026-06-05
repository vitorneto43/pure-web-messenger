
-- Subscribers
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  source text DEFAULT 'widget',
  status text NOT NULL DEFAULT 'active',
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX newsletter_subscribers_email_unique ON public.newsletter_subscribers (lower(email));
CREATE INDEX newsletter_subscribers_user_idx ON public.newsletter_subscribers (user_id);

GRANT SELECT, INSERT, UPDATE ON public.newsletter_subscribers TO authenticated;
GRANT SELECT, INSERT ON public.newsletter_subscribers TO anon;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owner views own subscription" ON public.newsletter_subscribers
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner updates own subscription" ON public.newsletter_subscribers
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Posts (newsletter editions)
CREATE TABLE public.newsletter_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  content text NOT NULL,
  media_url text,
  media_type text,
  cta_label text,
  cta_url text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  sent_at timestamptz,
  recipients_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_posts TO authenticated;
GRANT ALL ON public.newsletter_posts TO service_role;

ALTER TABLE public.newsletter_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage newsletter posts" ON public.newsletter_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view sent posts" ON public.newsletter_posts
  FOR SELECT TO authenticated USING (status = 'sent');

CREATE TRIGGER newsletter_posts_updated_at
  BEFORE UPDATE ON public.newsletter_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Feedback
CREATE TABLE public.newsletter_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  message text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.newsletter_feedback TO authenticated;
GRANT INSERT ON public.newsletter_feedback TO anon;
GRANT ALL ON public.newsletter_feedback TO service_role;

ALTER TABLE public.newsletter_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback" ON public.newsletter_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (length(trim(message)) BETWEEN 1 AND 2000);
CREATE POLICY "Admins view feedback" ON public.newsletter_feedback
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());
CREATE POLICY "Admins update feedback" ON public.newsletter_feedback
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Send function: creates notifications for subscribed users
CREATE OR REPLACE FUNCTION public.admin_send_newsletter(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post RECORD;
  _count int := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _post FROM public.newsletter_posts WHERE id = _post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF _post.status = 'sent' THEN RAISE EXCEPTION 'Already sent'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT DISTINCT s.user_id,
                  'newsletter',
                  _post.title,
                  COALESCE(_post.summary, left(_post.content, 200)),
                  jsonb_build_object(
                    'post_id', _post.id,
                    'media_url', _post.media_url,
                    'media_type', _post.media_type,
                    'cta_label', _post.cta_label,
                    'cta_url', _post.cta_url,
                    'content', _post.content
                  )
  FROM public.newsletter_subscribers s
  WHERE s.user_id IS NOT NULL AND s.status = 'active';

  GET DIAGNOSTICS _count = ROW_COUNT;

  UPDATE public.newsletter_posts
    SET status = 'sent', sent_at = now(), recipients_count = _count
    WHERE id = _post_id;

  RETURN jsonb_build_object('ok', true, 'recipients', _count);
END;
$$;

-- Stats for admin
CREATE OR REPLACE FUNCTION public.admin_newsletter_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total int; _active int; _linked int; _feedback int; _unhandled int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT COUNT(*) INTO _total FROM public.newsletter_subscribers;
  SELECT COUNT(*) INTO _active FROM public.newsletter_subscribers WHERE status = 'active';
  SELECT COUNT(*) INTO _linked FROM public.newsletter_subscribers WHERE status='active' AND user_id IS NOT NULL;
  SELECT COUNT(*) INTO _feedback FROM public.newsletter_feedback;
  SELECT COUNT(*) INTO _unhandled FROM public.newsletter_feedback WHERE handled = false;
  RETURN jsonb_build_object(
    'total_subscribers', _total,
    'active_subscribers', _active,
    'reachable_in_app', _linked,
    'feedback_total', _feedback,
    'feedback_unhandled', _unhandled
  );
END;
$$;
