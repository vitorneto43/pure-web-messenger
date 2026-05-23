# WaveChat - Aplicativo de Chat com Chamadas em Tempo Real

**Versão**: 1.22 (versionCode: 23)  
**Data**: 23 de maio de 2026  
**Status**: Pronto para Produção

---

## 📋 Visão Geral

WaveChat é um aplicativo moderno de mensageria instantânea com suporte a chamadas de voz e vídeo em tempo real, desenvolvido com React, TypeScript, Supabase e WebRTC.

### ✨ Características Principais

- 💬 **Chat em Tempo Real**: Mensagens instantâneas com sincronização
- 📞 **Chamadas de Voz**: Chamadas de áudio de alta qualidade
- 📹 **Chamadas de Vídeo**: Videochamadas com qualidade HD
- 🔔 **Notificações Push**: Receba notificações mesmo com app fechado
- 📱 **Progressive Web App**: Instale na tela inicial
- 🔐 **Segurança**: Criptografia end-to-end
- 📴 **Offline Mode**: Use o app sem internet
- 🎨 **Interface Moderna**: Design profissional estilo WhatsApp

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- Java 17+ (para Android)
- Android SDK (para compilar Android)
- Git

### Instalação

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/wavechat.git
cd wavechat

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais

# Iniciar desenvolvimento
npm run dev

# Acessar em http://localhost:5173
```

### Build Android

```bash
# Preparar ambiente
npm run build

# Sincronizar com Capacitor
npx cap sync

# Build APK de debug
./gradlew assembleDebug

# Build AAB de release
./gradlew bundleRelease
```

---

## 📁 Estrutura do Projeto

```
wavechat/
├── src/                          # Código-fonte React
│   ├── components/               # Componentes React
│   │   ├── call/                 # Componentes de chamadas
│   │   ├── chat/                 # Componentes de chat
│   │   ├── auth/                 # Componentes de autenticação
│   │   └── ui/                   # Componentes UI reutilizáveis
│   ├── hooks/                    # React Hooks customizados
│   │   ├── use-call.tsx          # Hook de chamadas
│   │   ├── use-chat.ts           # Hook de chat
│   │   └── use-auth.ts           # Hook de autenticação
│   ├── integrations/             # Integrações externas
│   │   ├── supabase/             # Supabase client
│   │   └── native-call/          # Integração Capacitor
│   ├── lib/                      # Utilitários
│   │   ├── push.functions.ts     # Push notifications
│   │   ├── ringtone.ts           # Áudio de chamada
│   │   └── crypto.ts             # Criptografia
│   └── routes/                   # Rotas da aplicação
├── public/                       # Arquivos estáticos
│   ├── icon-192.png              # Ícone PWA
│   ├── icon-512.png              # Ícone PWA
│   ├── manifest.json             # Manifest PWA
│   └── sw.js                     # Service Worker
├── android/                      # Código Android (Capacitor)
│   ├── app/                      # App Android
│   ├── app/build.gradle          # Configuração de build
│   └── app/src/main/             # Código Java/Kotlin
├── capacitor.config.ts           # Configuração Capacitor
├── vite.config.ts                # Configuração Vite
├── tsconfig.json                 # Configuração TypeScript
└── package.json                  # Dependências Node.js
```

---

## 🔧 Configuração

### 1. Supabase

```bash
# 1. Criar projeto em https://supabase.com
# 2. Copiar URL e chave anon
# 3. Adicionar em .env.local

VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### 2. Firebase

```bash
# 1. Criar projeto em https://console.firebase.google.com
# 2. Baixar google-services.json
# 3. Copiar para android/app/google-services.json
# 4. Adicionar chaves em .env.local

VITE_FIREBASE_API_KEY=sua-chave
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
```

### 3. Android Keystore

```bash
# Gerar keystore
keytool -genkey -v -keystore wavechat.jks \
  -keyalg RSA -keysize 2048 -validity 10950 \
  -alias wavechat

# Adicionar em .env.local
ANDROID_KEYSTORE_PATH=./wavechat.jks
ANDROID_KEYSTORE_PASSWORD=sua-senha
ANDROID_KEYSTORE_ALIAS=wavechat
ANDROID_KEY_PASSWORD=sua-senha
```

---

## 📚 Documentação Completa

### Guias Técnicos

| Documento | Descrição |
|-----------|-----------|
| [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md) | Análise completa da estrutura |
| [ANDROID_BUILD_COMPLETE_GUIDE.md](./ANDROID_BUILD_COMPLETE_GUIDE.md) | Guia de build Android |
| [CALL_FIXES_DOCUMENTATION.md](./CALL_FIXES_DOCUMENTATION.md) | Correções de bugs de chamadas |
| [UI_IMPROVEMENTS_GUIDE.md](./UI_IMPROVEMENTS_GUIDE.md) | Melhorias de interface |
| [FIREBASE_FCM_SETUP_GUIDE.md](./FIREBASE_FCM_SETUP_GUIDE.md) | Setup Firebase/FCM |
| [PWA_IMPROVEMENTS_GUIDE.md](./PWA_IMPROVEMENTS_GUIDE.md) | Melhorias PWA |
| [SECURITY_HARDENING_GUIDE.md](./SECURITY_HARDENING_GUIDE.md) | Hardening de segurança |
| [GOOGLE_PLAY_CONSOLE_GUIDE.md](./GOOGLE_PLAY_CONSOLE_GUIDE.md) | Google Play Console |
| [DEPLOYMENT_AND_RELEASE_GUIDE.md](./DEPLOYMENT_AND_RELEASE_GUIDE.md) | Deployment e release |

