CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subs" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subs" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subs" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own subs" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_push_subs_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();