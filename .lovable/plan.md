# Descoberta de Status Públicos

Transformar o WaveChat de "entrar → não ver nada → sair" para "entrar → ver status → comentar → seguir → conversar".

## 1. Banco de dados (1 migração)

**`profiles`**: adicionar coluna `is_public_profile boolean default true`. Quando true:
- Aparece em Descobrir
- Status `visibility='public'` ficam visíveis para qualquer logado
- Recebe comentários e seguidores de qualquer um

**`statuses`**: já tem `visibility`. Garantir índice em `(visibility, created_at desc, expires_at)`.

**RPC `discover_public_statuses(_limit int, _offset int)`** — retorna status públicos para descoberta com mix ponderado:
- 40% recentes (últimas 24h, visibility='public', autor is_public_profile=true, não-seguidos, não-bloqueados, não próprio)
- 30% mesma cidade (join profiles_private do viewer)
- 20% com mais interação (comentários + reações últimos 3 dias)
- 10% impulsionados (status_boosts ativos)
- Excluir: já visualizados pelo viewer, autores bloqueados, autores que bloquearam o viewer
- Para usuário sem seguidos: relaxar filtros, priorizar perfis completos + verificados + fundadores

Retorna: `status_id, user_id, username, display_name, avatar_url, media_url, caption, reactions_count, comments_count, views_count, is_boosted, viewer_already_liked, viewer_already_follows, created_at`.

**RPC `discover_public_profiles(_limit)`** — perfis públicos para "Pessoas para descobrir" (mesma cidade, interesses, novos, ativos). Já existe `discover_people`/`get_people_you_may_know` — estender ou criar nova focada em is_public_profile.

## 2. Nova rota `src/routes/_authenticated/descobrir-status.tsx`

Aba "🌎 Descobrir" acessível pelo `StatusBar` e pela navegação principal. Conteúdo:

- **Feed vertical full-screen** (mobile-first, similar ao Reels/TikTok mas para status WaveChat)
- Cada card mostra: mídia/texto do status, avatar + nome + cidade do autor, badges (`UserBadges inline`), tempo
- Ações em coluna à direita (mobile) ou abaixo (desktop):
  - ❤️ Curtir (toggle, otimista)
  - 💬 Comentar → abre bottom sheet com comentários do status
  - 👤 Ver perfil → `/u/$username`
  - 💬 Conversar → cria/abre conversa direta
  - ⭐ Seguir → toggle follow
- Swipe vertical / scroll snap para próximo
- Paginação infinita via `useInfiniteQuery` chamando `discover_public_statuses`
- Registra view via `register_status_view` ao entrar na tela do card

## 3. Privacidade no perfil

Em `src/routes/_authenticated/profile.tsx` adicionar toggle "🔓 Perfil público / 🔒 Perfil privado" que atualiza `profiles.is_public_profile`. Texto explicativo das implicações (aparece em descoberta, recebe comentários/seguidores).

## 4. Pontos de entrada

- `StatusBar`: adicionar um card de destaque "Descobrir" no início da lista (ícone globo)
- `EmptyChat` / quando usuário tem 0 conversas: CTA "Descobrir status públicos"
- Sidebar do chat: link "🌎 Descobrir"

## 5. Algoritmo para novo usuário

Detectar `following_count = 0` no servidor. Quando zero: a RPC já relaxa filtros automaticamente e prioriza perfis completos, verificados (selo `verified`), fundadores (selo `founder`), criadores (selo de tier alto). Sem necessidade de UI extra.

## 6. Detalhes técnicos

- Reutilizar `UserBadges` (selos), `StatusReactions`, comentários do `s.$statusId.tsx`
- Manter respeito a `user_blocks` e `is_user_restricted`
- Realtime opcional: apenas update otimista no client (não subscrever para evitar custo)
- Performance: RPC com `LIMIT/OFFSET`, índices apropriados, mídia lazy-loaded
- Mobile: scroll-snap-y mandatory, altura `100dvh`

## Arquivos a criar/editar

**Criar:**
- `supabase/migrations/...` (coluna + índice + RPC `discover_public_statuses` + extensão de `discover_public_profiles`)
- `src/routes/_authenticated/descobrir-status.tsx`
- `src/components/status/DiscoverStatusCard.tsx` (card de feed com ações)
- `src/hooks/use-discover-status.tsx` (`useInfiniteQuery`)

**Editar:**
- `src/routes/_authenticated/profile.tsx` (toggle público/privado)
- `src/components/status/StatusBar.tsx` (card "Descobrir" no início)
- `src/components/chat/EmptyChat.tsx` (CTA descobrir)
- `src/components/chat/ChatSidebar.tsx` (link descobrir)

## Resultado

Novos usuários abrem o app e imediatamente veem um feed de status reais de pessoas próximas/relevantes, podendo curtir/comentar/seguir/conversar em 1 toque — sem precisar saber quem seguir antes.
