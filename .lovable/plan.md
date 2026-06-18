# Pacote: políticas, moderação automática e impulsionamento segmentado

Implementação dividida em 4 frentes. Tudo aproveita a infra que já existe (`status_boosts`, `post_boosts`, `boost-pricing`, `boost-analytics`, RPCs `get_boost_report` / `admin_boost_overview`, dict `boost-report`, `spam-detector`, `moderation_actions`, `ai-assistant.functions`).

---

## 1) Políticas em `/diretrizes`

Adicionar três seções dedicadas dentro da página `src/routes/diretrizes.tsx` (sem criar rotas novas):

- **Posts** — proibido: spam, pirataria/IPTV, conteúdo adulto não-rotulado, golpes financeiros/cripto, links de phishing, conteúdo infantil. Permitido: opinião, divulgação pessoal, conteúdo informativo.
- **Stories** — mesmas regras + proibição de nudez explícita, gore, automutilação, apologia a drogas/violência.
- **Lives** — mesmas regras + proibição de transmissão de TV/futebol/filmes (direitos autorais), jogos de azar, venda de medicamentos controlados, e regras de moderação ao vivo (mute/kick/ban).

Cada seção com âncora (`#posts`, `#stories`, `#lives`) para os avisos da app linkarem direto.

---

## 2) Moderação automática híbrida (regras locais + IA)

### Camada 1 — regras locais (gratuitas)
Novo módulo `src/lib/content-policy.ts` com listas de:
- `BLOCKED_KEYWORDS` (iptv, futebol grátis, "robô da blaze", cracker, cp, etc)
- `BLOCKED_DOMAINS` (encurtadores duvidosos, sites de IPTV, etc)
- `ADULT_KEYWORDS`, `GAMBLING_KEYWORDS`, `COPYRIGHT_KEYWORDS`
- Função `scanLocally(text, kind: "post" | "status" | "live" | "boost")` → `{ verdict: "ok" | "warn" | "block", reasons: string[] }`

### Camada 2 — IA (Lovable AI Gateway)
Nova server fn `moderateContentAI(text, kind)` em `src/lib/content-moderation.functions.ts`:
- Modelo `google/gemini-3-flash-preview` via gateway
- Schema estruturado: `{ verdict: "ok" | "review" | "block", category: string, confidence: 0-1, reason: string }`
- Só chamada quando a camada 1 passar (economia)

### Pontos de aplicação (UX)
- **Aviso ao vivo no compose**: `PostComposer`, `CreateStatusDialog`, `live.new` — `useDebouncedValue(text, 500)` chama `scanLocally`; se `block`, mostra banner vermelho com motivo e desabilita "Publicar"; se `warn`, mostra banner amarelo (deixa publicar).
- **Antes de submeter**: roda IA. Se `block`, mostra dialog "Conteúdo recusado: <motivo> · ver Diretrizes".
- **Impulsionamento**: ao criar boost, status fica `under_review`. Server fn `submitBoostForReview` roda local+IA. Se aprovado → status `pending_payment` ou `active` (conforme fluxo atual). Se reprovado → reembolso automático via Stripe (já existe lógica de refund) e `boost_review_results` recebe registro.

---

## 3) Status "em análise" nos impulsionamentos

### DB (migração)
- Adicionar enum value `under_review` a `boost_status` (se existir) ou coluna `review_status text default 'pending'` em `status_boosts` e `post_boosts`.
- Nova tabela `boost_review_results` (boost_id, kind, verdict, category, reason, reviewed_at, reviewer: `auto_local|auto_ai|admin`).
- RLS: dono lê os próprios; service_role e admins leem tudo.

### Fluxo
1. Usuário cria boost → server fn `submitBoostForReview` cria o boost com `review_status='under_review'` e dispara moderação síncrona (regras+IA, ~2-3s).
2. Aprovado → checkout Stripe; pago → `active`.
3. Reprovado → toast + email + linha em `boost_review_results` com motivo legível. Dinheiro nunca foi cobrado.

UI: badge "Em análise" na `BoostHistory` enquanto pendente, com tooltip explicando.

---

## 4) Segmentação por idade, sexo e interesses + relatórios

### Interesses
- Novo enum/lista fixa `INTERESTS` em `src/lib/interests.ts` (~24 categorias: Música, Esportes, Tech, Moda, Games, Comida, Viagem, Beleza, Carros, Arte, Cinema/TV, Livros, Fitness, Negócios, Educação, Pets, Família, Espiritualidade, Política, Saúde, Humor, Notícias, Casamento, DIY).
- Coluna `interests text[]` em `profiles` (já tem? checar — senão migração).
- Tela de perfil: editor multi-seleção (chips) com cap de 8 interesses.
- Sinais derivados: nova view materializada `profile_derived_interests` que junta hashtags seguidas + grupos do usuário e infere interesses (mapa hashtag→interesse mantido em código).

