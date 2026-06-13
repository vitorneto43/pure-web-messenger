# Funil de Conversão — SuperAdmin

Nova aba no painel admin que mostra, em tempo real, onde os usuários abandonam o cadastro do WaveChat. Hoje só sabemos quem clicou em "Cadastrar"; depois disso é caixa preta. Esse plano fecha o funil ponta a ponta usando a tabela `analytics_events` que já existe e o helper `track()` em `src/lib/track.ts`.

## O que o usuário verá

Aba **Funil de Conversão** no `/admin`, com:

1. **Seletor de período**: Hoje · 7d · 30d · 90d.
2. **Gráfico de funil vertical** com as 12 etapas, contagem absoluta e % de perda entre cada uma.
3. **Cards de abandono** (8 cards) mostrando quantos e qual % desistiram em cada gargalo.
4. **Bloco "Exploração sem cadastro"** com 5 métricas do modo visitante.
5. **Alertas inteligentes** gerados automaticamente quando uma etapa perde mais que um limite (configurável, default 40%) — frases prontas em PT-BR.

## As 12 etapas do funil

| # | Etapa | Evento rastreado |
|---|---|---|
| 1 | Visitas únicas | `page_view` (já existe) — distinct `session_id` |
| 2 | Clique em "Cadastrar" | `signup_cta_click` (novo) |
| 3 | Tela de cadastro aberta | `auth_signup_view` (novo) |
| 4 | Início do preenchimento | `signup_field_focus` (novo, 1x por sessão) |
| 5 | E-mail preenchido | `signup_email_filled` (novo) |
| 6 | Usuário/Nome preenchido | `signup_username_filled` (novo) |
| 7 | Senha preenchida | `signup_password_filled` (novo) |
| 8 | Botão "Criar conta" clicado | `signup_submit_click` (novo) |
| 9 | Cadastro concluído | `signup_success` (novo) |
| 10 | Primeiro login | derivado de `profiles.created_at` + primeiro `login_success` |
| 11 | Primeira conversa | primeiro `message_sent` (novo) por usuário |
| 12 | Primeiro status | primeiro `status_published` (novo) por usuário |

Cada etapa é deduplicada por `session_id` (etapas 1–8) ou por `user_id` (9–12) para não inflar com recliques.

## Modo visitante (exploração sem cadastro)

- Visitantes únicos que entraram em `/descobrir` sem sessão autenticada.
- Abriram perfil público (`/u/$username`) → evento `public_profile_view`.
- Visualizaram lista de usuários → evento `discover_list_view`.
- Voltaram depois e criaram conta → join entre `session_id` visitante × `signup_success`.
- Taxa de conversão visitante → cadastro.

## Implementação

### 1. Instrumentação de eventos (frontend)

Editar:
- `src/routes/index.tsx` (landing) — disparar `signup_cta_click` no botão principal.
- `src/routes/auth.tsx` — disparar `auth_signup_view` no mount, `signup_field_focus` no primeiro `onFocus`, `signup_email_filled` / `signup_username_filled` / `signup_password_filled` em `onBlur` quando válido, `signup_submit_click` no submit, `signup_success` após `auth.signUp` ok.
- `src/hooks/use-auth.tsx` — disparar `login_success` no `SIGNED_IN`.
- `src/components/chat/ChatWindow.tsx` — disparar `message_sent` no envio.
- `src/components/status/CreateStatusDialog.tsx` — disparar `status_published` ao criar.
- `src/routes/descobrir.tsx` — `discover_list_view`.
- `src/routes/u.$username.tsx` — `public_profile_view`.

Todos usam o `track()` existente; não precisa de tabela nova.

### 2. Server function de agregação

Novo arquivo `src/lib/funnel.functions.ts`:
- `getConversionFunnel({ period: 'today'|'7d'|'30d'|'90d' })` — só admins.
- Roda queries agregadas em `analytics_events` (distinct sessions/users por `event_name` no intervalo) + joins com `profiles`, `messages`, `statuses` para etapas 10–12.
- Retorna `{ steps: [{key, label, count, dropPct}], abandonment: [...], visitor: {...}, alerts: [...] }`.
- Gate de admin via `has_role(auth.uid(), 'admin')` igual aos outros admin fns.

### 3. UI

Novo arquivo `src/components/admin/ConversionFunnelTab.tsx`:
- `useQuery` chamando o serverFn.
- Componente `<FunnelChart>` próprio (divs com largura proporcional, sem libs novas — já temos `recharts` se quiser barras horizontais).
- Cards de abandono em grid.
- Alertas como `<Alert>` do shadcn quando `dropPct >= threshold`.

Registrar a aba em `src/routes/admin.tsx`.

### 4. Banco

Nenhuma migration necessária — `analytics_events` já tem `event_name`, `session_id`, `user_id`, `created_at`, `metadata`. Para acelerar, em uma segunda iteração posso adicionar índice em `(event_name, created_at)`.

## Detalhes técnicos

- Períodos: `today` = hoje em UTC; `7d/30d/90d` = `now() - interval`.
- Deduplicação no SQL com `count(distinct session_id)` para etapas pré-login e `count(distinct user_id)` para pós-login.
- Etapas 10–12: a primeira ocorrência é derivada via `min(created_at) per user_id` e contada no período pedido.
- Alertas: gerados no server com limiares default (`abandonAlert >= 40%`, `noLoginAlert >= 15%`). Frases em PT-BR montadas no server para já chegar prontas na UI.
- Acesso: apenas usuários com `app_role = 'admin'`. Não exposto a `anon`.

## Fora de escopo (não vou fazer agora)

- A/B testing de variantes da tela de cadastro.
- Exportar CSV do funil (posso adicionar depois).
- Índice no banco para `analytics_events` (avalio se ficar lento).
- Heatmap de cliques.