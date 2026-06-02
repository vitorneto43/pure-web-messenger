CREATE POLICY "Admin profiles viewable by everyone"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(id, 'admin'::app_role));