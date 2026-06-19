
-- 1) Fix function search_path
CREATE OR REPLACE FUNCTION public.validate_conversation_description()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  if new.description is not null and char_length(new.description) > 500 then
    raise exception 'description too long (max 500 chars)';
  end if;
  if new.name is not null and char_length(new.name) > 80 then
    raise exception 'name too long (max 80 chars)';
  end if;
  return new;
end $function$;

-- 2) chat-uploads: replace owner-only SELECT with authenticated read.
-- Bucket is already public (anyone with the URL can read via CDN); this just
-- unblocks recipients using the Storage API.
DROP POLICY IF EXISTS "Chat upload owners can list/read via API" ON storage.objects;
CREATE POLICY "Authenticated users can read chat uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-uploads');

-- 3) group-avatars: bucket is private, add authenticated SELECT so members
-- can render avatars.
DROP POLICY IF EXISTS "Authenticated users can read group avatars" ON storage.objects;
CREATE POLICY "Authenticated users can read group avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'group-avatars');

-- 4) status-media: add authenticated SELECT policy. (Bucket stays public for
-- CDN-served direct image URLs that posts already embed, but the Storage API
-- now requires auth instead of being completely open.)
DROP POLICY IF EXISTS "Authenticated users can read status media" ON storage.objects;
CREATE POLICY "Authenticated users can read status media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'status-media');
