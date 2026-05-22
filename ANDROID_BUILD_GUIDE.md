# WaveChat Android - Guia de Build

## O que já está configurado

O projeto Capacitor + Android já está preparado com:
- Capacitor core, Android platform, Push Notifications
- Plugin `@capgo/capacitor-incoming-call-kit` para UI nativa de chamada (ringtone + tela cheia)
- `WaveChatMessagingService` (Firebase) que intercepta push de chamada e mostra notificação nativa
- Integração no app web para enviar/receber chamadas via FCM

## Passos para gerar o APK e publicar na Play Store

### 1. Configurar Firebase (OBRIGATÓRIO para push funcionar)

1. Vá em https://console.firebase.google.com/
2. Crie um projeto novo ou use existente
3. Adicione um app Android com o package name: `com.wavechat.app`
4. Baixe o arquivo `google-services.json`
5. Copie para: `android/app/google-services.json`

### 2. Pegar a chave do servidor FCM

No Firebase Console:
1. Vá em Configurações do projeto → Cloud Messaging
2. Em "API do legado do Cloud Messaging", copie a **Chave do servidor**
3. No Lovable, adicione como secret: `FCM_SERVER_KEY`

### 3. Compilar o APK

Requisitos:
- Android Studio instalado
- JDK 17+

```bash
# 1. Abra o projeto no Android Studio
#    File → Open → selecione a pasta `android/`

# 2. No Android Studio, aguarde o Gradle sync

# 3. Gere o APK de release:
#    Build → Generate Signed Bundle or APK → APK
#    Crie ou use uma keystore existente

# 4. O APK será gerado em:
#    android/app/build/outputs/apk/release/app-release.apk
```

### 4. Publicar na Play Store

1. Crie uma conta de desenvolvedor Google Play ($25 dólares)
2. No Google Play Console, crie o app com package `com.wavechat.app`
3. Faça upload do APK/AAB gerado
4. Preencha as informações da loja (título, descrição, screenshots)
5. Envie para revisão

## Como funciona a chamada nativa

Quando alguém liga:
1. O backend envia push FCM para o app Android (mesmo fechado)
2. O `WaveChatMessagingService` intercepta o push
3. Mostra notificação nativa com ringtone + botões Atender/Recusar
4. Se tocar em Atender, o app abre e entra na chamada

No app aberto:
1. O plugin `@capgo/capacitor-incoming-call-kit` mostra a tela de chamada nativa
2. Com ringtone contínuo e tela cheia

## Permissões necessárias no Android

- Microfone (para chamadas de voz/vídeo)
- Câmera (para chamadas de vídeo)
- Notificações (Android 13+)
- Tela cheia durante chamadas (Android 14+)

## Troubleshooting

- Se o push não chega: verifique se o `google-services.json` está correto
- Se a chamada não toca: verifique permissões de notificação no Android
- Se o app não abre na chamada: verifique se o `server.url` no capacitor.config.ts aponta para a URL correta
