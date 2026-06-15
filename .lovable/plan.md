
## Por que não precisa rebuild

O app Android é um Capacitor WebView que carrega o bundle web servido pelo Lovable. Tudo que for adicionado aqui (banco, Storage, componentes React) chega no celular do usuário na próxima vez que ele abrir o app — sem nova APK/AAB na Play Store.

A única coisa que exigiria rebuild seria mexer em plugins nativos do Capacitor (não vamos precisar — `<audio>` HTML5 toca MP3 perfeitamente em WebView Android).

---

## Banco de dados

Tabela nova `story_music_tracks` (catálogo curado pelo admin):

- `title`, `artist`, `source` (ex: "Pixabay Music", "FMA")
- `source_url` (link de crédito ao autor)
- `license` (ex: "CC0", "Pixabay Content License")
- `audio_url` (Storage público `story-music/`)
- `cover_url` (capa quadrada opcional)
- `duration_sec`, `genre`, `mood` (chill, energy, romantic, hype, sad, lofi…)
- `is_active`, `sort_order`, `play_count`

E uma nova coluna em `statuses`:
- `music_track_id` (FK → story_music_tracks)
- `music_start_sec` (int, default 0) — trecho selecionado
- `music_duration_sec` (int, default 15)
- `music_volume` (0.0-1.0, default 0.8) — para stories de vídeo mixar com áudio original

RLS: `story_music_tracks` é leitura pública para `authenticated` (e `anon` p/ link compartilhado de story).

## Storage

Bucket público `story-music` no Lovable Cloud. Recebe os MP3s (mantemos 128kbps p/ ficar leve, ~1-2MB cada).

## Catálogo inicial (~40 faixas)

Vou popular usando fontes 100% livres com licenças compatíveis com uso comercial e sem royalties:

- **Pixabay Music** (Pixabay Content License — uso comercial livre, sem atribuição obrigatória)
- **Free Music Archive** — filtro CC0 / CC-BY
- **YouTube Audio Library** — faixas "no attribution required"

Distribuição sugerida por humor: 8 chill/lofi, 8 happy/upbeat, 6 romantic, 6 hype/trap, 6 cinematic, 6 sad/emotional.

Cada faixa entra com crédito ao autor (mesmo quando não obrigatório) — boa prática.

## UX no CreateStatusDialog

Novo botão "🎵 Adicionar música" disponível para os 3 tipos (imagem, texto, vídeo):

1. **Picker bottom-sheet** com:
   - Busca por título/artista
   - Filtro por humor (chips: Chill, Romance, Energia, Triste, Cinemático, Lofi)
   - Lista com capa, título, artista, duração, botão ▶ preview
2. **Trim selector** (após escolher a faixa):
   - Waveform simples (gerada client-side com Web Audio API analisando o MP3)
   - Slider de 2 pontas pra escolher trecho de 5-30s
   - Preview tocando o trecho em loop
   - Para vídeo: slider extra de volume da música vs. áudio original
3. Salva `music_track_id`, `music_start_sec`, `music_duration_sec`, `music_volume` no status

## UX no StatusViewer

- Tag flutuante no topo "🎵 Título — Artista" (clica → modal de crédito + link p/ fonte)
- `<audio>` HTML5 tocando o trecho escolhido em loop, sincronizado com o tempo do story
- Para stories de vídeo: mixa via `volume` no `<video>` (áudio original) + `<audio>` (música)
- Botão mute global (lembra preferência em `localStorage`)
- Pré-carrega áudio do próximo story p/ transição suave

## Admin

Nova aba "Músicas" no painel admin:
- Listar/buscar/ativar/desativar faixas
- Upload de MP3 + capa
- Editar metadados, humor, ordem
- Ver `play_count` (quais bombam)

## Tracking

Eventos novos via `track()`:
- `music_picker_opened`
- `music_track_previewed` { track_id }
- `music_attached_to_story` { track_id, mood }
- `story_music_played` { track_id, story_id }

Permite o admin ver quais músicas geram mais engajamento.

## Detalhes técnicos

- Waveform: `AudioContext.decodeAudioData` → samples → render em `<canvas>`. Cacheado em memória.
- Loop preciso: `audio.addEventListener('timeupdate', …)` resetando para `music_start_sec` quando passa de `start + duration`.
- Performance: MP3s 128kbps já são pequenos; servidos via CDN do Lovable. Preload lazy.
- Acessibilidade: respeita `prefers-reduced-motion` desativando autoplay; mute por padrão até primeiro tap (políticas de autoplay).

## Ordem de implementação

1. Migration: tabela `story_music_tracks` + colunas em `statuses` + RLS + GRANTs
2. Bucket `story-music` público
3. Seed das ~40 faixas (faço upload + INSERT)
4. Componente `<MusicPickerSheet>` + `<TrimSelector>`
5. Integração no `CreateStatusDialog`
6. Player no `StatusViewer` (com mix para vídeo)
7. Aba admin "Músicas"
8. Tracking de eventos

## O que NÃO faz parte deste plano

- Captação automatizada de catálogo via API (você escolheu catálogo pré-carregado)
- Sincronizar batida com efeitos visuais (pode vir depois)
- Letras/karaokê
- Música em chat (foco é stories)
