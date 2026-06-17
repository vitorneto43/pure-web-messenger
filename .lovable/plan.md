# Agendamento + Gravação de Lives

Quatro recursos novos integrados ao que já existe:

## 1. Agendar posts

- Novo campo `scheduled_at` em `posts` + status `scheduled`.
- No `PostComposer`: botão "Agendar" abre date+time picker. Se data futura, salva como `scheduled` (não aparece no feed ainda).
- Cron `pg_cron` a cada minuto chama `/api/public/hooks/publish-scheduled` → publica posts com `scheduled_at <= now()`, dispara notificações normais.
- Aba "Agendados" no perfil pra editar/cancelar.

## 2. Agendar / programar lives

- Nova tabela `scheduled_lives` (host_id, title, cover_url, scheduled_at, status, reminder_sent_at, live_session_id).
- Tela `/live/new` ganha toggle "Ao vivo agora" / "Agendar live".
- Aparecem em `/live` numa seção "Em breve" com botão "Lembrar-me" (cria notificação).
- Cron a cada minuto:
  - **T-30min**: envia push/notification pros seguidores do host: "Fulano vai entrar ao vivo em 30 minutos: <título>" + deep-link pra live agendada. Marca `reminder_sent_at`.
  - **T-0**: host recebe notificação "Hora da sua live"; quando ele entra em `/live/new?scheduledId=...` cria a `live_session` normal e linka.

## 3. Agendar stories

- Adiciona `scheduled_at` + status `scheduled` em `statuses`.
- `CreateStatusDialog` ganha botão "Agendar".
- Mesmo cron publica stories agendados quando chega a hora (move pra `active`, define `expires_at = published_at + 24h`).

## 4. Gravar lives

- Toggle "Gravar esta live" no `/live/new` (e no painel do host durante a live).
- Usa **LiveKit Egress** (Room Composite Egress → MP4 no bucket Supabase Storage `live-recordings`).
- Server fns: `startLiveRecording` / `stopLiveRecording` (chamam API LiveKit com `LIVEKIT_API_KEY/SECRET`, assinam JWT egress).
- Nova tabela `live_recordings` (live_id, host_id, status, file_url, duration_sec, size_bytes, started_at, ended_at).
- Ao encerrar a live, egress para automaticamente; webhook do LiveKit (`/api/public/hooks/livekit-egress`) atualiza `live_recordings` com a URL final.
- Aba "Minhas gravações" no perfil do host com player + download + botão "Publicar como post de vídeo".

## Banco (resumo)

- `posts`: + `scheduled_at timestamptz`, status enum ganha `scheduled`.
- `statuses`: + `scheduled_at timestamptz`, status enum ganha `scheduled`.
- `scheduled_lives` (nova) — RLS: host gerencia a sua; anon lê próximas 7 dias; authenticated lê tudo público.
- `live_recordings` (nova) — RLS: host vê as suas; anon lê se a live era pública e o host marcou "publicar gravação".
- `live_reminders_sent` (nova, idempotência do cron).
- Webhook LiveKit egress: rota `/api/public/hooks/livekit-egress` valida assinatura LiveKit (header `Authorization` JWT HS256) antes de gravar.

## Cron (`pg_cron`)

Um job a cada minuto chama `/api/public/hooks/scheduler-tick` que:
1. Publica posts agendados.
2. Publica statuses agendados.
3. Envia lembretes T-30min de lives agendadas.
4. Notifica host no T-0.

## Frontend (componentes principais)

- `SchedulePickerSheet` (reutilizado por post/story/live).
- `ScheduledLiveCard` no feed `/live`.
- `RecordToggle` + `RecordingsTab` no perfil.
- Hooks: `useScheduledItems`, `useLiveRecordings`.

## Custos / observações

- LiveKit Egress: ~$0.004/min de gravação. Eu deixo o toggle desligado por padrão.
- Storage Supabase: gravações antigas (>30 dias) podem ser auto-removidas via cron — combino contigo depois.
- Não precisa rebuild Android (tudo no webview + backend).

Confirma que sigo? Posso entregar tudo de uma vez ou dividir em etapas (1º agendamentos, 2º gravação).
