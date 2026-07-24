# Wavechat Ecossistemas — Plano de Arquitetura

Transformar a Wavechat numa plataforma que hospeda simultaneamente a Rede Social Pública e múltiplos **Ecossistemas privados** (Business, Study, Sports, Communities, Government), reutilizando 100% da infraestrutura atual (posts, statuses, lives, videos, chat, grupos, chamadas, push, IA).

---

## 1. Princípio central: `ecosystem_id` universal

Em vez de duplicar tabelas, adicionamos uma coluna opcional **`ecosystem_id uuid`** em todas as tabelas de conteúdo já existentes:

- `posts`, `statuses`, `videos` (WaveTube + Shorts)
- `live_sessions`, `scheduled_lives`
- `conversations` (chats/grupos), `messages`
- `notifications`, `analytics_events`

Semântica:
- `ecosystem_id IS NULL` → conteúdo da **Rede Social Pública** (comportamento atual, zero regressão).
- `ecosystem_id = X` → conteúdo **exclusivo** do ecossistema X.
- **Cross-post** (publicar em ambos): cria-se uma segunda linha com `ecosystem_id = X` referenciando o post público via `origin_post_id`, ou vice-versa. Simples, auditável, sem colunas array.

Vantagem: toda a UI de feed/stories/lives/chat continua funcionando; muda apenas o filtro `WHERE ecosystem_id IS NULL` ou `= :current`.

---

## 2. Novas tabelas (mínimas)

```text
ecosystems
  id, slug (único, para URLs /e/<slug>), name, description,
  category (business|study|sports|community|government|other),
  logo_url, banner_url, primary_color,
  website, contact_email,
  visibility (private|unlisted), join_policy (invite|link|code|request),
  join_code (curto, rotacionável), created_by, created_at, updated_at

ecosystem_members
  ecosystem_id, user_id,
  role (owner|admin|moderator|member),
  status (active|pending|banned),
  joined_at, invited_by
  PK (ecosystem_id, user_id)

ecosystem_invites
  id, ecosystem_id, code (para link/QR), email (opcional),
  role_on_join, expires_at, created_by, used_by, used_at

ecosystem_settings  (jsonb livre para features futuras: storage_limit, member_limit, ai_enabled, custom_domain…)
```

Reaproveitamos `groups`/`conversations` existentes para grupos internos — grupo passa a poder ter `ecosystem_id`.

---

## 3. RLS — regra única e reutilizável

Função SECURITY DEFINER:
```sql
public.is_ecosystem_member(_eco uuid, _user uuid) returns boolean
public.ecosystem_role(_eco uuid, _user uuid) returns text
```

Padrão de policy em cada tabela de conteúdo (exemplo `posts`):
```sql
-- SELECT
using (
  ecosystem_id is null                              -- público continua público
  or public.is_ecosystem_member(ecosystem_id, auth.uid())
)
-- INSERT
with check (
  ecosystem_id is null
  or public.is_ecosystem_member(ecosystem_id, auth.uid())
)
```

Zero indexação pública de conteúdo com `ecosystem_id IS NOT NULL` (o `discover_public_*` já filtra por `is null`).

---

## 4. Publicação: seletor "Onde publicar?"

Componente compartilhado `<PublishTargetPicker />` reutilizado por:
- `PostComposer`, `StatusComposer`, `WaveTube upload`, `WaveShorts upload`, `live.new`, criação de evento.

Opções dinâmicas:
- ☐ Rede Social Wavechat (pública)
- ☐ Ecossistema X (para cada ecossistema onde o usuário é membro com permissão de publicar)
- ☐ Ambos → grava 1 linha em cada, ligadas por `origin_post_id`.

Fallback: se o usuário não é membro de nenhum ecossistema, o seletor não aparece (comportamento idêntico ao atual).

---

## 5. Navegação & UI

Novo switcher no topo do sidebar (mobile e desktop):

```text
[ Minha Rede ▾ ]
  • Rede Social Wavechat
  ─────────
  • Empresa XPTO
  • Universidade ABC
  • Clube XYZ
  + Criar / Entrar em ecossistema
```

Ao selecionar um ecossistema, um `EcosystemContext` (React) define `currentEcosystemId`, e:
- todos os hooks de feed/stories/lives/videos filtram por esse id
- header, cor primária e logo trocam para a identidade do ecossistema
- notificações são filtradas pelo contexto ativo (mas continuam chegando de todos)

