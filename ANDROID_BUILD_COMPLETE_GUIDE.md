# WaveChat - Guia Completo de Build Android

**Versão**: 1.22 (versionCode: 23)  
**Data**: 23 de maio de 2026

---

## 1. Pré-requisitos

### 1.1 Software Necessário

- **Android Studio** 2024.1 ou superior
- **JDK 17+** (incluído no Android Studio)
- **Android SDK** (API 36 recomendado)
- **Gradle** 8.13.0 (incluído no projeto)
- **Node.js** 22.13.0 ou superior
- **Git** para versionamento

### 1.2 Configuração do Ambiente

```bash
# Instalar Android SDK (se não tiver)
# 1. Abra Android Studio
# 2. Vá em Tools → SDK Manager
# 3. Instale:
#    - Android SDK Platform 36 (ou superior)
#    - Android SDK Build-Tools 36.0.0
#    - Android Emulator (opcional)
#    - Android SDK Platform-Tools

# Configurar variáveis de ambiente
export ANDROID_SDK_ROOT=$HOME/Android/Sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_SDK_ROOT/tools:$ANDROID_SDK_ROOT/platform-tools
```

---

## 2. Preparação do Projeto

### 2.1 Instalar Dependências

```bash
# Instalar dependências Node.js
npm install
# ou
yarn install
# ou
bun install
```

### 2.2 Gerar Build Web

```bash
# Gerar build web para Capacitor
npm run build
# ou
yarn build
# ou
bun run build
```

### 2.3 Sincronizar com Capacitor

```bash
# Copiar build web para o Android
npx cap sync android

# Ou manualmente:
# 1. Copie a pasta capacitor-app para android/app/src/main/assets/public
# 2. Atualize o capacitor.config.ts se necessário
```

---

## 3. Configuração de Assinatura (Keystore)

### 3.1 Gerar Novo Keystore (Primeira Vez)

```bash
# Gerar um novo keystore com senha forte
keytool -genkey -v -keystore wavechat.jks -keyalg RSA -keysize 2048 -validity 10000 -alias wavechat-prod

# Será solicitado:
# - Keystore password: [Digite uma senha forte - GUARDE BEM]
# - Key password: [Digite uma senha forte - GUARDE BEM]
# - Nome: WaveChat
# - Organização: Seu Nome/Empresa
# - País: BR
# - Etc.

# Salve o arquivo wavechat.jks em local seguro
# NUNCA commite este arquivo no Git!
```

### 3.2 Configurar Variáveis de Ambiente

```bash
# Adicione ao seu ~/.bashrc, ~/.zshrc ou ~/.bash_profile

export ANDROID_KEYSTORE_FILE="/path/to/wavechat.jks"
export ANDROID_KEYSTORE_PASSWORD="sua_senha_keystore"
export ANDROID_KEY_ALIAS="wavechat-prod"
export ANDROID_KEY_PASSWORD="sua_senha_key"

# Recarregue o shell
source ~/.bashrc
# ou
source ~/.zshrc
```

### 3.3 Verificar Keystore

```bash
# Listar informações do keystore
keytool -list -v -keystore wavechat.jks

# Será solicitada a senha do keystore
```

---

## 4. Configuração do Firebase (FCM)

### 4.1 Criar Projeto Firebase

