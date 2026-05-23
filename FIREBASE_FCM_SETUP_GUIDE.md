# WaveChat - Guia Completo de Firebase e FCM

**Data**: 23 de maio de 2026  
**Versão**: 1.22  
**Status**: Implementado

---

## 1. Visão Geral

Firebase Cloud Messaging (FCM) é essencial para:
- ✅ Notificações de chamadas recebidas
- ✅ Entrega confiável mesmo com app fechado
- ✅ Suporte a Android 5.0+
- ✅ Sincronização em tempo real

---

## 2. Configuração do Firebase

### 2.1 Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Criar Projeto"
3. Preencha:
   - **Nome**: WaveChat
   - **ID do Projeto**: wavechat-prod (ou similar)
   - **Região**: Selecione a mais próxima (ex: us-central1)
4. Clique em "Criar Projeto"

### 2.2 Adicionar App Android

1. No Firebase Console, clique em "Adicionar app"
2. Selecione "Android"
3. Preencha:
   - **Nome do pacote**: `com.wavechat.app`
   - **Apelido do app**: `WaveChat Android`
   - **SHA-1**: [Veja seção 2.3]
   - **SHA-256**: [Veja seção 2.3]
4. Clique em "Registrar app"
5. Baixe `google-services.json`
6. Copie para `android/app/google-services.json`

### 2.3 Obter SHA-1 e SHA-256

```bash
# Gerar SHA-1 do keystore
keytool -list -v -keystore wavechat.jks | grep SHA1

# Gerar SHA-256 do keystore
keytool -list -v -keystore wavechat.jks | grep SHA256

# Será solicitada a senha do keystore
```

**Exemplo de saída**:
```
SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
SHA256: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78
```

### 2.4 Verificar Arquivo google-services.json

O arquivo deve conter:

```json
{
  "type": "service_account",
  "project_id": "wavechat-prod",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@wavechat-prod.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

---

## 3. Configuração de Cloud Messaging

### 3.1 Ativar Cloud Messaging API

1. No Firebase Console, vá em "Configurações do projeto"
2. Clique na aba "Cloud Messaging"
3. Verifique se a API está ativada
4. Copie a **Chave do servidor** (Server Key)

**Exemplo**:
```
AAAA1234567:ABC...XYZ
```

### 3.2 Criar Service Account

1. No Firebase Console, vá em "Configurações do projeto"
2. Clique na aba "Contas de serviço"
3. Clique em "Gerar nova chave privada"
4. Salve o arquivo JSON em local seguro

**Arquivo JSON contém**:
- `project_id`
- `private_key`
- `client_email`

---

## 4. Configuração do Android

### 4.1 AndroidManifest.xml

Verificar se as permissões estão presentes:

```xml
<!-- Required for incoming call notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### 4.2 WaveChatMessagingService

O serviço intercepta mensagens FCM:

```java
public class WaveChatMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        if (remoteMessage.getData().get("type").equals("call")) {
            // Mostrar notificação de chamada
            showIncomingCallNotification(remoteMessage.getData());
        } else {
            // Processar outra mensagem
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        }
    }

    @Override
    public void onNewToken(String token) {
        // Salvar token para enviar notificações
        PushNotificationsPlugin.onNewToken(token);
    }
}
```

### 4.3 NativeCallForegroundService

Serviço que mantém a chamada ativa em background:

```java
public class NativeCallForegroundService extends Service {
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String callId = intent.getStringExtra("callId");
        String callerName = intent.getStringExtra("callerName");
        
        // Criar notificação
        Notification notification = createCallNotification(callId, callerName);
        
        // Iniciar como foreground service
        startForeground(NOTIFICATION_ID, notification);
        
        // Tocar ringtone e vibrar
        CallAlertUtils.startCallRingtone(this);
        CallAlertUtils.startCallVibration(this);
        
        return START_STICKY;
    }
}
```

---

## 5. Enviar Notificações de Chamada

### 5.1 Via Backend (Node.js/Express)

```javascript
const admin = require('firebase-admin');

// Inicializar Firebase
const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://wavechat-prod.firebaseio.com'
});

// Enviar notificação de chamada
async function sendCallNotification(callId, calleeId, callerName, kind) {
  const message = {
    data: {
      type: 'call',
      callId: callId,
      callerName: callerName,
      kind: kind,
      conversationId: conversationId
    },
    notification: {
      title: kind === 'video' ? 'Chamada de vídeo' : 'Chamada de voz',
      body: `${callerName} está te ligando…`,
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'wavechat_calls_alert_v10',
        clickAction: 'com.wavechat.app.CALL_NOTIFICATION_CLICKED'
      }
    },
    webpush: {
      notification: {
        title: kind === 'video' ? 'Chamada de vídeo' : 'Chamada de voz',
        body: `${callerName} está te ligando…`,
        icon: '/icon-192.png'
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notificação enviada:', response);
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}
```

### 5.2 Via Python

```python
import firebase_admin
from firebase_admin import credentials, messaging

# Inicializar Firebase
cred = credentials.Certificate('firebase-key.json')
firebase_admin.initialize_app(cred)

# Enviar notificação de chamada
def send_call_notification(call_id, callee_id, caller_name, kind):
    message = messaging.Message(
        data={
            'type': 'call',
            'callId': call_id,
            'callerName': caller_name,
            'kind': kind,
        },
        notification=messaging.Notification(
            title='Chamada de vídeo' if kind == 'video' else 'Chamada de voz',
            body=f'{caller_name} está te ligando…',
        ),
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                sound='default',
                channel_id='wavechat_calls_alert_v10',
                click_action='com.wavechat.app.CALL_NOTIFICATION_CLICKED',
            ),
        ),
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title='Chamada de vídeo' if kind == 'video' else 'Chamada de voz',
                body=f'{caller_name} está te ligando…',
                icon='/icon-192.png',
            ),
        ),
    )

    try:
        response = messaging.send(message)
        print(f'Notificação enviada: {response}')
    except Exception as e:
        print(f'Erro ao enviar notificação: {e}')
```

