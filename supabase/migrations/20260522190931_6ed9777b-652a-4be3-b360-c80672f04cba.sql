
-- Fix 1: conversation_members INSERT escalation
DROP POLICY IF EXISTS "Users can join conversations they create or are added to" ON public.conversation_members;

CREATE POLICY "Users can join conversations they create or are added to"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_members.conversation_id
      AND c.created_by = auth.uid()
  )
);

-- Fix 2: messages UPDATE must require current membership
DROP POLICY IF EXISTS "Users can edit own messages" ON public.messages;

CREATE POLICY "Users can edit own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() = sender_id
  AND public.is_conversation_member(conversation_id, auth.uid())
)
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_member(conversation_id, auth.uid())
);