1. Vá para [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Criar Projeto"
3. Nome: `WaveChat`
4. Desabilite Google Analytics (opcional)
5. Clique em "Criar Projeto"

### 4.2 Adicionar App Android

1. No Firebase Console, clique em "Adicionar app"
2. Selecione "Android"
3. Preencha:
   - **Nome do pacote**: `com.wavechat.app`
   - **Apelido do app**: `WaveChat Android`
   - **SHA-1**: [Veja seção 4.4]
4. Clique em "Registrar app"
5. Baixe `google-services.json`
6. Copie para `android/app/google-services.json`

### 4.3 Obter SHA-1 do Keystore

```bash
# Gerar SHA-1 do seu keystore
keytool -list -v -keystore wavechat.jks | grep SHA1

# Será solicitada a senha do keystore
# Copie o valor SHA1 (ex: AB:CD:EF:12:34:56:78:90:...)
```

### 4.4 Configurar Cloud Messaging

1. No Firebase Console, vá em "Configurações do projeto"
2. Clique na aba "Cloud Messaging"
3. Copie a **Chave do servidor** (Server Key)
4. Salve em local seguro (você precisará para enviar notificações)

### 4.5 Criar Service Account (Para Backend)

1. No Firebase Console, vá em "Configurações do projeto"
2. Clique na aba "Contas de serviço"
3. Clique em "Gerar nova chave privada"
4. Salve o arquivo JSON em local seguro
5. Use este arquivo no seu backend para enviar notificações

---

## 5. Gerar AAB (Android App Bundle)

### 5.1 Método 1: Script Automatizado (Recomendado)

```bash
# Certifique-se de que as variáveis de ambiente estão configuradas
echo $ANDROID_KEYSTORE_FILE
echo $ANDROID_KEY_ALIAS

# Execute o script
./build-aab.sh

# O AAB será gerado em: android/app/build/outputs/bundle/release/app-release.aab
```

### 5.2 Método 2: Android Studio

1. Abra Android Studio
2. File → Open → Selecione a pasta `android/`
3. Aguarde o Gradle sync
4. Build → Generate Signed Bundle or APK
5. Selecione "Bundle"
6. Clique em "Next"
7. Selecione seu keystore
8. Preencha as senhas
9. Selecione "release"
10. Clique em "Create"

### 5.3 Método 3: Linha de Comando (Manual)

```bash
cd android

# Gerar AAB assinado
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file=$ANDROID_KEYSTORE_FILE \
  -Pandroid.injected.signing.store.password=$ANDROID_KEYSTORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=$ANDROID_KEY_ALIAS \
  -Pandroid.injected.signing.key.password=$ANDROID_KEY_PASSWORD

cd ..

# O AAB será gerado em: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 6. Testar AAB Localmente

### 6.1 Instalar bundletool

```bash
# Baixar bundletool
wget https://github.com/google/bundletool/releases/download/1.15.6/bundletool-all-1.15.6.jar

# Ou via Homebrew (macOS)
brew install bundletool
```

### 6.2 Gerar APKs do AAB

```bash
# Gerar APKs para teste
java -jar bundletool-all-1.15.6.jar build-apks \
  --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=app.apks \
  --ks=wavechat.jks \
  --ks-pass=pass:$ANDROID_KEYSTORE_PASSWORD \
  --ks-key-alias=$ANDROID_KEY_ALIAS \
  --key-pass=pass:$ANDROID_KEY_PASSWORD
```

### 6.3 Instalar em Dispositivo/Emulador

```bash
# Instalar APKs
java -jar bundletool-all-1.15.6.jar install-apks \
  --apks=app.apks

# Ou via adb diretamente
adb install-multiple app.apks
```

---

## 7. Incrementar Versão para Próximas Releases

### 7.1 Entender versionCode vs versionName

| Campo | Significado | Exemplo |
|-------|-----------|---------|
| **versionCode** | Número inteiro sequencial (obrigatório para incrementar) | 23, 24, 25... |
| **versionName** | String legível para usuários | 1.22, 1.23, 2.0... |

**Regra**: versionCode SEMPRE deve ser maior que a versão anterior!

### 7.2 Incrementar Versão

```bash
# Editar android/app/build.gradle
# Alterar:
#   versionCode 23  →  versionCode 24
#   versionName "1.22"  →  versionName "1.23"

# Ou use sed para automatizar:
sed -i 's/versionCode [0-9]*/versionCode 24/g' android/app/build.gradle
sed -i 's/versionName "[^"]*"/versionName "1.23"/g' android/app/build.gradle

# Verificar
grep -E "versionCode|versionName" android/app/build.gradle
```

### 7.3 Script para Incrementar Automaticamente

```bash
#!/bin/bash
# increment-version.sh

GRADLE_FILE="android/app/build.gradle"

# Ler versionCode atual
CURRENT_CODE=$(grep "versionCode" $GRADLE_FILE | grep -oE "[0-9]+$" | head -1)
NEW_CODE=$((CURRENT_CODE + 1))

# Ler versionName atual
CURRENT_NAME=$(grep "versionName" $GRADLE_FILE | grep -oE '"[^"]*"' | head -1 | tr -d '"')

# Incrementar minor version
IFS='.' read -r MAJOR MINOR <<< "$CURRENT_NAME"
NEW_MINOR=$((MINOR + 1))
NEW_NAME="$MAJOR.$NEW_MINOR"

# Atualizar arquivo
sed -i "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/g" $GRADLE_FILE
sed -i "s/versionName \"$CURRENT_NAME\"/versionName \"$NEW_NAME\"/g" $GRADLE_FILE

echo "✓ Versão atualizada:"
echo "  versionCode: $CURRENT_CODE → $NEW_CODE"
echo "  versionName: $CURRENT_NAME → $NEW_NAME"
```

---

## 8. Publicar na Google Play Console

### 8.1 Criar Conta de Desenvolvedor

1. Vá para [Google Play Console](https://play.google.com/console)
2. Clique em "Criar conta"
3. Pague a taxa de registro ($25 USD)
4. Complete o perfil

### 8.2 Criar App

1. No Google Play Console, clique em "Criar app"
2. Preencha:
   - **Nome do app**: `WaveChat`
   - **Idioma padrão**: Português (Brasil)
   - **Tipo de app**: Aplicativo
   - **Categoria**: Comunicação
   - **Classificação indicativa**: Livre
3. Clique em "Criar app"

### 8.3 Configurar Informações da Loja

1. Vá em "Listagem na Play Store"
2. Preencha:
   - **Título curto**: WaveChat (50 caracteres)
   - **Descrição curta**: Chat, chamadas de voz e vídeo em tempo real (80 caracteres)
   - **Descrição completa**: [Veja abaixo]
   - **Screenshots**: Mínimo 2, máximo 8 (1080x1920 ou 1440x2560)
   - **Ícone do app**: 512x512 PNG
   - **Banner de recurso**: 1024x500 PNG

### 8.4 Descrição Completa

```
WaveChat - Chat, Chamadas de Voz e Vídeo em Tempo Real

Conecte-se com amigos e família através de:
✓ Mensagens instantâneas
✓ Chamadas de voz HD
✓ Chamadas de vídeo
✓ Status com histórias
✓ Compartilhamento de mídia
✓ Pagamentos via Pix

Características:
• Criptografia ponta-a-ponta
• Sincronização em tempo real
• Funciona em qualquer dispositivo
• Sem anúncios
• Código aberto

Privacidade:
Seus dados são seus. Não vendemos informações pessoais.
```

### 8.5 Fazer Upload do AAB

1. Vá em "Versão de teste fechado" ou "Produção"
2. Clique em "Criar versão"
3. Faça upload do AAB (`app-release.aab`)
4. Preencha as notas de lançamento:

```
Versão 1.22 (23)

Melhorias:
• Corrigido problema de eco em chamadas
• Melhorada estabilidade de vídeo
• Interface de chamada redesenhada
• Notificações mais confiáveis

Correções:
• Vibração contínua após atender
• Câmera invertida em alguns dispositivos
• Delay em chamadas
```

5. Clique em "Revisar"
6. Clique em "Confirmar"

### 8.6 Teste Fechado (Recomendado)

1. Vá em "Teste fechado"
2. Clique em "Criar versão"
3. Faça upload do AAB
4. Adicione testadores (emails)
5. Clique em "Publicar"
6. Compartilhe o link com testadores
7. Colete feedback por 1-2 semanas
8. Corrija problemas encontrados
9. Publique em produção

---

## 9. Troubleshooting

### 9.1 Erro: "Keystore not found"

```bash
# Solução: Verificar se o arquivo existe
ls -la $ANDROID_KEYSTORE_FILE

# Se não existir, gerar novo keystore
keytool -genkey -v -keystore wavechat.jks -keyalg RSA -keysize 2048 -validity 10000 -alias wavechat-prod
```

### 9.2 Erro: "Invalid keystore format"

```bash
# Solução: Verificar integridade do keystore
keytool -list -v -keystore wavechat.jks

# Se falhar, o arquivo pode estar corrompido. Gere um novo.
```

### 9.3 Erro: "Gradle sync failed"

```bash
# Solução 1: Limpar cache
cd android
./gradlew clean
./gradlew sync

# Solução 2: Atualizar Gradle
./gradlew wrapper --gradle-version 8.13.0
```

### 9.4 Erro: "google-services.json not found"

```bash
# Solução: Copiar arquivo do Firebase
# 1. Baixe google-services.json do Firebase Console
# 2. Copie para android/app/google-services.json

cp ~/Downloads/google-services.json android/app/
```

### 9.5 Erro: "Insufficient permissions"

```bash
# Solução: Verificar permissões
ls -la android/app/build.gradle

# Se não tiver permissão de escrita:
chmod 644 android/app/build.gradle
```

---

## 10. Checklist de Release

- [ ] versionCode incrementado
- [ ] versionName atualizado
- [ ] Keystore configurado e seguro
- [ ] google-services.json presente
- [ ] Build web gerado (`npm run build`)
- [ ] Capacitor sincronizado (`npx cap sync android`)
- [ ] AAB gerado com sucesso
- [ ] AAB testado em dispositivo/emulador
- [ ] Descrição da loja preenchida
- [ ] Screenshots adicionados
- [ ] Notas de lançamento preparadas
- [ ] Teste fechado realizado (recomendado)
- [ ] Feedback de testadores coletado
- [ ] Publicado na Play Store

---

## 11. Próximas Releases

### 11.1 Processo Padrão

1. Fazer alterações no código
2. Testar em desenvolvimento
3. Incrementar versionCode e versionName
4. Gerar novo build web
5. Sincronizar com Capacitor
6. Gerar AAB
7. Testar em dispositivo real
8. Fazer upload para Google Play Console
9. Publicar em teste fechado (1-2 semanas)
10. Publicar em produção

### 11.2 Timing Recomendado

- **Hotfixes**: 1-2 dias
- **Minor updates**: 1 semana
- **Major updates**: 2-4 semanas

---

## 12. Recursos Adicionais

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Documentation](https://developer.android.com/guide/app-bundle)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Security Best Practices](https://developer.android.com/privacy-and-security)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
