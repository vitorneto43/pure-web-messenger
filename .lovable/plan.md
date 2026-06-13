## Objetivo

Permitir que visitantes (não logados) explorem o WaveChat sem criar conta, e só sejam levados ao cadastro quando tentarem uma ação que exige login. Tudo via web — o APK já existente puxa de `webconnectchat.com`, então **não precisa nova versão**.

## Acesso liberado (sem login)

- `/` — landing atual + botão destacado **"Explorar sem cadastro"**
- `/descobrir` (nova) — feed público com status públicos, pessoas recomendadas e grupos públicos
- `/u/$username` — perfis públicos (já existe; manter aberto)
- `/status/$id` (nova, se necessário) — ver status público individual compartilhável

## Ações que continuam exigindo login

Enviar mensagem, comentar, seguir, criar status, chamar, entrar em grupo, impulsionar conteúdo, reagir.

Comportamento: abrir um **modal "Crie sua conta para X"** explicando o benefício, com botões "Criar conta" e "Já tenho conta" — ambos levam pra `/auth` preservando o contexto (volta pra ação após login via `?redirect=`).

## Implementação técnica

1. **Server functions públicas** (`createServerFn` sem `requireSupabaseAuth`, usando `supabaseAdmin` internamente com projeção segura de colunas):
   - `getPublicStatuses({ limit, cursor })` — só status com `visibility = 'public'`
   - `getRecommendedProfiles({ limit })` — perfis públicos populares
   - `getPublicGroups({ limit })` — conversas grupo com flag pública (verificar schema; se não houver, listar só os com convite aberto)

2. **Nova rota `/descobrir`** (top-level, SSR ligado, com `head()` SEO próprio) renderizando os 3 blocos acima com infinite scroll. Reusa componentes de `StatusBar`, `PeopleYouMayKnow` adaptados pra modo "guest".

3. **Hook `useAuthGate()`** — wrapper que recebe um callback; se logado executa, se não abre `<AuthGateDialog />` com mensagem customizada por ação. Substitui os pontos onde hoje há `if (!user) return` silencioso.

4. **`<AuthGateDialog />`** — modal compartilhado com copy específica por ação (mensagem, seguir, comentar, etc), CTA para `/auth?redirect=<url-atual>`.

5. **Refatorar componentes públicos para aceitar `user = null`**:
   - `StatusViewer` — permite ver, mas reagir/comentar dispara gate
   - Perfil público — botão "Seguir" e "Mensagem" disparam gate
   - Cards de pessoas — botão "Seguir" dispara gate

6. **Landing (`/`)**: adicionar CTA "Explorar sem cadastro" ao lado do "Entrar".

7. **Auth page** — ler `?redirect=` e usar como `emailRedirectTo` / navigate pós-login.

## Fora de escopo nesta fase

- Lista pública de grupos com preview de mensagens (privacidade)
- Busca pública global (risco de abuso/scraping)
- Notificações para guests
- PWA install prompt para guests (manter)

## Riscos

- **Privacidade**: garantir que `getPublicStatuses` só retorna status marcados explicitamente como públicos e que perfis privados nunca vazem.
- **Abuso/scraping**: adicionar rate-limit básico nos endpoints públicos (já há infra? verificar).
- **SEO**: rotas públicas precisam de `head()` com OG tags próprias.

## Entrega sugerida (3 PRs incrementais)

**Fase 1** (este turno): server fns públicas + rota `/descobrir` + CTA na landing + `AuthGateDialog` base + integração em 1-2 pontos de prova (botão seguir no perfil público, reagir no status).

**Fase 2**: integrar gate em todos os pontos restantes (mensagem, comentar, criar status, chamar, impulsionar, entrar em grupo).

**Fase 3**: polish — preservar ação pós-login via `?redirect=` + intent restore, SEO das novas rotas, testes.

Confirma seguir com a **Fase 1** agora?
