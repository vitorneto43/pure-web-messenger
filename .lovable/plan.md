# Atualização WaveChat — escopo completo

Mantendo `appName: WaveChat` e package `com.wavechat.app`. Sem quebrar login, grupos, mensagens, status, chamadas atuais ou PWA. Mesmo banco (com migrações).

> **Aviso**: você disse antes que queria fazer a parte de **privacidade de entrada** só depois de entrar em produção (app já está em teste fechado na Play Store). Confirme se quer que eu já implemente agora junto com o resto, ou se devo deixar o item 1 para depois e seguir com 2–5.

---

## 1. Privacidade de entrada

- Alterar `handle_new_user()`: remover o broadcast `'new_user'` para todos os usuários. Manter apenas a notificação `'invite_accepted'` para quem convidou.
- Reforçar regra: usuários só conversam se forem contatos, convidados ou membros do mesmo grupo. As policies atuais (`profiles` via `users_share_conversation`, `messages` via `is_conversation_member`) já fazem isso — adicionar verificação no `NewChatDialog` para só permitir iniciar conversa com quem tem vínculo (`users_share_conversation` ou foi convidado por você).
- `search_users()`: restringir para retornar apenas quem o usuário convidou, foi convidado por, ou já compartilha conversa.

## 2. Badge e notificações

Hoje o badge já conta mensagens não lidas + notificações. Estender para incluir chamadas perdidas/recebidas pendentes:

- Adicionar coluna `seen_at` em `calls` (ou usar `notifications` tipo `missed_call` / `incoming_call`).
- `useAppBadgeSync` passa a somar: mensagens não lidas + notificações não lidas + chamadas com status `ringing`/`missed` ainda não vistas pelo callee.
- Service worker (`public/sw.js`) já atualiza badge via `postMessage`; garantir que push de chamada e push de mensagem incrementam o contador persistido mesmo com app fechado.
- Ao abrir conversa → marca `last_read_at` (já existe). Ao atender/dispensar chamada → marca call como vista.

## 3. Indicador de digitação

A tabela `typing_indicators` já existe. Falta UI consistente:

- Hook `useTyping(conversationId)` que faz upsert com debounce ao digitar em `ChatWindow` e remove após 4s de inatividade.
- Em `ChatWindow`/`ChatSidebar`, ler via realtime e mostrar:
  - 1:1 → "digitando…"
  - Grupo → "Fulano está digitando…" (ou "Fulano e Beltrano estão digitando…")
- Auto-expira pelo `updated_at > now() - 6s`.

## 4. Chamadas em grupo

Mudança maior. O schema atual de `calls` é 1:1 (`caller_id` + `callee_id`).

- Migração: criar `call_participants(call_id, user_id, state, joined_at, left_at)` onde `state` ∈ `ringing|joined|declined|left|missed`. Manter `calls.callee_id` nullable para retrocompatibilidade ou marcar `is_group`.
- Botão **"Iniciar chamada"** no header de grupos (ChatWindow) — áudio e vídeo.
- Notificar todos os membros via FCM/web push (reaproveitar `WaveChatMessagingService` com `type=call` + lista de tokens dos membros do grupo).
- WebRTC: mesh para até N participantes (limite prático ~6). Refatorar `use-call.tsx` + `CallScreen` para múltiplos `RTCPeerConnection`.
- Mostrar eventos: entrou / saiu / recusou em tempo real (realtime na tabela `call_participants`).
- Garantir parar ringtone em todos os dispositivos quando call.status muda para `active|ended` (já parcial, reforçar via realtime e `stopNativeRinging`).

## 5. Apagar mensagens

- Migração: adicionar `deleted_for_everyone_at timestamptz`, `deleted_for jsonb default '[]'` em `messages`.
- **Apagar só para mim** → adiciona meu user_id em `deleted_for`. Cliente filtra.
- **Apagar para todos** → permitido se `now() - created_at < interval '1 hour'` e `sender_id = auth.uid()`. Seta `deleted_for_everyone_at` e zera `content`/`attachment_*`.
- UI: menu de contexto na mensagem com as duas opções. Renderizar "Esta mensagem foi apagada" em itálico quando `deleted_for_everyone_at` não for nulo.

## 6. Compatibilidade

- Nenhuma alteração em login/cadastro além de `handle_new_user`.
- Mesmo `appName`/package — sem rebuild de identidade Android.
- Migrações puramente aditivas (novas colunas/tabelas), nada destrutivo.
- PWA, status, sons, ringtone, FCM continuam funcionando.

---

## Detalhes técnicos

```text
Migrações SQL:
  - ALTER FUNCTION handle_new_user (remove broadcast 'new_user')
  - ALTER FUNCTION search_users (filtro por vínculo)
  - ALTER TABLE messages ADD deleted_for_everyone_at, deleted_for
  - CREATE TABLE call_participants + RLS + GRANT + realtime publication
  - (opcional) ALTER TABLE calls ADD is_group bool default false

Código:
  - src/lib/messages.functions.ts        (deleteForMe, deleteForEveryone)
  - src/hooks/use-typing.tsx             (novo)
  - src/components/chat/TypingIndicator.tsx (novo)
  - src/hooks/use-call.tsx               (multi-peer)
  - src/components/call/CallScreen.tsx   (grade de participantes)
  - src/components/chat/ChatWindow.tsx   (botão "Iniciar chamada" em grupo, menu apagar, typing)
  - src/hooks/use-app-badge.tsx          (soma chamadas pendentes)
  - public/sw.js                         (badge em push de chamada)
  - android/.../WaveChatMessagingService.java (payload de chamada de grupo)
```

Risco maior: refator de WebRTC para grupo. Resto é incremental.

---

**Confirme dois pontos antes de eu começar:**

1. Implementar **item 1 (privacidade de entrada) agora** ou deixar pra depois conforme combinamos?
2. Limite de tempo para "apagar para todos": **1 hora** está bom (padrão WhatsApp era ~7 min, hoje ~2 dias)?
