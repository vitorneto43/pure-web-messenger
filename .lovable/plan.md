# Ligações de voz e vídeo no Wavechat

Vou implementar **chamadas 1:1 de voz e vídeo** dentro do chat existente, usando **WebRTC** no navegador e **Supabase Realtime** como canal de sinalização (sem precisar de servidor próprio).

## O que o usuário verá

- Dois novos botões no topo da janela de conversa 1:1: **📞 Ligar** e **🎥 Vídeo**.
- Ao clicar, abre uma tela de chamada em tela cheia mostrando:
  - Vídeo local (pequeno, canto) e vídeo remoto (grande) — para chamadas de vídeo.
  - Avatar grande + nome — para chamadas só de voz.
  - Botões: mutar microfone, ligar/desligar câmera, encerrar.
- O outro usuário recebe uma **tela de chamada recebida** com toque, mostrando avatar e nome, com botões **Aceitar** / **Recusar**.
- Se recusar / não atender / cair: notificação de "Chamada perdida" na conversa.
- Funciona apenas em conversas 1:1 nesta primeira versão (grupos ficam para depois).

## Como funciona por baixo (resumo técnico)

- **WebRTC peer-to-peer** entre os dois navegadores (áudio/vídeo vai direto, não passa pelo servidor).
- **Sinalização** (offer/answer/ICE candidates) viaja por um Supabase Realtime channel exclusivo da chamada (`call:{callId}`).
- **STUN público do Google** (`stun:stun.l.google.com:19302`) para atravessar NAT. Sem TURN — em redes muito restritivas (algumas corporativas/celular) a chamada pode falhar; nesse caso mostro mensagem clara. Adicionar TURN depois é só trocar config.
- Nova tabela `calls` (id, conversation_id, caller_id, callee_id, kind 'audio'|'video', status 'ringing'|'accepted'|'declined'|'missed'|'ended', timestamps) só para histórico e detectar chamada recebida via Realtime.
- Listener global de chamadas recebidas montado no layout `_authenticated` para tocar em qualquer página.

## Arquivos a criar/alterar

- `supabase/migrations/...sql` — tabela `calls` + RLS + realtime.
- `src/hooks/use-call.tsx` — provider/contexto com toda lógica WebRTC (peer connection, signaling, estados).
- `src/components/call/CallScreen.tsx` — UI da chamada ativa (vídeos, controles).
- `src/components/call/IncomingCallDialog.tsx` — modal de chamada recebida com toque.
- `src/components/chat/ChatWindow.tsx` — adicionar botões 📞 e 🎥 no header.
- `src/routes/_authenticated.tsx` — montar `CallProvider` + `IncomingCallDialog` globais.
- `src/lib/notification-sound.ts` — adicionar som de toque (reuso da estrutura existente).

## Limitações desta versão

- Apenas 1:1 (não grupo).
- Sem TURN server → pode falhar em redes muito fechadas.
- Sem gravação de chamada.
- Sem compartilhamento de tela (fácil adicionar depois).

Posso começar?