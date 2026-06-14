
# Sistema de Selos e Emblemas

Sistema completo de badges (selos) para gamificar e aumentar a confiança/engajamento no WaveChat. Implementação no backend (Lovable Cloud) + frontend, **sem necessidade de nova versão Android** — tudo via web/PWA já embarcado.

## 1. Banco de dados (migração)

**Tabela `badges`** (catálogo de selos disponíveis):
- `code` (slug único: `verified`, `creator_starter`, `founder`, etc.)
- `name`, `description`, `icon` (emoji), `color` (hex/token)
- `category` (`verification` | `followers` | `invites` | `profile` | `historical` | `activity`)
- `tier` (ordem dentro da categoria — usado para "exibir apenas o maior")
- `criteria` (jsonb com regra: ex. `{type:'followers', min:1000}`)
- `is_automatic` (boolean — falso para "Verificado", verdadeiro para os demais)

**Tabela `user_badges`** (selos conquistados):
- `user_id`, `badge_id`, `awarded_at`, `awarded_by` (admin id, opcional)
- UNIQUE (user_id, badge_id)
- RLS: leitura pública (selos são públicos); escrita só via funções SECURITY DEFINER ou admin

**Função `recompute_user_badges(_user_id uuid)`** — recalcula todos os selos automáticos do usuário:
- Conta seguidores → atribui maior tier de Criador
- Conta convidados confirmados → atribui maior tier de Convite
- Verifica perfil completo (avatar, display_name, bio, cidade, interesses)
- Conta mensagens, chamadas, status, comentários, cidades conversadas → selos de atividade
- Membro Fundador: se está entre os 500 primeiros `profiles.created_at` → concede e nunca remove
- Para selos hierárquicos (followers/invites): remove tiers menores, mantém só o maior

**Triggers** que chamam `recompute_user_badges`:
- AFTER INSERT/DELETE em `profile_follows` (recalcula o seguido)
- AFTER INSERT em `profiles` com `invited_by` not null (recalcula o convidador)
- AFTER UPDATE em `profiles` (avatar/display_name/bio) e `profiles_private` (cidade) — perfil completo
- AFTER INSERT em `messages`, `calls`, `statuses`, `status_comments` — selos de atividade

**Seed** do catálogo `badges` com todos os 17 selos descritos (categorias 1–6).

**Função `admin_award_badge(_user_id, _badge_code)` / `admin_revoke_badge(...)`** — SECURITY DEFINER, apenas admin/superadmin. Útil para conceder "Verificado" manualmente.

## 2. Frontend — componentes reutilizáveis

**`src/components/badges/UserBadges.tsx`**
- Props: `userId`, `variant` (`inline` = só ícone ao lado do nome | `full` = ícone + nome no tooltip | `list` = grid completo)
- Busca selos via query única cacheada
- Inline mostra até 3 mais importantes (Verificado → Histórico → maior tier de cada categoria)
- Tooltip / popover ao tocar mostra nome + descrição

**`src/components/badges/BadgeIcon.tsx`** — renderiza emoji/ícone colorido.

**Hook `useUserBadges(userId)`** — react-query, cache compartilhado.

## 3. Pontos de exibição

Adicionar `<UserBadges userId={...} variant="inline" />` ao lado do nome em:
- Perfil público (`src/routes/u.$username.tsx`) — versão `full`
- Status viewer (`StatusViewer`, `StatusBar`)
- Comentários e respostas em `src/routes/s.$statusId.tsx`
- Reações de status (autor)
- Lista de seguidores/seguindo no perfil
- `PeopleYouMayKnow` (descoberta)
- `descobrir.tsx` (cards)
- Cabeçalho de conversas privadas (`ChatWindow`) e grupos (`GroupSettingsDialog`)
- Sidebar do chat (lista de conversas)

## 4. Nova seção "Conquistas" no perfil

Em `src/routes/_authenticated/profile.tsx` e no perfil público `u.$username.tsx`:
- Card "Conquistas" com grid de todos os selos do usuário
- Cada selo: ícone grande, nome, descrição, data de conquista
- Selos ainda não conquistados aparecem em cinza com "como obter" (apenas no próprio perfil)

## 5. Filtros em Descoberta

Em `src/routes/descobrir.tsx` adicionar chips de filtro:
- "Apenas verificados", "Criadores populares" (10k+ seguidores), "Embaixadores" (10+ convites), "Membros fundadores"
- Filtros aplicados via RPC `get_people_you_may_know` estendido ou nova RPC `discover_users(filter)`

## 6. Aba Admin → Selos

Novo componente `src/components/admin/BadgesTab.tsx` + entrada em `admin.tsx`:
- Listar catálogo de selos
- Buscar usuário e conceder/remover selo (chama `admin_award_badge`/`admin_revoke_badge`)
- Listar quem possui cada selo (com paginação)
- Para o selo "Verificado": fluxo manual; demais são read-only (automáticos)

## 7. Regras finais

- Selos hierárquicos (followers/invites): apenas o **maior** é exibido inline; todos aparecem na seção Conquistas com o ativo destacado.
- "Membro Fundador" e "Verificado" são prioritários na exibição inline.
- Recompute idempotente — pode ser chamado quantas vezes for necessário.
- Performance: query única por usuário cacheada em react-query; selos raramente mudam.

## Resultado

Plataforma gamificada com símbolos visuais de reputação ao lado de todo nome de usuário, seção de Conquistas no perfil, filtros de descoberta por selo, e painel admin para conceder verificação manual. Tudo no backend + web — sem rebuild Android.
