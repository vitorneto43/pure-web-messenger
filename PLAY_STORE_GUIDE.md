# WaveChat - Publicar na Google Play Store

Guia passo a passo para publicar o WaveChat na Play Store **pelo celular**, sem computador.

---

## Passo 1: Criar conta de desenvolvedor Google Play

1. Acesse pelo celular: https://play.google.com/console
2. Toque em **Criar conta de desenvolvedor**
3. Pague a taxa única de **$25 dólares** (cartão de crédito)
4. Complete seus dados de perfil
5. Aguarde a verificação (geralmente instantânea, às vezes 1-2 dias)

> **Dica:** Use o mesmo e-mail da sua conta Google principal.

---

## Passo 2: Criar o app na Play Console

1. No Google Play Console, toque em **Criar app**
2. Preencha:
   - **Nome do app:** WaveChat
   - **Idioma padrão:** Português (Brasil)
   - **Tipo de app:** App ou jogo → **App**
   - **Preço:** Gratuito
3. Toque em **Criar app**

---

## Passo 3: Configurar a assinatura do app (obrigatório)

A Play Store exige que todos os apps sejam assinados digitalmente.

### Opção A: Deixar o Google gerenciar (RECOMENDADO)

1. No Play Console, vá em **Configuração** → **Assinatura do app** (App signing)
2. Escolha **Permitir que o Google crie e gerencie a chave de assinatura do app**
3. Toque em **Criar**

Com isso, o Google gera e guarda a chave principal do app. Você só precisa de uma chave temporária para fazer o upload.

---

## Passo 4: Gerar o AAB (Android App Bundle) no GitHub Actions

O AAB é o formato obrigatório para novos apps na Play Store.

### 4.1 Adicionar secrets no GitHub (se ainda não tiver)

Vá em: **https://github.com/vitorneto43/pure-web-messenger** → **Settings** → **Secrets and variables** → **Actions**

Adicione (se não tiver):

| Nome | Valor | Onde pegar |
|------|-------|------------|
| `VITE_SUPABASE_URL` | URL do backend | Arquivo `.env` no Lovable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública | Arquivo `.env` no Lovable |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto | Arquivo `.env` no Lovable |

### 4.2 Rodar o build de Release

1. No GitHub, vá em **Actions** (topo do repo)
2. Menu lateral → **Build Android Release (AAB + APK)**
3. Toque em **Run workflow**
4. Em **build_type**, selecione: **`aab`**
5. Toque no botão verde **Run workflow**
6. Aguarde ~10 minutos

### 4.3 Baixar o AAB

Quando terminar (bolinha verde ✓):

1. Toque no build que terminou
2. Role até embaixo → seção **Artifacts**
3. Toque em **wavechat-release-aab** → baixa um `.zip`
4. Descompacte o zip — o arquivo é `app-release.aab`

---

## Passo 5: Fazer upload do AAB na Play Store

1. No Play Console, vá em **Versões de produção** → **Criar nova versão**
2. Toque em **Android App Bundle** como formato
3. Toque em **Procurar** e selecione o arquivo `app-release.aab`
4. Aguarde o processamento (Google verifica o arquivo)

---

## Passo 6: Preencher as informações da loja

A Play Store exige que você complete os dados do app antes de publicar.

### 6.1 Detalhes do app

Vá em **Crescer** → **Presença na Google Play** → **Detalhes do app**

Preencha:

| Campo | Sugestão |
|-------|----------|
| **Título** | WaveChat |
| **Descrição curta** | Mensagens, chamadas e status em um só lugar. |
| **Descrição completa** | WaveChat é o app de mensagens que conecta você com quem importa. Envie mensagens, faça chamadas de voz e vídeo, compartilhe status, e muito mais. Seguro, rápido e fácil de usar. |
| **E-mail de suporte** | Seu e-mail |
| **Telefone** | Opcional |

### 6.2 Imagens e screenshots

Vá em **Crescer** → **Presença na Google Play** → **Recursos principais**

Adicione:
- **Ícone do app:** 512x512 px (PNG)
- **Imagem de capa (feature graphic):** 1024x500 px
- **Screenshots:** Pelo menos 2 (de preferência 4-8)
  - Tamanho: 1080x1920 ou 1920x1080
  - Mostre: tela de chat, chamada, status, perfil

> **Dica:** Use um app de screenshots no celular para capturar as telas do WaveChat.

### 6.3 Classificação de conteúdo

Vá em **Políticas** → **Classificação de conteúdo**

1. Toque em **Iniciar questionário**
2. Responda as perguntas ( WaveChat é um app de comunicação, sem violência/sexo)
3. Receba a classificação **Livre** ou **+10**

### 6.4 Declaração de permissões

Vá em **Políticas** → **Declaração de permissões do app**

1. Verifique as permissões listadas (microfone, câmera, notificações)
2. Toque em **Salvar**

---

## Passo 7: Configurar a política de privacidade

Obrigatório para todos os apps.

1. No Lovable, já existe a rota `/privacy` → **https://webconnectchat.com/privacy**
2. No Play Console, vá em **Configuração** → **Páginas do app**
3. Em **Política de privacidade**, cole: `https://webconnectchat.com/privacy`
4. Toque em **Salvar**

---

## Passo 8: Enviar para revisão

1. Verifique se todas as seções têm ✓ verde (sem avisos vermelhos)
2. Vá em **Versões de produção** → **Editar versão**
3. Toque em **Revisar versão**
4. Toque em **Iniciar lançamento para produção**

Agora é só aguardar! A revisão da Google geralmente leva de **1 a 7 dias úteis**.

Você receberá um e-mail quando:
- O app for aprovado ✅
- O app for rejeitado ❌ (com motivo)

---

## Passo 9: Depois de aprovado

Quando o app for publicado:
- Ele aparece na Play Store em até 24h
- O link será: `https://play.google.com/store/apps/details?id=com.wavechat.app`
- Você pode compartilhar esse link com amigos

---

## Próximas versões (updates)

Sempre que atualizar o app:

1. Aumente o `versionCode` no `android/app/build.gradle` (ex: 2, 3, 4...)
2. Faça push para o GitHub
3. Rode o workflow **Build Android Release** novamente
4. Faça upload do novo AAB na Play Console
5. Envie para revisão

---

## Resumo dos custos

| Item | Custo |
|------|-------|
| Conta de desenvolvedor Google Play | $25 (único) |
| GitHub Actions build | Grátis |
| Play Store publicação | Grátis |

**Total: $25 dólares uma vez só.**
