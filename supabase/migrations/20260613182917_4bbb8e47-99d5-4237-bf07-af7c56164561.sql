
CREATE TABLE public.spam_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  message_id UUID,
  conversation_id UUID,
  content_excerpt TEXT,
  ip TEXT,
  user_agent TEXT,
  score INT NOT NULL DEFAULT 0,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  auto_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spam_signals_sender ON public.spam_signals(sender_id, created_at DESC);
CREATE INDEX idx_spam_signals_ip ON public.spam_signals(ip, created_at DESC);
CREATE INDEX idx_spam_signals_created ON public.spam_signals(created_at DESC);

GRANT SELECT ON public.spam_signals TO authenticated;
GRANT ALL ON public.spam_signals TO service_role;

ALTER TABLE public.spam_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods/Admins can read spam signals"
ON public.spam_signals
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
  OR public.has_role(auth.uid(), 'superadmin')
);
