# Impulsionamento personalizado, relatório e aba admin

## 1. Banco de dados (migração única)

Estender `status_boosts` para suportar boosts personalizados:
- `boost_type` text default `'package'` (`'package' | 'custom'`)
- `duration_days` int (1–30)
- `target_states` text[] (UFs BR; vazio = país todo)
- `target_age_min` int, `target_age_max` int
- `target_gender` text (`'male' | 'female' | 'all'`)
- `objective` text (`'views' | 'comments' | 'profile_visits' | 'chat' | 'network' | 'website' | 'cross_platform'`)
- `cpm_cents` int (custo por mil impressões calculado)
- `starts_at`, `ends_at` timestamptz

Estender `status_views` (já registra views) com:
- `viewer_state` text, `viewer_age` int, `viewer_gender` text, `viewer_country` text
- (preenchidos no `register_status_view` a partir de `profiles_private` + survey)

Nova tabela `status_boost_clicks` para cliques no CTA:
- id, boost_id, status_id, clicker_id (nullable), clicked_at, viewer_state, viewer_age, viewer_gender

Funções RPC:
- `get_boost_report(_boost_id uuid)` → JSON com: total views, total clicks, CTR, CPM real, gasto total, séries diárias, breakdown por estado/idade/sexo
- `admin_boost_overview(_days int)` → JSON com: total boosts, gasto total, receita por dia, top objetivos, top estados-alvo, breakdown por tipo (package/custom)

CPM base (BRL cents por 1000 impressões):
- views: 5000 (R$ 50/1k) base
- multiplicadores por segmentação (estados específicos +20%, idade restrita +15%, gênero específico +10%)
- objetivos premium (chat, network, cross_platform): +30%

## 2. Backend (server functions)

`src/lib/payments.functions.ts`:
- estender `createBoostCheckout` para aceitar `custom` package com os novos campos
- calcular `amount_cents` server-side a partir de CPM + views_total
- `views_total = floor((budget_cents / cpm_cents) * 1000)`

Novos arquivos:
- `src/lib/boost-report.functions.ts` → `getBoostReport({ boostId })`
- `src/lib/admin-boosts.functions.ts` → `getAdminBoostStats({ days })`
- `src/lib/boost-tracking.functions.ts` → `trackBoostClick({ statusId })` chamada quando usuário clica no CTA

Stripe: criar product/price `boost_custom` com `custom_unit_amount` para suportar valores variáveis.

## 3. Frontend — diálogo de boost

`src/components/status/BoostDialog.tsx`:
- Adicionar aba "Personalizado" no topo (tabs: Pacotes | Personalizado)
- Tela personalizada:
  - Slider de orçamento R$ 10–R$ 500
  - Slider de duração 1–30 dias
  - Multi-select de estados BR (com botão "Brasil todo")
  - Range slider idade 13–80
  - Radio sexo (masc / fem / todos)
  - Select objetivo (7 opções com ícones)
  - Estimativa em tempo real: "≈ X visualizações em Y dias"
  - Preço por mil impressões exibido
- Mantém CTA label/url já existente

## 4. Relatório de boost

Novo botão "Relatório" ao lado de "Impulsionar" em `BoostHistory.tsx`.

Novo componente `src/components/status/BoostReportDialog.tsx`:
- Cards: gasto total, views entregues, cliques, CTR%, CPM real
- Gráfico de linha (views/dia, cliques/dia) — Recharts
- Barras: top 10 estados que viram
- Barras: faixa etária (13-17, 18-24, 25-34, 35-44, 45-54, 55+)
- Pizza: gênero (M/F/desconhecido)
- Tabela: timeline de eventos

## 5. Aba admin "Impulsionamentos"

`src/routes/admin.tsx` (ou tab existente):
- Nova aba "Impulsos"
- Stats cards: total impulsos, receita total, impulsos ativos, ticket médio
- Gráfico de receita diária (últimos 30 dias)
- Tabela: últimos 100 impulsos (usuário, tipo, valor, status, views entregues/totais)
- Breakdown: pacote vs personalizado, por objetivo, por estado-alvo

## 6. Tracking de views enriquecido

Atualizar `register_status_view` para gravar viewer demographics (estado/idade/gênero) puxando de `profiles_private` + `user_onboarding_survey`.

## 7. Critérios de aceite

- Usuário consegue criar boost personalizado e ver estimativa antes de pagar
- Após pagamento, boost ativa e aparece no histórico
- Botão "Relatório" abre dialog com 5 gráficos populados
- Admin vê aba "Impulsos" com receita total e lista
- Filtros (estado/idade/gênero) afetam quem vê o status sponsored

## Notas técnicas (para revisão)

- CPM calculado server-side em `createBoostCheckout`; cliente envia parâmetros, servidor retorna preço final
- Filtros de segmentação implementados em `get_my_sponsored_status_ids` (extender para checar estado/idade/gênero do viewer atual)
- `boost-tracking.functions.ts` chamado em onClick do CTA no `StatusViewer.tsx`
- Recharts já está no projeto (usado em outros admin tabs)
- i18n: novas chaves em `boost.*`
