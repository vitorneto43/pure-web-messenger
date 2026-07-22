
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.accept_terms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.profiles
     SET terms_accepted_at = COALESCE(terms_accepted_at, now()),
         updated_at = now()
   WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_terms() TO authenticated;
