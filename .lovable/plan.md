# Migração de Chamadas para LiveKit

## Situação atual

- **Lives e Meet**: já rodam em LiveKit (`LiveRoomShell`, `livekit-token.server.ts`, `livekit-egress.server.ts`). Nada muda.
- **Chamadas 1:1 do chat**: WebRTC manual (~940 linhas em `use-call.tsx`) com signaling via Supabase Realtime e ICE/TURN próprios. **É o que está falhando** e o que vamos substituir.
- **Chamadas em grupo do chat**: não existem hoje. Serão adicionadas reaproveitando o mesmo fluxo.

## O que muda

### Backend (server functions)
1. Nova função `createCallToken` em `src/lib/calls.functions.ts`:
   - Recebe `{ callId, role: 'caller'|'callee' }`, valida via `requireSupabaseAuth` que o usuário é parte da call.
   - Gera token LiveKit com `room = call-${callId}`, `canPublish: true`, identity = userId.
   - Reaproveita `createLiveKitToken` já existente.
2. Função `startCallRecording` / `stopCallRecording` espelhando `startLiveRecording` (reaproveita `livekit-egress.server.ts` e bucket `live-recordings`, adiciona coluna `call_id` em `live_recordings` ou cria tabela `call_recordings` paralela — usaremos `live_recordings` com `call_id` nullable pra simplificar).
3. Manter tabela `calls` como está (mesmo schema de status/signaling de ringing/accepted/declined/ended).

### Frontend
4. Reescrever `src/hooks/use-call.tsx`:
   - Remover toda a lógica de `RTCPeerConnection`, ICE candidates, offer/answer, `getUserMedia`, `setupSignaling` baseado em Realtime.
   - Manter intactos: ringing (toque), `IncomingCallDialog`, push notifications, `IncomingCallKit` nativo (Android), inserção da mensagem de chamada (`[[CALL:...]]`), histórico, registro em `calls`.
   - Substituir conexão de mídia por: assim que `accepted`, ambos chamam `createCallToken` e renderizam um `<LiveKitRoom>` invisível dentro do `CallScreen`.
5. Adaptar `src/components/call/CallScreen.tsx`:
   - **Visual idêntico ao atual** (avatar grande, timer, controles mic/cam/end).
   - Por baixo: usar `useTracks`, `useLocalParticipant`, `useRemoteParticipants` do `@livekit/components-react` para vídeo/áudio e toggles.
   - Botão "Gravar" (só pro caller) que chama `startCallRecording`.
6. Sinalização restante (ringing, accept, decline, end) continua via tabela `calls` + Realtime — só a parte de mídia muda.

### Group calls (chat de grupo)
7. Botão "Chamar grupo" no header do `ChatWindow` quando `conversation.is_group`.
8. Cria uma `call` com `kind` + `room = call-${callId}` e push para todos os membros. Mesmo fluxo do 1:1, mas `<LiveKitRoom>` aceita N participantes naturalmente.

### Limpeza
9. Deletar `src/lib/ice-servers.functions.ts` (não há mais signaling manual).
10. Remover dependência implícita de TURN próprio.

## Detalhes técnicos

```text
Fluxo da chamada 1:1
────────────────────
caller clica ligar
  └─> insert em `calls` (status=ringing)
  └─> push + IncomingCallKit no callee
callee aceita
  └─> update calls.status=accepted
  └─> ambos chamam createCallToken({callId, role})
  └─> ambos montam <LiveKitRoom token={...}> dentro do CallScreen
  └─> LiveKit cuida de SDP/ICE/TURN automaticamente
qualquer um encerra
  └─> update calls.status=ended, duration
  └─> LiveKitRoom desmonta → desconecta
```

## Riscos / fora de escopo

- Não vou mexer em `LiveRoomShell`, `live.$liveId.tsx`, `meet.$roomId.tsx` (já LiveKit).
- Não vou tocar em `IncomingCallKit` Android — o plugin nativo continua sendo apenas o "telefone tocando", a mídia vem do LiveKit depois.
- Gravação 1:1 grava o **room composite** (igual lives). Sem opção de gravar só áudio nesta fase.
- Custo LiveKit por participante-minuto se aplica a 1:1 também (~US$0.0015/min vídeo, áudio mais barato). Para 100 ligações de 5min, ~US$1,50.

## Pode confirmar?
Posso seguir e implementar tudo isso de uma vez?