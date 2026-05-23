# WaveChat - Guia de Deployment e Release

**Data**: 23 de maio de 2026  
**Versão**: 1.22  
**Status**: Implementado

---

## 1. Checklist de Pré-Lançamento

### 1.1 Código

- [ ] Todos os TODOs removidos
- [ ] Sem console.log em produção
- [ ] Sem secrets hardcoded
- [ ] Sem comentários sensíveis
- [ ] Linter passou (ESLint)
- [ ] TypeScript sem erros
- [ ] Testes passando

### 1.2 Segurança

- [ ] .env.local criado com valores reais
- [ ] .gitignore atualizado
- [ ] Keystore protegido (chmod 600)
- [ ] Senha do keystore em variável de ambiente
- [ ] HTTPS ativado
- [ ] JWT com expiração
- [ ] Rate limiting ativado
- [ ] CORS configurado

### 1.3 Performance

- [ ] Bundle size < 50MB
- [ ] Lighthouse score > 90
- [ ] FCP < 1s
- [ ] LCP < 2s
- [ ] CLS < 0.1
- [ ] Imagens otimizadas
- [ ] Cache configurado

### 1.4 Funcionalidade

- [ ] Chat funciona
- [ ] Chamadas de voz funcionam
- [ ] Chamadas de vídeo funcionam
- [ ] Notificações funcionam
- [ ] Offline mode funciona
- [ ] Sincronização funciona
- [ ] PWA instalável

### 1.5 Compatibilidade

- [ ] Testado em Android 5.0+
- [ ] Testado em Android 14+
- [ ] Testado em iPhone 6+
- [ ] Testado em desktop
- [ ] Testado em tablet
- [ ] Testado em foldable

### 1.6 Documentação

- [ ] README.md atualizado
- [ ] INSTALL.md criado
- [ ] API.md criado
- [ ] CONTRIBUTING.md criado
- [ ] CHANGELOG.md criado
- [ ] LICENSE.md criado

---

## 2. Versioning

### 2.1 Semantic Versioning

Formato: `MAJOR.MINOR.PATCH`

- **MAJOR**: Mudanças incompatíveis (ex: 1.0.0 → 2.0.0)
- **MINOR**: Novas funcionalidades compatíveis (ex: 1.0.0 → 1.1.0)
- **PATCH**: Correções de bugs (ex: 1.0.0 → 1.0.1)

**Versão atual**: 1.22.0

### 2.2 Android Version Code

Incrementar `versionCode` a cada release:

```gradle
android {
    defaultConfig {
        versionCode 23  // Incrementar a cada release
        versionName "1.22"
    }
}
```

### 2.3 Incrementar Versão

```bash
# Script para incrementar versão
./increment-version.sh

# Ou manualmente:
# 1. Editar android/app/build.gradle
# 2. Editar package.json
# 3. Editar capacitor.config.ts
# 4. Fazer commit: git commit -m "chore: bump version to 1.22"
```

---

## 3. Build e Assinatura

### 3.1 Build Android

```bash
# Limpar build anterior
./gradlew clean

# Build APK de debug
./gradlew assembleDebug

# Build APK de release
./gradlew assembleRelease

# Build AAB de release
./gradlew bundleRelease

# Resultado em:
# android/app/release/app-release.aab
```

### 3.2 Assinatura Automática

```bash
# Configurar variáveis de ambiente
export ANDROID_KEYSTORE_PATH=./wavechat.jks
export ANDROID_KEYSTORE_PASSWORD="sua-senha-forte"
export ANDROID_KEYSTORE_ALIAS=wavechat
export ANDROID_KEY_PASSWORD="sua-senha-forte"

# Build com assinatura automática
./gradlew bundleRelease
```

### 3.3 Verificar Assinatura

```bash
# Verificar se o AAB está assinado
jarsigner -verify -verbose -certs android/app/release/app-release.aab

# Resultado esperado:
# sm 3024 Fri May 23 10:00:00 BRT 2026 AndroidManifest.xml
# X.509, CN=WaveChat, OU=Development, O=WaveChat, L=São Paulo, ST=SP, C=BR
```

