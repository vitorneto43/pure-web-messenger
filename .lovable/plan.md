# Sistema de Lives no WaveChat

Lives ao vivo (1 host → milhares de viewers) usando **LiveKit Cloud** como servidor de mídia, integradas ao app existente sem rebuild Android (as permissões de câmera/microfone já estão no `AndroidManifest` por causa das chamadas).

## O que será entregue

### 1. Rotas e telas novas

```text
/live                       → feed de lives ativas agora (público)
/live/new                   → tela de "Ir ao vivo" (host) — gated por login
/live/$liveId               → tela de live (viewer ou host)
```

- Card de live no feed `/posts` quando o autor estiver ao vivo.
- Botão "Ao vivo" no header do `/chat` e no perfil do usuário.

### 2. Recursos da live

- **Vídeo + áudio HD** do host via WebRTC (LiveKit).
- **Chat ao vivo** com mensagens rolando, envio instantâneo (Supabase Realtime).
- **Reações flutuantes** (❤️ 🔥 👏 😂 🎉) animadas na tela.
- **Contador de espectadores + lista** ("quem está assistindo" com avatares).
- **Convidar pra subir no palco**: host aprova pedidos, até 4 convidados publicam vídeo/áudio junto. Convidado pode pedir, host aceita/recusa, host pode "tirar do palco".
- **Presentes pagos** (moedas WaveCoins): catálogo de presentes (🌹 Rosa, 🦁 Leão, 🚀 Foguete etc.), comprados com moedas (compradas via Stripe), aparecem animados na live, top doadores ranqueados no painel da live.
- **Denunciar / bloquear** o host (reusa `ReportContentDialog`).
- **Encerrar live** pelo host; viewers veem mensagem "Live encerrada".
- **Notificação** para seguidores quando alguém entra ao vivo (push + sino).
- **Compartilhar link** da live (Open Graph com thumbnail do host).

### 3. O que NÃO entra nesta primeira versão

- Replay/gravação automática (LiveKit suporta, mas adiciona custo — pode vir depois).
- Stream para YouTube/Twitch via RTMP.
- Filtros faciais / AR.
- Co-host vendo a mesma tela (multi-host está incluso via "palco", até 4 pessoas; isso cobre o caso de uso).

## Tecnologia

- **LiveKit Cloud** (free tier: 100 GB egress/mês, milhares de viewers concorrentes). Você cria a conta em livekit.io e me passa as 3 credenciais.
- **Backend**: server functions TanStack que mintam tokens JWT do LiveKit (HS256 via Web Crypto — compatível com o runtime do Lovable Cloud, sem pacote nativo).
- **Frontend**: `@livekit/components-react` + `livekit-client` (puro WebRTC do navegador, funciona no Capacitor sem rebuild).
- **Chat/reações/palco-requests**: Supabase Realtime nas novas tabelas.
- **Presentes pagos**: reaproveita o sistema Stripe já existente do app.

## Banco de dados (novas tabelas)

- `live_sessions` — host, título, capa, status (live/ended), `viewer_count`, contagem de presentes/curtidas, timestamps.
- `live_chat_messages` — mensagens da live (chat efêmero, TTL curto).
- `live_reactions` — emoji burst (TTL curto, agregado por minuto).
- `live_stage_requests` — pedidos pra subir no palco (pending/approved/rejected/kicked).
- `live_viewers` — heartbeat de quem está assistindo (limpa após X min sem ping).
- `live_gifts_catalog` — catálogo de presentes (nome, emoji/animação, custo em moedas).
- `live_gifts_sent` — presente enviado (live_id, viewer_id, gift_id, qty, moedas gastas).
- `user_coins` — saldo de moedas do usuário (já pode existir? checo antes).
- `coin_purchases` — compras de pacotes de moedas via Stripe.

Tudo com RLS, GRANTs e policies (anon lê live ativa + chat; autenticado escreve chat/reações/presentes; host edita a própria live).

## Pacotes de moedas (Stripe)

Crio 4 produtos no Stripe (você ajusta os preços depois):
- 100 moedas — R$ 4,90
- 500 moedas — R$ 19,90
- 1 200 moedas — R$ 39,90 (bônus +200)
- 5 000 moedas — R$ 149,90 (bônus +1 000)

Webhook Stripe credita as moedas em `user_coins` após pagamento.

## Segredos que você precisa fornecer

Depois que aprovar o plano, vou pedir três variáveis via formulário seguro:

1. `LIVEKIT_API_KEY`
2. `LIVEKIT_API_SECRET`
3. `LIVEKIT_WS_URL` (algo como `wss://seuprojeto.livekit.cloud`)

Como obter: criar conta em https://cloud.livekit.io → Project → Settings → Keys.

## Rebuild Android?

**Não precisa.** O AndroidManifest atual (das chamadas WebRTC) já contém `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` e o `<uses-feature>` de câmera. O `livekit-client` usa as mesmas APIs do navegador (`getUserMedia`), então abre o request de permissão automaticamente na webview do Capacitor.

## Ordem de implementação

1. Migration: criar todas as tabelas, RLS, GRANTs, RPCs (`start_live`, `end_live`, `join_live`, `send_gift`, `request_stage`, `approve_stage`).
2. Pedir os 3 secrets do LiveKit.
3. Server functions: `mintLiveKitToken` (host/viewer/guest), `purchaseCoinsCheckout`, `sendLiveGift`.
4. Webhook Stripe: tratar `coin_purchase` e creditar `user_coins`.
5. Instalar `@livekit/components-react` + `livekit-client`.
6. Componentes: `LiveStudio` (host), `LiveViewer`, `LiveChat`, `LiveReactions`, `LiveStagePanel`, `LiveGiftSheet`, `LiveCard`.
7. Rotas `/live`, `/live/new`, `/live/$liveId`.
8. Integração: card de live no feed, botão no header do chat, push notification para seguidores.

## Custos a ter em mente

- LiveKit Cloud free tier cobre bem para começar; depois disso é ~$0,12/GB de egress (cerca de R$ 0,06 por viewer-hora em SD).
- Stripe: taxa padrão por transação dos pacotes de moedas.

Confirma o plano que eu sigo: peço os secrets do LiveKit e implemento ponta a ponta.
