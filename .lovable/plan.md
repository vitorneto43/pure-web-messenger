# WaveTube — plataforma de vídeos dentro da WaveChat

Objetivo: criar uma seção completa de vídeos (upload + lives 16:9) integrada à WaveChat, com tudo que o YouTube tem de essencial. Botão "WaveTube" entra na barra ao lado de Nova, Lives, Grupo, Convidar.

## O que o usuário vai ver

### 1. Botão de acesso
- Novo chip **"WaveTube"** (ícone de play vermelho) na barra de atalhos do `ChatSidebar`, logo depois de "Nova / Lives / Grupo / Convidar".
- Link também no menu de engrenagem e no rodapé mobile.

### 2. Home do WaveTube (`/wavetube`)
- Grid de vídeos em cards 16:9 com thumbnail, título, canal, views, tempo, duração no canto.
- Filtros no topo: **Em alta**, **Recentes**, **Ao vivo agora**, **Seguindo**, **Shorts curtos**, e chips por categoria (Música, Jogos, Educação, Comédia, Notícias, Esportes, etc.).
- Barra de busca por título / canal / #hashtag.
- Botão flutuante **"Enviar vídeo"** e **"Ir ao vivo"**.

### 3. Página do vídeo (`/v/$videoId`)
- Player 16:9 responsivo (HTML5 + HLS quando o vídeo estiver transcodificado), com PiP web, velocidade, qualidade, legendas se houver.
- Título, canal (avatar + seguir), views, data, botão **Curtir / Não curtir**, **Compartilhar** (com marca d'água), **Salvar**, **Denunciar**.
- Descrição expansível com links e #hashtags clicáveis.
- **QR Code Pix** do criador ao lado do player (mesmo componente já usado nas lives — `LivePixSheet`) para apoio.
- **Comentários** com respostas aninhadas e **reações** (❤️ 👏 🔥 😂 😮 😢), ordenados por "Mais relevantes" ou "Mais recentes".
- Coluna lateral **"A seguir"** com recomendações (mesmo criador + tema parecido + trending).
- Botão **Impulsionar este vídeo** (só pro dono), usando o mesmo motor de impulsionamento de posts — segmentação por país, estado, idade, gênero, interesses, com relatório detalhado depois.

### 4. Página do canal (`/c/$username`)
- Reaproveita o perfil existente, mas com aba nova **"Vídeos"** e **"Ao vivo"** listando o conteúdo.

### 5. Upload (`/wavetube/upload`)
- Drop area + seleção de arquivo (mp4/mov/webm, até 2 GB na web, chunked).
- Campos: título, descrição, thumbnail (gerada automática do frame 25%, com opção de trocar), categoria, hashtags, visibilidade (público / não listado), CTA opcional (mesmo padrão dos posts), Pix on/off.
- Barra de progresso, retomada de upload interrompido.
- Depois do upload, o vídeo entra em fila de processamento (transcodificação para HLS 360p/720p/1080p via LiveKit Egress + Bunny Stream OU direto no bucket com fallback mp4 progressivo — decisão na fase técnica).

### 6. Lives 16:9
- Botão **"Ir ao vivo (WaveTube)"** reaproveita `LiveRoomShell` com layout 16:9 landscape em vez do 9:16 do "Lives" atual.
- Live encerrada vira automaticamente um **vídeo gravado** na página do canal (o Egress já grava tudo hoje).

## Estrutura técnica

### Banco (novas tabelas)
- `videos` — id, owner_id, title, description, category, hashtags[], visibility, duration_sec, file_url, hls_url, thumbnail_url, cta_label, cta_url, allow_pix, live_session_id (nullable — quando vira de live), status (uploading/processing/ready/failed), views_count, likes_count, dislikes_count, created_at, published_at.
- `video_views` — video_id, viewer_id, watched_seconds, country, state, created_at (pra views únicas + relatório de impulsionamento).
- `video_reactions` — video_id, user_id, kind (like/dislike/heart/fire/…).
- `video_comments` — id, video_id, user_id, parent_id (nullable), body, created_at.
- `video_comment_reactions` — comment_id, user_id, kind.
- `video_boosts` — mesmo shape de `post_boosts`.
- `video_boost_clicks` e `video_boost_report()` — espelho do que já existe pra posts.
- Todas com GRANT + RLS: leitura pública quando `visibility='public'`, escrita só dono.

### Storage
- Bucket `wavetube-uploads` (privado, upload assinado).
- Bucket `wavetube-public` (público, HLS + thumbnails + mp4 servido).
- Marca d'água WaveChat aplicada na thumbnail e overlay do player.

### Backend (server functions)
- `src/lib/videos.functions.ts` — createVideo, updateVideo, publishVideo, deleteVideo, listVideos, getVideo, incrementView, reactVideo, commentVideo, replyComment, reactComment, listComments.
- `src/lib/video-uploads.functions.ts` — startUpload (assina URL), finalizeUpload, processVideo (aciona transcodificação).
- `src/lib/video-boost.functions.ts` — createBoost, boostReport (copia de post-boost).
- Push notifications: novo vídeo do criador que você segue, comentário no seu vídeo, resposta ao seu comentário, reação no seu vídeo — mesmo padrão do post-push implementado hoje.

### Rotas (TanStack)
- `src/routes/wavetube.index.tsx` — home / grid.
- `src/routes/wavetube.upload.tsx` — upload.
- `src/routes/v.$videoId.tsx` — página do vídeo (pública, com metadata OG completa incluindo `og:video`, `og:image`, título e descrição — bom pra SEO/compartilhamento).
- `src/routes/wavetube.live.new.tsx` — ir ao vivo 16:9.
- Live existente ganha flag `orientation: 'landscape' | 'portrait'`.

### Ordem de entrega
1. Migração de banco + storage + RLS + GRANTs.
2. Rotas e páginas com upload básico (mp4 direto, sem HLS ainda) — já funcional.
3. Comentários + reações + QR Pix + push.
4. Impulsionamento + relatório.
5. Lives 16:9 (reaproveita LiveRoomShell).
6. Transcodificação HLS e player adaptativo (fase 2, opcional).
7. Recomendações "A seguir" (fase 2, baseado em hashtag + histórico).

### O que NÃO muda nesta entrega
- App Android (roda em modo hosted, aparece automaticamente).
- Lives verticais atuais continuam existindo — WaveTube live é uma variante 16:9.
- Nenhum toque em Chat, Meet, Stories, Posts, Growth AI, moderação.

## Confirma que sigo com tudo isso?
