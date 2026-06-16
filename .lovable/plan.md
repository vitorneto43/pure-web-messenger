## Visão geral

Nova área `/posts` no menu principal do WaveChat com posts duradouros (sem expiração tipo Status), comentários em 2 níveis, botão "Chat" em cada comentarista, exposição pública para visitantes web (com gate de cadastro em curtir/comentar/compartilhar) e sistema de Boost de Post espelhado do Status.

## Banco de dados (1 migration)

**Tabelas novas (`public`):**

- `posts` — `id, user_id, kind ('text'|'image'|'video'), content, media_url, caption, background, hashtags[], music_track_id (fk story_music_tracks), music_start_sec, music_volume, visibility ('public'|'followers'), is_official, pinned, created_at, updated_at`
- `post_reactions` — `post_id, user_id, emoji, created_at` (unique post_id+user_id)
- `post_comments` — `id, post_id, user_id, parent_id (nullable, fk post_comments — só 1 nível: parent_id IS NULL OR parent_id aponta para comentário raiz), content, created_at` + trigger valida profundidade
- `post_comment_reactions` — `comment_id, user_id, emoji`
- `post_views` — `post_id, viewer_id (nullable p/ guest), session_hash, created_at`
- `post_shares` — `post_id, user_id, channel, created_at`
- `post_boosts` — espelho exato de `status_boosts` substituindo `status_id` por `post_id`, mesmas colunas de pacote/segmentação/objetivo/CPM/refund
- `post_boost_clicks` — espelho de `status_boost_clicks`

**RPCs:**
- `discover_public_posts(_limit, _offset)` — feed público (anon)
- `register_post_view(_post_id)` — anon-safe
- `register_post_boost_click(_post_id)`
- `get_post_boost_report(_boost_id)`

**RLS/GRANT:** RLS habilitada em todas; SELECT público `TO anon` apenas em posts com `visibility='public'`; inserts/updates/deletes restritos por `auth.uid()`.

## Server functions

- `src/lib/posts.functions.ts` — `createPost`, `deletePost`, `togglePostReaction`, `addPostComment`, `replyToComment`, `deleteComment`, `toggleCommentReaction`, `sharePost`, `listMyPosts`
- `src/lib/public-posts.functions.ts` — `getPublicFeed`, `getPublicPost(id)`, `getPublicComments(postId)` (server publishable client, projeção segura)
- `src/lib/post-boost.functions.ts` — clone de `boost-analytics.functions.ts` e a parte de criação de boost de Status, apontando para `post_boosts` (reusa mesmo Stripe checkout)

## Rotas

- `src/routes/_authenticated/posts.tsx` — feed scrollável (similar `descobrir-status`), funciona para guest via `GuestBrowse`
- `src/routes/_authenticated/posts.$postId.tsx` — detalhe do post + thread de comentários
- `src/routes/p.$postId.tsx` — rota pública compartilhável com OG tags (SEO)

## UI

- `src/components/posts/PostFeed.tsx` — lista vertical infinita
- `src/components/posts/PostCard.tsx` — render texto/imagem/vídeo + player de música (reusa `StatusMusicPlayer`) + ações
- `src/components/posts/PostComposer.tsx` — criar post (reusa `MusicPickerSheet`)
- `src/components/posts/PostComments.tsx` — comentários + respostas (2 níveis), botão `MessageSquare` em cada autor que chama `getOrCreateDirectConversation` (gated por `useAuthGate("message")`)
- `src/components/posts/PostActions.tsx` — curtir/comentar/compartilhar/impulsionar, todas atrás de `useAuthGate`
- `src/components/posts/PostBoostDialog.tsx` — clone do `BoostDialog` apontando para `post_boosts`
- `src/components/posts/PostBoostReportDialog.tsx` — clone do `BoostReportDialog`

Sidebar (`ChatSidebar.tsx`): adicionar item "Posts" com ícone `Newspaper`/`Layout` rotando para `/posts`.

## Comportamento guest

- `/posts` e `/p/$postId` renderizam para não-autenticados via `GuestBrowse`
- Toda ação (curtir, comentar, responder, compartilhar, criar post, impulsionar, abrir chat) passa por `useAuthGate(action, fn)` → abre `AuthGateDialog`
- Views de guest são registradas com `session_hash` (fingerprint anon)

## Pagamentos / Boost

- `post_boosts` reusa `payments.functions.ts` adicionando `boost_target_kind: 'post'` no metadata do Stripe checkout
- Webhook `/api/public/payments/webhook.ts` ganha branch que ativa `post_boosts` quando `boost_target_kind==='post'`
- Refund sweeper inclui `post_boosts`
- Mesmos pacotes, mesma UI de segmentação (estados/idade/gênero/CPM/objetivo)

## Detalhes técnicos

- `parent_id` de `post_comments` validado por trigger: `parent_id IS NULL OR (SELECT parent_id FROM post_comments WHERE id = NEW.parent_id) IS NULL` (proíbe nível 3)
- `posts.kind='video'` aceita upload via bucket `posts-media` (criar bucket público)
- Música: só `story_music_tracks` ativos (SOMENTE biblioteca interna)
- Feed público ordenado por `(is_boosted DESC, created_at DESC)` com janela de boost ativa
- Compartilhamento gera link `https://webconnectchat.com/p/{id}` com OG dinâmico

## Escopo NÃO incluído

- Não altera Status existente
- Não adiciona música externa (apenas `story_music_tracks`)
- Não muda visibilidade da home `/index` para visitantes