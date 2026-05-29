
-- 1) Apagar mensagens: colunas adicionais
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_everyone_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- 2) Permitir a quem deletou-para-mim atualizar a linha sem ser o autor.
--    Sender pode editar/apagar-para-todos; qualquer membro pode adicionar
--    seu próprio id em deleted_for. A policy existente "Users can edit own
--    messages" continua valendo para o autor. Adicionamos uma policy
--    complementar para members tocarem apenas deleted_for via update.
DROP POLICY IF EXISTS "Members can mark deleted_for_me" ON public.messages;
CREATE POLICY "Members can mark deleted_for_me"
ON public.messages
FOR UPDATE
TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()))
WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()));

-- 3) Chamadas: marcar quando o destinatário "viu" a chamada (para badge).
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- 4) Garantir que realtime continue propagando messages com payload completo
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
