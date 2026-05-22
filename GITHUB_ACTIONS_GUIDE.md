# WaveChat - Build no GitHub Actions (Grátis)

Build do APK Android direto no GitHub, sem computador, sem Appflow.

## Passo 1: Adicionar os Secrets no GitHub

Pelo celular mesmo, vá no seu repo:
**https://github.com/vitorneto43/pure-web-messenger**

1. Toque em **Settings** (engrenagem no topo do repo)
2. Menu lateral → **Secrets and variables** → **Actions**
3. Toque em **New repository secret** e crie cada um:

### Secrets obrigatórios

| Nome | Valor | Onde pegar |
|------|-------|------------|
| `VITE_SUPABASE_URL` | URL do Supabase | Arquivo `.env` no Lovable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública | Arquivo `.env` no Lovable |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto | Arquivo `.env` no Lovable |
| `GOOGLE_SERVICES_JSON` | Conteúdo COMPLETO do `google-services.json` | Arquivo que vc baixou do Firebase |

> **Importante:** No `GOOGLE_SERVICES_JSON` cole o conteúdo INTEIRO do arquivo (abre ele num editor de texto, copia tudo, cola no campo).

### Como ver os valores do .env no Lovable

No Lovable, abra o **Code Editor** (no celular: ícone `...` em baixo à direita → Code Editor) → procure o arquivo `.env` → copia os valores.

---

## Passo 2: Rodar o Build

1. No GitHub, vá na aba **Actions** (topo do repo)
2. Menu lateral → **Build Android APK**
3. Toque em **Run workflow** → **Run workflow** (botão verde)
4. Aguarde ~5-10 minutos (pode acompanhar pelo celular)

---

## Passo 3: Baixar o APK

Quando terminar (bolinha verde ✓):

1. Toque no build que terminou
2. Role até embaixo → seção **Artifacts**
3. Toque em **wavechat-debug-apk** → baixa um `.zip`
4. Abre o zip no celular → instala o `app-debug.apk`

> Android pode pedir pra liberar "Instalar apps de fontes desconhecidas" — é normal.

---

## Pronto!

Toda vez que vc fizer um push no GitHub (ou alterar algo no Lovable), o build roda automático. Pra rodar manual, vai em **Actions** → **Run workflow**.

## Próximo passo: APK Release (pra Play Store)

Esse workflow gera APK **Debug** (pra testar). Quando quiser publicar na Play Store, me avisa que crio o workflow Release com keystore.
