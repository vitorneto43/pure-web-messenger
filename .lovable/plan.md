# Grupos Públicos e Privados

Hoje o WaveChat já tem `conversations` com `is_group=true` (usado pelo `NewGroupDialog`). Vou estender esse modelo pra virar "comunidades" de verdade — com público/privado, categoria, descoberta, busca e moderação — sem quebrar os grupos atuais (todos viram `private` por padrão).

## 1. Banco

Estender `conversations`:
- `visibility` enum: `private` | `public` (default `private`)
- `category` enum: `business | tech | games | music | entertainment | relationships | travel | sports | education | other` (nullable)
- `description text` (até 500 chars)
- `avatar_url text`
- `join_policy` enum: `open` | `request` (só vale pra públicos)
- `member_count int` (denormalizado, mantido por trigger em `conversation_members`)
- `created_at` (já existe)

Nova tabela `group_join_requests` (id, conversation_id, user_id, status `pending|approved|rejected`, created_at, decided_at, decided_by). RLS: usuário vê/cria as próprias; admins do grupo veem/decidem as do grupo deles.

Nova tabela `group_reports` (id, conversation_id, reporter_id, reason enum `spam|adult|violence|scam|copyright|other`, details text, status `pending|reviewed|dismissed|actioned`, created_at). RLS: qualquer auth cria; admins do app leem (`has_role admin/moderator`).

RLS em `conversations`:
- SELECT: membro OU (`visibility='public'`) — público é visível pra `authenticated` e `anon` (pra SEO/descoberta).
- UPDATE: só admins do grupo (via `conversation_members.role='admin'`).
- INSERT: criador autenticado.

RLS em `messages` e `conversation_members` continua igual (só membros leem mensagens — público mostra metadados, não conteúdo, até entrar).

Trigger em `conversation_members` mantém `conversations.member_count`.

Trigger em `group_join_requests` quando vira `approved` insere em `conversation_members`.

## 2. Server functions (`src/lib/groups.functions.ts`)

- `discoverGroupsPublic` (sem auth, lê via publishable client; filtros: `popular` | `recent` | `growing`; categoria opcional; paginação).
- `searchGroupsPublic(q)` — busca por nome/descrição.
- `getGroupPublic(id)` — metadados + admins (display_name/avatar/username) + se o caller é membro / tem request pendente.
- `requestJoinGroup` / `joinOpenGroup` (auth).
- `approveJoinRequest` / `rejectJoinRequest` (auth, admin do grupo).
- `removeMember` / `promoteMember` (auth, admin).
- `updateGroupSettings` (visibility, category, description, avatar, join_policy, name — auth, admin).
- `reportGroup(conversation_id, reason, details)` (auth).
- Admin app: `listReportedGroups`, `resolveGroupReport` (admin role).

## 3. Frontend

### Criação / edição
`NewGroupDialog` ganha campos: avatar upload, descrição, tipo (Privado/Público), se Público → categoria + política (Livre / Aprovação). Sub-step: ao escolher Privado mantém o fluxo atual de adicionar membros; ao escolher Público pula o passo de membros (entra quem quiser).

Nova tela `Group Settings` (`/grupo/$id/configuracoes`) acessível a admins, com: editar foto/nome/descrição/categoria/visibilidade/política, lista de membros (promover/remover), lista de solicitações pendentes (aprovar/rejeitar).

### Página do grupo público
Nova rota pública `src/routes/g.$groupId.tsx` (SSR, com `head()` dinâmico — title/description/og:image a partir do grupo). Mostra foto, nome, descrição, categoria, member_count, data, admins. Botão "Entrar" (livre) ou "Solicitar entrada" (aprovação). Se já é membro, botão "Abrir chat" → `/chat/$conversationId`. Se não está logado, CTA "Criar conta para entrar".

### Descobrir
Em `src/routes/descobrir.tsx` adicionar seção "Comunidades" com cards (avatar, nome, categoria badge, "N membros", botão Entrar/Ver). Tabs de filtro: Populares / Recentes / Em crescimento. Filtro por categoria (chips).

### Busca
Onde já existe busca de usuários/hashtags/posts/status, adicionar aba/seção "Grupos" que chama `searchGroupsPublic`.

### Denúncia
`ReportGroupDialog` reaproveitando padrão do `ReportContentDialog`, acessível no menu do grupo (página pública e dentro do chat do grupo).

### Admin
Nova aba `GroupReportsTab` em `admin.tsx` (lista reports pendentes, abrir grupo, dispensar / aplicar ação — ocultar grupo / banir).

## 4. Detalhes técnicos

- Storage: bucket público `group-avatars` pra foto do grupo.
- Grupos atuais (existentes em `conversations is_group=true`) migram com `visibility='private'`, `join_policy='request'`, `member_count` backfilled via UPDATE.
- Tradução PT/EN nos dicts (`src/i18n/dicts/chat.ts` + novo `groups.ts`).
- SEO: rota `/g/$id` pública entra no `sitemap[.]xml.ts` (somente públicos).

## 5. Entrega faseada

Pra reduzir risco, sugiro 3 PRs:
1. **Banco + criação/edição + tela do grupo público + entrada (livre/aprovação).**
2. **Descobrir (seção Comunidades) + busca de grupos + denúncia.**
3. **Painel admin (reports) + filtros avançados (Em crescimento) + i18n completo.**

Posso entregar tudo de uma vez se preferir — só fica um diff bem grande. Confirma se sigo já com a fase 1 ou se prefere algum ajuste de escopo antes (ex.: remover categoria, simplificar moderação, etc.)?
