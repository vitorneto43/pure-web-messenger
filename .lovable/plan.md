## O que será entregue

Quando alguém te ligar (voz ou vídeo), você recebe uma **notificação do navegador com som**, mesmo se o site estiver fechado. Tocar na notificação abre o app já na tela de chamada. Os botões "Atender" e "Recusar" aparecem direto na notificação.

## Como o usuário ativa

1. Na primeira vez que abrir o app depois desta atualização, aparece um pedido: **"Receber notificações de chamada?"**
2. Ao aceitar, o dispositivo fica registrado e passa a receber chamadas mesmo com a aba fechada.
3. No iPhone: precisa **adicionar o site à tela inicial** (Compartilhar → Adicionar à Tela de Início). Sem isso, a Apple não permite push. No Android e desktop funciona direto.

## Limites importantes (do navegador, não dá pra contornar)

- O som é o som padrão de notificação do sistema (curto, ~1-2s). Navegadores não permitem tocar um ringtone longo contínuo com o site fechado.
- No celular o navegador precisa estar instalado (não precisa estar aberto, mas precisa existir no aparelho).
- Push só funciona no site **publicado** (`pure-web-messenger.lovable.app`), não no preview do editor.

## Passos da implementação

1. **Tabela `push_subscriptions`** (user_id, endpoint, p256dh, auth, user_agent) com RLS — cada usuário só vê/edita as próprias.
2. **Service worker** (`public/sw.js`) que escuta evento `push` e mostra notificação com ações Atender/Recusar; ao clicar abre a URL da chamada.
3. **Manifest** (`public/manifest.json`) básico para permitir instalação como PWA (necessário no iOS).
4. **Registro do SW + permissão**: hook que pede permissão de notificação após login, registra o SW, cria a `PushSubscription` com a chave VAPID pública e salva no banco.
5. **Chaves VAPID**: geradas uma vez; a pública vai no código (publishable), a privada e o "subject" (email) ficam como secrets do servidor.
6. **Server function `sendCallPush`**: chamada pelo `startCall` logo após inserir na tabela `calls`. Busca as subscriptions do `callee_id`, envia o push usando a biblioteca `web-push`. Remove subscriptions inválidas (410/404).

## Detalhes técnicos

- Manifest mínimo (`display: "standalone"`, ícone existente, sem cache estratégico — sem `vite-plugin-pwa`).
- `public/sw.js` puro, sem caching de assets, só handlers `push` e `notificationclick`. Isso evita os problemas conhecidos de service worker no preview do Lovable.
- Registro do SW guardado por `if (!isIframe && !isPreviewHost)` para não rodar no editor.
- `web-push` é puro JS e roda no Worker do TanStack Start sem nativos.
- Secrets necessários: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto). Vou gerar as chaves e pedir confirmação antes de salvar.
- Payload do push: `{ callId, callerName, kind, conversationId }` — usado pelo SW pra montar a notificação e pelo clique pra abrir `/chat/{conversationId}` já com a chamada ativa.

## Arquivos a criar/alterar

- `supabase/migrations/...` — tabela `push_subscriptions` + RLS.
- `public/sw.js` — service worker minimalista de push.
- `public/manifest.json` — manifest para instalação.
- `src/hooks/use-push.tsx` — registra SW, pede permissão, salva subscription.
- `src/lib/push.functions.ts` — `sendCallPush` (server fn com `web-push`).
- `src/routes/__root.tsx` — link do manifest na `<head>`.
- `src/routes/_authenticated.tsx` — montar `usePush()` global.
- `src/hooks/use-call.tsx` — chamar `sendCallPush` após inserir o `calls`.

Posso prosseguir?