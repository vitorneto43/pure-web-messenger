
-- Post comments: only visible if parent post is public, or requester owns the post/comment
DROP POLICY IF EXISTS post_comments_select_all ON public.post_comments;
CREATE POLICY post_comments_select_scoped ON public.post_comments
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND (p.visibility = 'public' OR p.user_id = auth.uid())
  )
);

-- Post comment reactions
DROP POLICY IF EXISTS pcr_select_all ON public.post_comment_reactions;
CREATE POLICY pcr_select_scoped ON public.post_comment_reactions
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.post_comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE c.id = post_comment_reactions.comment_id
      AND (p.visibility = 'public' OR p.user_id = auth.uid() OR c.user_id = auth.uid())
  )
);

-- Video comments
DROP POLICY IF EXISTS vc_select ON public.video_comments;
CREATE POLICY vc_select_scoped ON public.video_comments
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.id = video_comments.video_id
      AND (v.visibility = 'public' OR v.owner_id = auth.uid())
  )
);

-- Video reactions
DROP POLICY IF EXISTS vr_select ON public.video_reactions;
CREATE POLICY vr_select_scoped ON public.video_reactions
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.id = video_reactions.video_id
      AND (v.visibility = 'public' OR v.owner_id = auth.uid())
  )
);

-- Video comment reactions
DROP POLICY IF EXISTS vcr_select ON public.video_comment_reactions;
CREATE POLICY vcr_select_scoped ON public.video_comment_reactions
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.video_comments c
    JOIN public.videos v ON v.id = c.video_id
    WHERE c.id = video_comment_reactions.comment_id
      AND (v.visibility = 'public' OR v.owner_id = auth.uid() OR c.user_id = auth.uid())
  )
);

-- Storage: wavetube bucket - restrict to owner or public videos
DROP POLICY IF EXISTS wavetube_public_read ON storage.objects;
CREATE POLICY wavetube_scoped_read ON storage.objects
FOR SELECT USING (
  bucket_id = 'wavetube'
  AND (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.visibility = 'public'
        AND (
          v.file_url LIKE '%' || storage.objects.name
          OR v.hls_url LIKE '%' || storage.objects.name
          OR v.thumbnail_url LIKE '%' || storage.objects.name
        )
    )
  )
);

-- Storage: group-avatars bucket - only members or public groups
DROP POLICY IF EXISTS "Authenticated users can read group avatars" ON storage.objects;
CREATE POLICY group_avatars_scoped_read ON storage.objects
FOR SELECT USING (
  bucket_id = 'group-avatars'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.avatar_url LIKE '%' || storage.objects.name
      AND (
        c.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.conversation_members m
          WHERE m.conversation_id = c.id
            AND m.user_id = auth.uid()
            AND m.left_at IS NULL
        )
      )
  )
);
