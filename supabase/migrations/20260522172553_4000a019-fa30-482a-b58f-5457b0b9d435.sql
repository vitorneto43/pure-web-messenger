
-- 1. PROFILES: restrict SELECT to self or shared conversation
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles viewable by self or shared conversation"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.users_share_conversation(auth.uid(), id)
);

-- 2. Public user search RPC (returns only safe public fields)
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND length(trim(q)) >= 1
    AND (
      p.username ILIKE '%' || q || '%'
      OR p.display_name ILIKE '%' || q || '%'
    )
  ORDER BY p.username
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- 3. STORAGE: avatars — owner can delete; remove broad listing policy (public CDN still works)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;

CREATE POLICY "Avatar owners can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. STORAGE: chat-uploads — owner can update/delete; restrict listing to owner
DROP POLICY IF EXISTS "Chat uploads readable by authenticated" ON storage.objects;
DROP POLICY IF EXISTS "chat-uploads are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can read chat uploads" ON storage.objects;

CREATE POLICY "Chat upload owners can list/read via API"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Chat upload owners can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Chat upload owners can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. STORAGE: status-media — drop broad listing (CDN public access unaffected)
DROP POLICY IF EXISTS "Status media publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "status-media are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to status-media" ON storage.objects;

-- 6. REALTIME: scope channel access by topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realtime topic access" ON realtime.messages;

CREATE POLICY "Realtime topic access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- user-scoped channels: must end with the caller's uid
  (realtime.topic() = 'badge-sync-' || auth.uid()::text)
  OR (realtime.topic() = 'notif-bell-' || auth.uid()::text)
  OR (realtime.topic() = 'calls-inbox-' || auth.uid()::text)
  -- shared broadcast channels: only safe, non-sensitive metadata flows here
  OR (realtime.topic() IN ('status-bar', 'sidebar-feed'))
  -- conversation channel: must be a member of conv-<uuid>
  OR (
    realtime.topic() LIKE 'conv-%'
    AND public.is_conversation_member(
      substring(realtime.topic() from 6)::uuid,
      auth.uid()
    )
  )
  -- per-call channel: must be caller or callee
  OR (
    realtime.topic() LIKE 'call:%'
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = substring(realtime.topic() from 6)::uuid
        AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
    )
  )
);

-- 7. Lock down SECURITY DEFINER helper functions (revoke from anon/public; keep authenticated)
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.users_share_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_status_view(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_status_view(uuid) TO authenticated;