---

## 🧪 Testes

### Teste de Funcionalidade

```bash
# Instalar app em dispositivo
adb install -r android/app/release/app-release.apk

# Testes manuais:
# 1. Login
# 2. Enviar mensagem
# 3. Receber mensagem
# 4. Fazer chamada de voz
# 5. Fazer chamada de vídeo
# 6. Receber chamada
# 7. Offline mode
```

### Teste de Performance

```bash
# Lighthouse
lighthouse https://seu-app.com --view

# Android Profiler
# 1. Abrir Android Studio
# 2. Conectar dispositivo
# 3. Ir em Profiler
# 4. Monitorar CPU, memória, rede
```

### Teste de Segurança

```bash
# Verificar permissões
adb shell pm list permissions | grep wavechat

# Verificar dados armazenados
adb shell run-as com.wavechat.app ls -la /data/data/com.wavechat.app/

# Verificar logs
adb logcat | grep WaveChat
```

---

## 🚀 Deploy

### Google Play Store

```bash
# 1. Criar conta developer ($25 USD)
# 2. Build AAB
./gradlew bundleRelease

# 3. Upload no Google Play Console
# 4. Preencher informações
# 5. Submeter para revisão
# 6. Aguardar aprovação (24-48 horas)
```

### PWA

```bash
# Build
npm run build

# Deploy com Vercel
vercel --prod

# Ou Firebase Hosting
firebase deploy --only hosting
```

---

## 📊 Monitoramento

### Google Play Console

- Instalações ativas
- Taxa de desinstalação
- Crashes
- Avaliações
- Retenção de usuários

### Firebase Analytics

- Eventos de uso
- Funil de conversão
- Retenção
- Comportamento do usuário

### Sentry (Error Tracking)

- Erros não tratados
- Stack traces
- Contexto do erro
- Alertas em tempo real

---

## 🔐 Segurança

### Práticas Implementadas

- ✅ Secrets em variáveis de ambiente
- ✅ Keystore protegido (chmod 600)
- ✅ HTTPS em produção
- ✅ JWT com expiração
- ✅ Rate limiting
- ✅ CORS configurado
- ✅ Helmet.js para headers
- ✅ Validação de entrada
- ✅ Hash de senhas (bcrypt)
- ✅ Criptografia de dados

### Checklist de Segurança

- [ ] .env.local criado
- [ ] Keystore protegido
- [ ] HTTPS ativado
- [ ] JWT configurado
- [ ] Rate limiting ativado
- [ ] CORS configurado
- [ ] Validação de entrada
- [ ] Logging sem secrets
- [ ] Permissões mínimas
- [ ] Testes de segurança

---

## 🐛 Troubleshooting

### Problema: Notificações não chegam

**Solução**:
1. Verificar `google-services.json`
2. Verificar token FCM nos logs
3. Verificar permissões no Android
4. Verificar se FCM está ativado

```bash
adb logcat | grep Firebase
adb logcat | grep FCM
```

### Problema: Echo em chamadas

**Solução**:
1. Usar apenas video tracks para preview local
2. Ativar echo cancellation
3. Usar audio remoto em elemento <audio> separado

```typescript
// ✅ CORRETO
const videoOnly = new MediaStream(localStream.getVideoTracks());
localVideoRef.current.srcObject = videoOnly;
```

### Problema: App não abre na notificação

**Solução**:
1. Verificar `clickAction` no AndroidManifest
2. Verificar intent filters
3. Verificar se MainActivity está exportada

```xml
<activity
    android:name=".MainActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="com.wavechat.app.CALL_NOTIFICATION_CLICKED" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</activity>
```

---

## 📝 Changelog

### v1.22 (23 de maio de 2026)

**Novidades**:
- Interface de chamadas profissional (estilo WhatsApp)
- PWA com offline mode
- Notificações push melhoradas
- Suporte a Android 5.0+

**Correções**:
- Echo em chamadas de voz
- Vibração contínua após atender
- Câmera invertida em alguns dispositivos
- Delay nas chamadas

**Melhorias**:
- Incrementado versionCode de 22 para 23
- Melhorado audio focus em Android
- Melhorado service worker
- Melhorado manifest.json

### v1.21

- Chat em tempo real
- Chamadas de voz
- Chamadas de vídeo

---

## 👥 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](./LICENSE) para detalhes.

---

## 📞 Suporte

- **Email**: support@wavechat.com
- **Website**: https://wavechat.com
- **Issues**: https://github.com/seu-usuario/wavechat/issues

---

## 🙏 Agradecimentos

- React e TanStack Start
- Supabase
- Firebase
- Capacitor
- WebRTC

---

## 📈 Roadmap

- [ ] Chamadas em grupo
- [ ] Compartilhamento de tela
- [ ] Mensagens de voz
- [ ] Stickers e emojis
- [ ] Temas personalizáveis
- [ ] Sincronização de contatos
- [ ] Backup automático
- [ ] Suporte a iOS

---

**Desenvolvido com ❤️ por WaveChat Team**

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