### 5.3 Via cURL

```bash
# Enviar notificação via FCM REST API
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Content-Type: application/json" \
  -H "Authorization: key=YOUR_FCM_SERVER_KEY" \
  -d '{
    "to": "DEVICE_TOKEN",
    "data": {
      "type": "call",
      "callId": "call-123",
      "callerName": "João",
      "kind": "audio"
    },
    "notification": {
      "title": "Chamada de voz",
      "body": "João está te ligando…",
      "sound": "default"
    }
  }'
```

---

## 6. Testar Notificações

### 6.1 Teste Local

1. Instale o app no dispositivo/emulador
2. Abra o app e verifique o token FCM nos logs
3. Envie uma notificação de teste via Firebase Console

**Via Firebase Console**:
1. Vá em "Messaging" → "Criar primeira campanha"
2. Selecione "Notificação FCM"
3. Preencha título e corpo
4. Selecione "Android" como plataforma
5. Clique em "Enviar notificação de teste"

### 6.2 Teste com App Fechado

1. Instale o app no dispositivo
2. Abra o app e feche completamente
3. Envie uma notificação
4. Verifique se a notificação aparece na bandeja

### 6.3 Teste com App em Background

1. Instale o app no dispositivo
2. Abra o app e pressione o botão "Home"
3. Envie uma notificação
4. Verifique se a notificação aparece

### 6.4 Teste de Chamada

1. Instale o app em dois dispositivos
2. Faça login em ambos
3. Inicie uma chamada de um dispositivo
4. Verifique se o outro dispositivo recebe a notificação

---

## 7. Troubleshooting

### 7.1 Notificações Não Chegam

**Problema**: Notificações não aparecem no dispositivo.

**Soluções**:
1. Verificar se `google-services.json` está correto
2. Verificar se o token FCM foi salvo
3. Verificar permissões no Android
4. Verificar se o serviço FCM está rodando

```bash
# Verificar logs
adb logcat | grep Firebase
adb logcat | grep FCM
adb logcat | grep WaveChat
```

### 7.2 Notificações Chegam Atrasadas

**Problema**: Notificações chegam com delay.

**Soluções**:
1. Usar `priority: 'high'` no Android
2. Usar `webpush.headers.TTL` no Web
3. Implementar polling fallback
4. Usar TURN servers para melhor conectividade

### 7.3 App Não Abre na Notificação

**Problema**: Clicar na notificação não abre o app.

**Solução**: Verificar `clickAction` no AndroidManifest:

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

### 7.4 Notificações Não Tocam em Android Antigo

**Problema**: Ringtone não toca em Android < 9.

**Solução**: Usar fallback tone em `CallAlertUtils.java`:

```java
private static synchronized void startFallbackTone() {
    try {
        fallbackTone = new ToneGenerator(AudioManager.STREAM_RING, 100);
        fallbackHandler = new Handler(Looper.getMainLooper());
        fallbackRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    if (fallbackTone != null) {
                        fallbackTone.startTone(ToneGenerator.TONE_SUP_RINGTONE, 1200);
                    }
                    if (fallbackHandler != null) {
                        fallbackHandler.postDelayed(this, 2500);
                    }
                } catch (Exception ignored) {}
            }
        };
        fallbackHandler.post(fallbackRunnable);
    } catch (Exception ignored) {}
}
```

---

## 8. Segurança

### 8.1 Proteger Chaves

**NÃO fazer**:
```javascript
// ❌ ERRADO: Chave exposta no código
const FCM_KEY = "AAAA1234567:ABC...XYZ";
```

**Fazer**:
```javascript
// ✅ CORRETO: Chave em variável de ambiente
const FCM_KEY = process.env.FCM_SERVER_KEY;
```

### 8.2 Validar Tokens

Sempre validar tokens antes de enviar:

```javascript
async function validateToken(token) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Token inválido:', error);
    return null;
  }
}
```

### 8.3 Rate Limiting

Implementar rate limiting para evitar abuso:

```javascript
const rateLimit = {};

function checkRateLimit(userId) {
  const now = Date.now();
  const lastCall = rateLimit[userId] || 0;
  
  if (now - lastCall < 1000) {
    return false; // Rate limited
  }
  
  rateLimit[userId] = now;
  return true;
}
```

---

## 9. Monitoramento

### 9.1 Métricas para Rastrear

- Taxa de entrega de notificações
- Tempo médio de entrega
- Taxa de abertura de notificações
- Taxa de erro

### 9.2 Logging

```javascript
// Log de envio
console.log(`[FCM] Enviando notificação para ${calleeId}`);
console.log(`[FCM] Tipo: ${kind}, ID: ${callId}`);

// Log de erro
console.error(`[FCM] Erro ao enviar: ${error.message}`);

// Log de sucesso
console.log(`[FCM] Notificação enviada com sucesso: ${response}`);
```

---

## 10. Próximos Passos

1. **Fase 6**: Melhorar PWA (caching, offline)
2. **Fase 7**: Corrigir segurança (secrets, keystore)
3. **Fase 8**: Preparar Google Play Console
4. **Fase 9**: Documentação final

---

## 11. Referências

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Android Push Notifications](https://developer.android.com/guide/topics/connectivity/fcm)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [FCM Best Practices](https://firebase.google.com/docs/cloud-messaging/concept-options)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