---

## 4. Testes Pré-Lançamento

### 4.1 Teste de Instalação

```bash
# Instalar APK em dispositivo/emulador
adb install -r android/app/release/app-release.apk

# Ou instalar AAB (requer bundletool)
bundletool build-apks \
  --bundle=android/app/release/app-release.aab \
  --output=app.apks \
  --ks=wavechat.jks \
  --ks-pass=pass:sua-senha

adb install-multiple app.apks
```

### 4.2 Teste de Funcionalidade

```
1. Abrir app
2. Fazer login
3. Enviar mensagem
4. Receber mensagem
5. Fazer chamada de voz
6. Fazer chamada de vídeo
7. Receber chamada
8. Compartilhar mídia
9. Desligar internet (offline)
10. Ligar internet (sincronizar)
```

### 4.3 Teste de Performance

```bash
# Usar Android Profiler
# 1. Abrir Android Studio
# 2. Conectar dispositivo
# 3. Ir em "Profiler"
# 4. Monitorar:
#    - CPU
#    - Memória
#    - Rede
#    - Bateria
```

### 4.4 Teste de Segurança

```bash
# Verificar permissões
adb shell pm list permissions

# Verificar dados armazenados
adb shell run-as com.wavechat.app ls -la /data/data/com.wavechat.app/

# Verificar logs
adb logcat | grep WaveChat
```

---

## 5. CI/CD Pipeline

### 5.1 GitHub Actions

```yaml
# .github/workflows/build-and-release.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up JDK
        uses: actions/setup-java@v3
        with:
          java-version: '17'
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build web
        run: npm run build
      
      - name: Build AAB
        env:
          ANDROID_KEYSTORE_PATH: ./wavechat.jks
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEYSTORE_ALIAS: wavechat
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > wavechat.jks
          ./gradlew bundleRelease
      
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
      
      - name: Upload AAB
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./android/app/release/app-release.aab
          asset_name: wavechat-${{ github.ref }}.aab
          asset_content_type: application/octet-stream
```

### 5.2 Configurar Secrets

No GitHub, vá em "Settings" → "Secrets and variables" → "Actions":

1. `ANDROID_KEYSTORE_PASSWORD`: Senha do keystore
2. `ANDROID_KEY_PASSWORD`: Senha da chave
3. `ANDROID_KEYSTORE_BASE64`: Keystore em base64

```bash
# Converter keystore para base64
base64 -i wavechat.jks -o wavechat.jks.base64
cat wavechat.jks.base64
```

---

## 6. Deploy em Produção

### 6.1 Upload no Google Play Console

1. Vá em "Lançamento" → "Produção"
2. Clique em "Criar versão"
3. Upload do AAB
4. Preencha notas de versão
5. Clique em "Revisar"
6. Clique em "Lançar"

### 6.2 Deploy do Backend

```bash
# Fazer deploy do backend (exemplo com Heroku)
git push heroku main

# Ou com Docker
docker build -t wavechat-backend .
docker push your-registry/wavechat-backend:latest
```

### 6.3 Deploy do Frontend (PWA)

```bash
# Build
npm run build

# Deploy (exemplo com Vercel)
vercel --prod

# Ou com Firebase Hosting
firebase deploy --only hosting
```

---

## 7. Monitoramento Pós-Lançamento

### 7.1 Google Play Console

1. Vá em "Estatísticas"
2. Monitore:
   - **Instalações**: Número de instalações ativas
   - **Desinstalações**: Taxa de desinstalação
   - **Crashes**: Erros não tratados
   - **Avaliações**: Feedback dos usuários
   - **Retenção**: Usuários que voltam

### 7.2 Firebase Analytics

```typescript
// src/lib/analytics.ts
import { getAnalytics, logEvent } from 'firebase/analytics';

const analytics = getAnalytics();

export function trackEvent(name: string, params?: Record<string, any>) {
  logEvent(analytics, name, params);
}

// Uso
trackEvent('call_started', { kind: 'video' });
trackEvent('message_sent', { length: message.length });
```