### Segmentação no PostBoostDialog/BoostDialog
Já existe `ageMin/ageMax/gender` no `boost-pricing`. Adicionar:
- Seletor de idade (slider duplo 13–80, default 18–65).
- Seletor de sexo (radio: todos / masculino / feminino).
- Seletor de interesses (multi-select chips, opcional, +15% CPM se usar).
- Estados + países (já tem).
- Estimativa de alcance em tempo real (já tem; atualizar fórmula em `estimateViews` para considerar penalty de interesses).

Persistir em colunas novas: `target_interests text[]`, e garantir que `target_age_min/max/gender` existam (provavelmente já existem, validar).

### Entrega segmentada
Atualizar a RPC/view que decide quem vê o status/post impulsionado:
- Filtrar por `profile.birth_date` (calcular idade) ∈ [min,max]
- Filtrar por `profile.gender` se ≠ "all"
- Filtrar por `interests && target_interests` (intersect array) se segmentou
- Filtrar país/estado já implementado

### Relatórios
Estender RPC `get_boost_report` para retornar:
- `by_age` (faixas: 13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+) — count + cost
- `by_gender` (já existe, validar) — count + cost
- `by_state` (já existe)
- `by_country` (já existe)
- `by_interest` (NOVO) — count + cost por interesse alcançado

UI `BoostReportDialog`: adicionar uma nova aba/seção "Interesses" com gráfico de barras, e garantir que age/gender estão visíveis (dict `boost-report.ts` já tem `byAge`/`byGender`/`byCountry`/`byState` — adicionar `byInterest`).

### Tradução
Adicionar chaves em `src/i18n/dicts/boost-report.ts` (10 idiomas, igual padrão atual):
- `boostReport.byInterest` = "Interesses que mais viram"
- `boostReport.interest.<key>` para nome do interesse

---

## Detalhes técnicos

**Migrações necessárias** (1 só):
- `profiles.interests text[] default '{}'`
- `status_boosts.target_interests text[] default '{}'`, `status_boosts.review_status text default 'approved'`, `status_boosts.review_reason text`
- `post_boosts.target_interests text[] default '{}'`, idem review_*
- Tabela `boost_review_results`
- RPC `get_boost_report` v2 (mantém compatibilidade)
- Trigger em `INSERT` de boosts para iniciar em `under_review` (a server fn marca aprovado após scan).
- GRANTs corretos.

**Server fns novas** (`src/lib/content-moderation.functions.ts`):
- `scanContent({ text, kind })` — roda local+IA, retorna verdict
- `submitBoostForReview({ boostId })` — usado no fluxo de criação
- `adminReviewBoost({ boostId, verdict, reason })` — para admins

**Arquivos editados** (principais):
- `src/routes/diretrizes.tsx` — 3 seções novas
- `src/components/posts/PostComposer.tsx`, `src/components/status/CreateStatusDialog.tsx`, `src/routes/live.new.tsx` — aviso ao vivo
- `src/components/posts/PostBoostDialog.tsx`, `src/components/status/BoostDialog.tsx` — interesses + slider idade
- `src/components/status/BoostReportDialog.tsx` — gráficos novos
- `src/lib/boost-pricing.ts` — penalty interesses
- `src/components/profile/*` ou rota profile — editor de interesses
- `src/lib/content-policy.ts`, `src/lib/interests.ts` — novos
- `src/i18n/dicts/boost-report.ts` — chaves novas (10 idiomas)

**Custo IA**: Gemini Flash, ~$0.0001 por scan. Boost = 1 scan; post = 1 scan no submit. Insignificante.

---

## Ordem de execução

1. Migração DB (revisada por você antes de rodar).
2. Módulos puros: `content-policy.ts`, `interests.ts`, atualizar `boost-pricing.ts`.
3. Server fns de moderação + revisão.
4. UI: avisos no compose, editor de interesses no perfil.
5. UI: dialogs de boost com idade/sexo/interesses + estimativa.
6. UI: relatórios com novos breakdowns.
7. Atualizar `/diretrizes`.
8. Traduções (10 idiomas).

Estimativa: ~25-30 arquivos novos/editados + 1 migração grande. Posso entregar tudo em sequência, te avisando ao final de cada bloco para você testar.