Rotas novas (todas sob layout já existente, sem quebrar SEO):
- `/e/$slug` — home do ecossistema (feed interno)
- `/e/$slug/lives`, `/e/$slug/videos`, `/e/$slug/members`, `/e/$slug/settings`
- `/ecosystems/new` — criar
- `/join/$code` — entrar por link/QR

Rede social pública permanece em `/`, `/posts`, `/wavetube`, etc. — sem mudanças de URL nem de SEO.

---

## 6. Notificações

`notifications` ganha `ecosystem_id`. O push já dispara por trigger; adicionamos ao payload:
- `ecosystem_id`, `ecosystem_name`, `ecosystem_logo`
- deep link para `/e/$slug/...`

Nenhuma notificação de ecossistema vaza para não-membros (RLS + filtro no dispatcher).

---

## 7. Busca

`search_users` e demais RPCs recebem parâmetro opcional `_ecosystem_id`:
- `null` → busca pública (atual)
- valor → busca restrita aos membros/conteúdo do ecossistema

---

## 8. Administração do ecossistema

Painel `/e/$slug/settings` (visível para owner/admin):
- membros (promover, remover, banir)
- convites (gerar link, QR, código, revogar)
- identidade visual (logo, banner, cor)
- moderação (reutiliza `content_reports` com `ecosystem_id`)
- estatísticas básicas (posts, stories, lives, membros ativos)

Reusa todo o `src/components/admin/*` onde fizer sentido, escopado por `ecosystem_id`.

---

## 9. Entrega em fases (para evitar big-bang)

**Fase 1 — Fundação (esta rodada)**
1. Migração: tabelas `ecosystems`, `ecosystem_members`, `ecosystem_invites`, `ecosystem_settings` + GRANTs + RLS + funções `is_ecosystem_member`/`ecosystem_role`.
2. Migração: adicionar `ecosystem_id` (nullable, indexado) e `origin_post_id` (onde aplicável) em `posts`, `statuses`, `videos`, `live_sessions`, `scheduled_lives`, `conversations`, `messages`, `notifications`, `groups`.
3. Atualizar RLS de todas essas tabelas para o padrão "público OU membro".
4. Confirmar que RPCs `discover_public_*` continuam filtrando `ecosystem_id is null` (nada muda para visitantes).

**Fase 2 — Criação e entrada**
5. Telas: `/ecosystems/new`, `/join/$code`, aceite de convite.
6. `EcosystemContext` + switcher no `ChatSidebar`.
7. Rota `/e/$slug` com feed interno reutilizando `PostsFeed` já existente.

**Fase 3 — Publicação cross-target**
8. `<PublishTargetPicker />` e integração em Post/Status/Live/WaveTube/Shorts composers.
9. Lógica de duplicação para "publicar em ambos" (`origin_post_id`).

**Fase 4 — Administração e polimento**
10. Painel de membros, convites, identidade visual.
11. Notificações com contexto de ecossistema.
12. Busca escopada.

Monetização fica **fora** do escopo agora — apenas `ecosystem_settings.jsonb` permite adicionar limites depois sem migração.

---

## 10. Riscos e mitigações

- **RLS regressão na rede pública**: todas as policies mantêm o ramo `ecosystem_id is null` primeiro; testes manuais em `/`, `/posts`, `/wavetube`, `/waveshorts`, `/live` como visitante deslogado.
- **Vazamento cross-eco**: função `is_ecosystem_member` é a única fonte de verdade; nenhuma tabela consulta `ecosystem_members` diretamente na policy.
- **Performance**: índice parcial `where ecosystem_id is not null` em cada tabela grande + índice `(ecosystem_id, created_at desc)`.
- **SEO**: sitemap e `discover_public_*` continuam ignorando `ecosystem_id is not null`. Ecossistemas nunca são indexados.
- **Cross-post duplicado**: `origin_post_id` permite deduplicar analytics e mostrar badge "Publicado também em X".

---

## Confirmação antes de codar

Este plano cobre a Fase 1 + esqueleto da Fase 2 numa primeira entrega. Posso começar pela **migração de banco (Fase 1, passos 1–4)** que é a base de tudo — depois seguimos pelas telas. Confirma?