### 7.3 Sentry (Error Tracking)

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});

export { Sentry };
```

### 7.4 Logs

```bash
# Ver logs do backend
heroku logs --tail

# Ou com Docker
docker logs -f wavechat-backend

# Ou com Firebase Functions
firebase functions:log
```

---

## 8. Hotfix e Patches

### 8.1 Hotfix para Bug Crítico

```bash
# Criar branch de hotfix
git checkout -b hotfix/critical-bug

# Corrigir bug
# ...

# Incrementar versão patch
./increment-version.sh patch

# Fazer commit
git commit -m "fix: critical bug in calls"

# Fazer merge
git checkout main
git merge hotfix/critical-bug

# Tag
git tag v1.22.1

# Push
git push origin main v1.22.1
```

### 8.2 Rollback

```bash
# Se algo der muito errado
git revert <commit-hash>
git push origin main

# Ou reverter para versão anterior no Google Play Console
# (Vá em "Lançamento" → "Produção" → "Gerenciar versões")
```

---

## 9. Changelog

### 9.1 Manter Changelog

```markdown
# Changelog

## [1.22] - 2026-05-23

### Added
- Melhorias de interface de chamadas (estilo WhatsApp)
- Suporte a PWA com offline mode
- Notificações push melhoradas

### Fixed
- Echo em chamadas de voz
- Vibração contínua após atender
- Câmera invertida em alguns dispositivos
- Delay nas chamadas

### Changed
- Incrementado versionCode de 22 para 23
- Melhorado audio focus em Android

### Security
- Proteção de secrets (.env)
- Keystore com senha forte
- HTTPS ativado

## [1.21] - 2026-05-01

### Added
- Chat em tempo real
- Chamadas de voz
- Chamadas de vídeo

### Fixed
- Bugs iniciais
```

---

## 10. Comunicação com Usuários

### 10.1 Release Notes

```markdown
# WaveChat 1.22 - Agora Disponível!

Estamos felizes em anunciar a versão 1.22 do WaveChat com melhorias significativas:

## ✨ Novidades

- **Interface de Chamadas Melhorada**: Agora com design profissional similar ao WhatsApp
- **Modo Offline**: Use o app mesmo sem internet
- **Notificações Melhoradas**: Receba notificações de chamadas com mais confiabilidade
- **Melhor Performance**: App mais rápido e eficiente

## 🐛 Correções

- Corrigido echo em chamadas de voz
- Corrigida vibração contínua após atender
- Corrigida câmera invertida em alguns dispositivos
- Reduzido delay nas chamadas

## 📱 Compatibilidade

- Android 5.0+
- iPhone 6+
- Desktop e tablet

## 🙏 Obrigado

Obrigado por usar WaveChat! Seu feedback é importante para nós.

[Baixar Agora](https://play.google.com/store/apps/details?id=com.wavechat.app)
```

### 10.2 Email para Usuários

```
Assunto: WaveChat 1.22 - Melhorias Importantes

Olá [Nome],

Lançamos a versão 1.22 do WaveChat com melhorias importantes:

✨ Novidades:
- Interface de chamadas profissional
- Modo offline
- Notificações melhoradas

🐛 Correções:
- Echo em chamadas
- Vibração contínua
- Câmera invertida
- Delay reduzido

Atualize agora para aproveitar essas melhorias!

[Atualizar no Google Play](https://play.google.com/store/apps/details?id=com.wavechat.app)

Dúvidas? Contate-nos: support@wavechat.com

Obrigado por usar WaveChat!
```

---

## 11. Próximos Passos

1. **Fase 8**: Documentação final e entrega

---

## 12. Referências

- [Semantic Versioning](https://semver.org/)
- [Google Play Release Process](https://developer.android.com/studio/publish)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Firebase Analytics](https://firebase.google.com/docs/analytics)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
