## Situação atual

Já existe cross-post ("Ambos") em Posts, Stories e WaveTube — cada um insere duas linhas (uma com `ecosystem_id`, outra pública). **O que falta** é a peça estratégica que você descreveu: **a instituição precisa decidir se seus membros podem ou não expor conteúdo do ecossistema para toda a WaveChat**. Hoje qualquer membro pode marcar "Ambos" e vazar conteúdo publicamente, mesmo em ecossistemas sigilosos (governo, corporativo). Além disso, **Lives ainda não suportam "Ambos"** — só público OU só ecossistema.

## O que vou implementar

### 1. Controle no nível do ecossistema (admin decide)

Migração adicionando:

- `ecosystems.allow_public_crosspost boolean not null default true`
  Quando `false`, os membros só conseguem publicar em modo "Só ecossistema". A UI esconde a opção "Ambos" e "Público". O servidor rejeita cross-post via trigger, não só na UI.
- `ecosystems.public_crosspost_requires_admin boolean not null default false`
  Modo intermediário opcional: apenas admins/moderadores do ecossistema podem cross-postar publicamente. Membros comuns ficam restritos ao ecossistema.

Trigger `enforce_ecosystem_crosspost_policy()` em `posts`, `statuses`, `videos`, `live_sessions`: quando uma linha pública (`ecosystem_id IS NULL`) for inserida como cross-post de um ecossistema (nova coluna `crossposted_from_ecosystem_id uuid`), valida a política do ecossistema e a role do autor. Bloqueia com mensagem clara em caso de violação.

### 2. Suporte a "Ambos" em Lives

- Adicionar coluna `live_sessions.public_crosspost boolean default false`.
- Estender `start_live` RPC para aceitar `p_public_crosspost`.
- Atualizar `get_ecosystem_active_lives` e feeds públicos de descoberta de lives (Stories/Discover) para incluir lives de ecossistema quando `public_crosspost = true` — respeitando a política acima.
- `live.new.tsx`: usar `PublishTargetPicker` (já suporta "Ambos") e passar a flag para o RPC.

### 3. UI do PublishTargetPicker consciente da política

- `useEcosystems` passa a expor `allow_public_crosspost` e `public_crosspost_requires_admin` por ecossistema.
- O picker esconde/desabilita "Ambos" (e "Público" quando o membro só vê o ecossistema) conforme a política + role do usuário atual.
- Mensagem contextual: "Sua instituição restringiu a publicação ao ecossistema."

### 4. Página de configurações do ecossistema

Em `/e/$slug/settings` (admin/owner):

- Toggle **"Permitir que membros publiquem também no feed público da WaveChat"**.
- Sub-toggle: **"Restringir cross-post público a admins/moderadores"**.
- Texto explicativo sobre as três estratégias (interno / público / híbrido).

### 5. RLS e retrocompatibilidade

- Linhas antigas com `ecosystem_id IS NULL` continuam públicas normalmente (default `allow_public_crosspost = true` preserva o comportamento atual para ecossistemas existentes).
- Coluna `crossposted_from_ecosystem_id` é NULL para conteúdo nativo público — nenhum feed público muda.
- Politicas RLS não mudam: quem escreve continua sendo o dono; a validação é via trigger BEFORE INSERT.

## Detalhes técnicos

```text
ecosystems
├── allow_public_crosspost           bool  default true
└── public_crosspost_requires_admin  bool  default false

posts / statuses / videos / live_sessions
└── crossposted_from_ecosystem_id    uuid  nullable
     (preenchido pelo cliente na linha pública quando kind=both)

trigger enforce_ecosystem_crosspost_policy() BEFORE INSERT:
  if NEW.crossposted_from_ecosystem_id is not null:
    fetch eco settings
    if not allow_public_crosspost: RAISE 'Cross-post público desativado por este ecossistema'
    if public_crosspost_requires_admin and not is_ecosystem_admin(user, eco):
      RAISE 'Apenas admins deste ecossistema podem publicar no feed público'
```

Componentes tocados:

- `supabase migration` (schema + trigger + `start_live` RPC + `get_ecosystem_active_lives`)
- `src/components/PublishTargetPicker.tsx`
- `src/hooks/use-ecosystem.ts` (tipagem)
- `src/routes/live.new.tsx` (picker + flag)
- `src/routes/_authenticated/ecosystem.$slug.settings.tsx` (ou existente)
- `PostComposer`, `CreateStatusDialog`, `wavetube.upload.tsx` — passar `crossposted_from_ecosystem_id` na linha pública quando `kind=both`

## Fora do escopo

- Scheduled posts/lives com "Ambos" (hoje limitado a público) — mantido como está.
- Migrar rows antigas — não é necessário; default preserva comportamento.
