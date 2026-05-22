-- Tighten profiles SELECT: owner-only on the base table
DROP POLICY IF EXISTS "Profiles viewable by self or shared conversation" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Safe public view for contact-facing reads (no pix_key, pix_key_type, preferred_bank, email)
-- security_invoker=off so the view bypasses base-table RLS, but we filter rows
-- to only those the caller is allowed to see (self or shared conversation).
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.last_seen,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE
  p.id = auth.uid()
  OR public.users_share_conversation(auth.uid(), p.id);

GRANT SELECT ON public.profiles_public TO authenticated;