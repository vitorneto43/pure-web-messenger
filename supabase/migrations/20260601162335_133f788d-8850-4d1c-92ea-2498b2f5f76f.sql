
-- 1) Helper: is the user an admin of this conversation?
CREATE OR REPLACE FUNCTION public.is_group_admin(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv_id
      AND user_id = _user_id
      AND role = 'admin'
  );
$$;

-- 2) Allow group admins to add new members
DROP POLICY IF EXISTS "Admins can add members to group" ON public.conversation_members;
CREATE POLICY "Admins can add members to group"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_group_admin(conversation_id, auth.uid())
);

-- 3) Allow group admins to remove other members
DROP POLICY IF EXISTS "Admins can remove members from group" ON public.conversation_members;
CREATE POLICY "Admins can remove members from group"
ON public.conversation_members
FOR DELETE
TO authenticated
USING (
  public.is_group_admin(conversation_id, auth.uid())
);

-- 4) Allow group admins to update role of other members (promote/demote)
DROP POLICY IF EXISTS "Admins can change member roles" ON public.conversation_members;
CREATE POLICY "Admins can change member roles"
ON public.conversation_members
FOR UPDATE
TO authenticated
USING (public.is_group_admin(conversation_id, auth.uid()))
WITH CHECK (public.is_group_admin(conversation_id, auth.uid()));

-- 5) Allow group admins to delete the conversation
DROP POLICY IF EXISTS "Admins can delete group" ON public.conversations;
CREATE POLICY "Admins can delete group"
ON public.conversations
FOR DELETE
TO authenticated
USING (
  is_group = true AND public.is_group_admin(id, auth.uid())
);

-- 6) Cascade cleanup when a conversation is deleted (messages, members, calls, typing)
-- We do this via a BEFORE DELETE trigger so it works regardless of FK constraints.
CREATE OR REPLACE FUNCTION public.cleanup_conversation_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages WHERE conversation_id = OLD.id;
  DELETE FROM public.typing_indicators WHERE conversation_id = OLD.id;
  DELETE FROM public.calls WHERE conversation_id = OLD.id;
  DELETE FROM public.conversation_members WHERE conversation_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_conversation ON public.conversations;
CREATE TRIGGER trg_cleanup_conversation
BEFORE DELETE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_conversation_on_delete();
