CREATE POLICY "Creators can view their conversations"
ON public.conversations
FOR SELECT
USING (auth.uid() = created_by);