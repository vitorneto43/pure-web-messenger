# WaveChat - Guia Ionic Appflow (Build na Nuvem)

## O que é o Ionic Appflow?

Serviço de CI/CD da Ionic que compila seu app Capacitor na nuvem. **Não precisa de computador** — tudo pelo celular/navegador.

Você só precisa:
1. Conectar o projeto ao GitHub (1 minuto)
2. Criar conta no Ionic Appflow
3. Apontar pro repositório
4. Dar o build pelo celular
5. Baixar o APK

---

## Passo 1: Conectar o Lovable ao GitHub

> **Dica:** Isso dá pra fazer 100% pelo celular usando o navegador.

1. No Lovable, clique no **+** (canto inferior esquerdo)
2. Selecione **GitHub** → **Connect project**
3. Autorize o app do Lovable no GitHub
4. Crie o repositório: clique em **Create Repository**

Pronto! Seu código já está no GitHub.

---

## Passo 2: Criar conta no Ionic Appflow

1. Acesse pelo celular: https://dashboard.ionicframework.com
2. Crie conta (pode usar Google/GitHub)
3. Assine o plano (tem trial gratuito de 14 dias)

---

## Passo 3: Adicionar seu app no Appflow

1. No Appflow dashboard, clique **New App** → **Import existing app**
2. Escolha **GitHub** e autorize
3. Selecione o repositório do WaveChat
4. Escolha **Capacitor** como tipo

---

## Passo 4: Configurar o Build de Android

### 4.1 Criar a Android Keystore (assinatura do app)

A Play Store exige que o APK seja assinado. Você pode criar a keystore pelo Appflow:

1. No Appflow, vá em **App Settings** → **Certificates**
2. Clique **Add Certificate** → **Generate new keystore**
3. Preencha:
   - Organization: `WaveChat`
   - Organizational Unit: `WaveChat`
   - Country: `BR`
4. Baixe e guarde o arquivo `.jks` gerado (só pode baixar 1 vez!)

### 4.2 Configurar as variáveis de ambiente

No Appflow, vá em **App Settings** → **Environment Variables**:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | Pegue do Lovable → .env | Sim |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pegue do Lovable → .env | Sim |

> **Como pegar:** No Lovable, abra o arquivo `.env` no editor de código.

### 4.3 Configurar o Firebase (Push de chamada)

1. Vá em https://console.firebase.google.com/ pelo celular
2. Crie projeto novo
3. Adicione app Android com package: `com.wavechat.app`
4. Baixe `google-services.json`
5. No Appflow, vá em **App Settings** → **Files** → **Add File**
6. Faça upload do `google-services.json` para: `android/app/google-services.json`

---

## Passo 5: Fazer o Build (APK)

1. No Appflow, vá em **Build**
2. Clique **New Build**
3. Escolha:
   - **Platform**: Android
   - **Build Type**: Debug (pra testar) ou Release (pra Play Store)
   - **Certificate**: Sua keystore criada no passo 4.1
   - **Native Config**: Nenhuma (a menos que queira config custom)
4. Clique **Build**

Aguarde 5-15 minutos. O Appflow compila na nuvem.

---

## Passo 6: Baixar o APK

Quando o build terminar:
1. Clique no build concluído
2. Vá na aba **Artifacts**
3. Baixe o APK (`app-release.apk` ou `app-debug.apk`)
4. Instale no Android direto pelo arquivo

---

## Passo 7: Publicar na Play Store (opcional)

1. Crie conta de desenvolvedor Google Play ($25)
2. No Play Console, crie app com package `com.wavechat.app`
3. Vá em **App Signing**
4. Faça upload do APK pelo Appflow ou direto
5. Preencha os dados da loja
6. Envie para revisão

---

## Automação (opcional)

Você pode configurar para **todo push no GitHub gerar um build automaticamente**:

1. No Appflow, vá em **Automations**
2. Crie uma automação:
   - **Trigger**: Push na branch `main`
   - **Action**: Start Android Build (Release)

Aí é só fazer alterações no Lovable → push vai pro GitHub → build gera APK automaticamente.

---

## Custos

| Plano | Preço | Builds/Mês |
|-------|-------|------------|
| Starter (trial) | Grátis 14 dias | Ilimitado |
| Growth | ~$49/mês | Ilimitado |
| Enterprise | Sob consulta | Ilimitado |

Se o uso for baixo, o trial + plano básico já resolve.

---

## Alternativa gratuita: GitHub Actions

Se não quiser pagar, o `GITHUB_ACTIONS_GUIDE.md` tem configuração 100% grátis.
O Ionic Appflow é mais simples e visual, o GitHub Actions é gratuito para repositórios públicos.
