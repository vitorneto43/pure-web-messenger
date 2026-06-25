# Sistema de Convites WaveChat

Implementação completa sem alterar nenhuma funcionalidade existente. Tudo somado em cima.

## 1. Banco de dados (migração)

Novas tabelas:

- `invite_links` — link único por usuário (slug curto opcional além do user_id), contadores agregados (clicks, signups, installs).
- `invite_clicks` — cada acesso ao link `/invite/:id`: canal (whatsapp, facebook, instagram, tiktok, kwai, share, copy, other), IP hash, user agent, referrer, utm, timestamp.
- `invite_signups` — vínculo "quem convidou quem": inviter_id, invited_user_id, channel, click_id, criado em.
- `ambassador_tiers` — níveis configuráveis (nome, ícone, min_invites, ativo). Seed: 1, 5, 10, 25, 50, 100, 250, 500, 1000.
- `ambassador_settings` — flags do super admin: ranking_public, rewards_enabled.

RLS: usuário vê só seus próprios convites/clicks; admin vê tudo (via `has_role`). `invite_clicks` aceita INSERT anônimo (para rastrear cliques pré-login). Grants padrão (authenticated + service_role; anon SELECT só em `ambassador_tiers` e ranking público).

Funções:
- `get_my_invite_stats()` — totais do usuário logado por canal.
- `get_ambassador_level(user_id)` — retorna tier atual.
- `get_top_ambassadors(limit)` — ranking público.
- Trigger em `auth.users` (ou no signup flow) que lê cookie/localStorage `wc_invited_by` e cria linha em `invite_signups`.

## 2. Captura do convite (frontend)

- Nova rota pública `src/routes/invite.$inviterId.tsx`:
  - Server loader registra um `invite_clicks` (canal vem de `?c=wa|fb|ig|tt|kw|share|copy`).
  - Salva `wc_invited_by` em localStorage + cookie de 30 dias.
  - Redireciona para `/` (feed) — visitante vê tudo, ao se cadastrar o vínculo é gravado.
- Em `src/routes/auth.tsx`, no sucesso do signup, chamar server fn `attachInviter` que lê o cookie e insere em `invite_signups` + dispara verificação de tier.

## 3. UI — Convidar amigos

Novo componente `src/components/invite/InviteFriendsSheet.tsx` (Sheet/Dialog):
- Botões: WhatsApp, Facebook, Instagram, TikTok, Kwai, Compartilhar (Web Share API + Capacitor Share), Copiar link.
- Cada botão monta a URL com `?c=<canal>` e abre o deep link/intent apropriado.
- Mensagem padrão pt-BR (igual ao briefing) + i18n.

Pontos de entrada (adicionar sem remover nada):
- Item no menu de engrenagem (dropdown da Home) → "👥 Convidar amigos".
- Card opcional reaproveitando o `InviteRewardsCard` existente.

## 4. UI — Meus convites

Nova rota `src/routes/_authenticated/meus-convites.tsx`:
- Cards: enviados (cliques únicos), cadastros gerados, ativos (last_seen <30d), nível atual.
- Ranking de canais (barra).
- Progresso até o próximo tier Embaixador.

## 5. Selo Embaixador

- `src/components/badges/AmbassadorBadge.tsx` — exibe 🏅 + tier + contador "X pessoas convidadas".
- Inserir no perfil (`/u/$username` e `/_authenticated/profile`) sem mexer no resto do layout.

## 6. Ranking público

Nova rota `src/routes/embaixadores.tsx`:
- Lista top N com foto, nome, nº convidados, tier.
- Some quando `ambassador_settings.ranking_public = false`.

## 7. Admin

Nova aba "Convites" em `src/routes/admin.tsx` (`src/components/admin/InvitesAdminTab.tsx`):
- Totais globais, gráfico de crescimento (line), pizza por canal.
- Tabela "quem convidou quem" com busca.
- Editor de tiers (CRUD `ambassador_tiers`).
- Toggles: ranking público, recompensas ativas.

## 8. Server functions

`src/lib/invites.functions.ts`:
- `recordInviteClick({ inviterId, channel, meta })` — público.
- `getMyInviteStats()` — autenticado.
- `attachInviter()` — autenticado, lê cookie e grava signup.
- `getTopAmbassadors({ limit })` — público.
- `getAdminInviteOverview()` / `listInviteRelations()` / `upsertTier()` / `setAmbassadorSetting()` — admin (checa `has_role`).

## 9. Compartilhamento nativo

`src/lib/share.ts`:
- Detecta Capacitor → `@capacitor/share`.
- Senão Web Share API.
- Fallback: copiar para clipboard + toast.

## 10. Preparação para analytics externos

Disparar evento `invite_sent` / `invite_click` / `invite_signup` via `track()` com metadata `{ channel, inviter_id }` — já fica pronto para mapear em GA4/Meta/AppsFlyer depois.

## Detalhes técnicos

- Não tocar em: `client.ts`, `auth-middleware.ts`, `types.ts`, layout `_authenticated/route.tsx`.
- RLS estrita; `invite_clicks` aceita anon INSERT só com `inviter_id` válido (FK em `profiles`).
- Tiers via `has_role('admin')` para escrita.
- Rota `/invite/$inviterId` é pública (SSR ok, sem auth).
- i18n: adicionar chaves em `src/i18n/dicts/`.
- Index em `invite_clicks(inviter_id, created_at)` e `invite_signups(inviter_id)` para escala.

## Fora de escopo (mas estruturado para receber depois)

- Integração real com Firebase/AppsFlyer/Meta SDK — só os hooks de evento ficam prontos.
- Atribuição de instalação Android via Play Install Referrer — campo `install_source` reservado em `invite_signups`.
