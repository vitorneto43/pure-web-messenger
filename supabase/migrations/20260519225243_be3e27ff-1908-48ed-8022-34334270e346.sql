
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','declined','missed','ended','cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_conversation ON public.calls(conversation_id);
CREATE INDEX idx_calls_callee ON public.calls(callee_id);
CREATE INDEX idx_calls_caller ON public.calls(caller_id);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view conversation calls"
ON public.calls FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Caller can create call"
ON public.calls FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id AND public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Participants update call"
ON public.calls FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE TRIGGER calls_set_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
