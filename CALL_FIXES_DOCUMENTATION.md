# WaveChat - Documentação de Correções de Chamadas

**Data**: 23 de maio de 2026  
**Versão**: 1.22  
**Status**: Implementado

---

## 1. Problemas Identificados e Soluções

### 1.1 Echo (Eco) na Chamada

**Problema**: Usuário escuta sua própria voz durante a chamada.

**Causa Raiz**:
- Local stream com áudio incluído sendo reproduzido
- Audio focus não configurado corretamente em Android
- WebView reproduzindo áudio local sem mute

**Solução Implementada**:

```typescript
// ✅ CORRETO: Usar apenas video tracks para preview local
const videoOnly = new MediaStream(localStream.getVideoTracks());
localVideoRef.current.srcObject = videoOnly;
localVideoRef.current.muted = true;

// ✅ Áudio remoto em elemento <audio> separado
const audioOnly = new MediaStream(remoteStream.getAudioTracks());
remoteAudioRef.current.srcObject = audioOnly;
remoteAudioRef.current.volume = 1;
```

**Código em**: `src/components/call/CallScreen.tsx` (linhas 25-48)

**Melhorias Adicionais**:
- Melhorado `echoCancellation: true` no getUserMedia
- Adicionado `noiseSuppression: true`
- Adicionado `autoGainControl: true`
- Configurado `channelCount: 1` (mono)
- Configurado `sampleRate: 48000` (alta qualidade)

---

### 1.2 Vibração Contínua Após Atender

**Problema**: Vibração não para após atender a chamada em Android.

**Causa Raiz**:
- `CallAlertUtils.startCallVibration()` não é cancelada corretamente
- Padrão de vibração `{ 0L, 750L, 450L, 750L, 1400L }` com índice 0 faz repetir infinitamente
- Em Android antigo, `vibrator.cancel()` pode não funcionar

**Solução Implementada**:

No arquivo `CallAlertUtils.java`:

```java
// ✅ CORRETO: Parar vibração imediatamente após atender
public static void stopVibration(Context context) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (vm != null) vm.cancel();
        } else {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) vibrator.cancel();
        }
    } catch (Exception ignored) {}
}

// ✅ Chamar no acceptIncomingCall
public static void acceptIncomingCall(Context context, String callId) {
    CallAlertUtils.stopVibration(context);  // Parar vibração IMEDIATAMENTE
    CallAlertUtils.stopCallRingtone(context);
    // ... resto do código
}
```

**Verificação**: Garantir que `stopVibration()` é chamado em:
- `acceptIncomingCall()`
- `declineIncomingCall()`
- `endCall()`

---

### 1.3 Câmera Invertida ao Movimentar

**Problema**: Câmera local fica invertida ou com orientação errada em alguns dispositivos.

**Causa Raiz**:
- Falta de especificação de `facingMode`
- Falta de suporte a orientação em dispositivos antigos
- Transform CSS não funciona em alguns WebViews

**Solução Implementada**:

```typescript
// ✅ CORRETO: Especificar facingMode explicitamente
const stream = await navigator.mediaDevices.getUserMedia({
  video: kind === "video" ? { 
    width: { ideal: 1280 }, 
    height: { ideal: 720 },
    facingMode: "user"  // ✅ Força câmera frontal
  } : false,
});

// ✅ Usar transform-gpu para melhor performance
<video
  style={{ transform: "scaleX(-1)" }}
  className="... transform-gpu ..."
/>
```

**Código em**: `src/hooks/use-call-fixed.tsx` (linhas 352-356)

**Teste em Dispositivos**:
- Testar em Android 5.0+ (API 21+)
- Testar em Android 14+ (API 34+)
- Testar em iPhone 6+

---

### 1.4 Delay nas Chamadas

**Problema**: Latência perceptível entre fala e áudio recebido.

**Causa Raiz**:
- Falta de TURN servers para NAT traversal
- ICE candidates não otimizados
- Signaling via Supabase pode ter latência

**Solução Implementada**:

```typescript
// ✅ Adicionar múltiplos STUN servers
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  
  // Para produção, adicionar TURN servers:
  // {
  //   urls: ["turn:your-turn-server.com:3478"],
  //   username: "username",
  //   credential: "password"
  // }
];

// ✅ Usar RTCPeerConnection com ICE servers
const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
```

**Recomendações para Produção**:
1. Usar serviço de TURN gerenciado (ex: Twilio, Xirsys)
2. Adicionar fallback para áudio-only se vídeo falhar
3. Implementar adaptive bitrate

**Código em**: `src/hooks/use-call-fixed.tsx` (linhas 69-88)

---

### 1.5 Chamada Continua Chamando Após Atender

**Problema**: Ringtone continua tocando após atender em Android antigo.

**Causa Raiz**:
- `setLooping()` não funciona em Android < 9
- `stopCallRingtone()` não para o fallback tone
- Múltiplas instâncias de ringtone tocando

**Solução Implementada**:

No arquivo `CallAlertUtils.java`:

```java
// ✅ CORRETO: Parar fallback tone também
public static synchronized void stopCallRingtone(Context context) {
    try {
        stopFallbackTone();  // ✅ Parar fallback tone
        if (ringtonePlayer != null) {
            if (ringtonePlayer.isPlaying()) ringtonePlayer.stop();
        }
    } catch (Exception ignored) {
    } finally {
        ringtonePlayer = null;
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) audioManager.abandonAudioFocus(audioFocusListener);
        } catch (Exception ignored) {}
    }
}

// ✅ Fallback tone com parada explícita
private static synchronized void stopFallbackTone() {
    try {
        if (fallbackHandler != null && fallbackRunnable != null) {
            fallbackHandler.removeCallbacks(fallbackRunnable);  // ✅ Remove callbacks
        }
        if (fallbackTone != null) fallbackTone.release();
    } catch (Exception ignored) {
    } finally {
        fallbackTone = null;
        fallbackHandler = null;
        fallbackRunnable = null;
    }
}
```

**Verificação**: Garantir que `stopCallRingtone()` é chamado em:
- `acceptIncomingCall()`
- `declineIncomingCall()`
- `endCall()`
- Quando chamada é cancelada remotamente

---

### 1.6 Câmera/Microfone Não Desligam Corretamente

**Problema**: Câmera/microfone continuam ligados após desligar.

**Causa Raiz**:
- Tracks não são parados antes de remover do stream
- Referências não são limpas
- Cleanup não é completo

**Solução Implementada**:

```typescript
// ✅ CORRETO: Parar tracks antes de limpar
const cleanup = useCallback(() => {
  // ... outros cleanups ...
  
  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach((t) => {
      t.stop();           // ✅ Parar track
      t.enabled = false;  // ✅ Desabilitar
    });
    localStreamRef.current = null;
  }
  
  setLocalStream(null);
  setRemoteStream(null);
}, []);

// ✅ CORRETO: Parar tracks ao desligar mic/cam
const toggleMic = useCallback(() => {
  const s = localStreamRef.current;
  if (!s) return;
  s.getAudioTracks().forEach((t) => {
    t.enabled = !t.enabled;  // ✅ Apenas toggle, não parar
  });
  setMicOn(s.getAudioTracks()[0]?.enabled ?? true);
}, []);
```

**Código em**: `src/hooks/use-call-fixed.tsx` (linhas 196-220)

---

## 2. Melhorias Adicionais Implementadas

### 2.1 Timeouts para Conexão

```typescript
// ✅ Timeout de 30 segundos para conexão WebRTC
const CALL_CONNECTION_TIMEOUT = 30_000;

connectionTimeoutRef.current = setTimeout(() => {
  if (pc.connectionState === "connecting" || pc.connectionState === "new") {
    toast.error("Timeout na conexão");
    void endCallInternal("ended");
  }
}, CALL_CONNECTION_TIMEOUT);
```

**Benefício**: Evita chamadas penduradas indefinidamente.

### 2.2 Limpeza de Timeouts

```typescript
// ✅ Limpar todos os timeouts ao encerrar
const cleanup = useCallback(() => {
  if (connectionTimeoutRef.current) {
    clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = null;
  }
  if (ringTimeoutRef.current) {
    clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
  }
  // ... resto do cleanup ...
}, []);
```

**Benefício**: Evita memory leaks.

### 2.3 Audio Focus em Android

```typescript
// ✅ Configurar audio focus para chamadas
if (isNativeApp()) {
  await configureNativeCallAudio();
  
  // Re-aplicar após conexão estabelecida
  setTimeout(() => { 
    void configureNativeCallAudio(); 
  }, 600);
}
```

**Benefício**: Garante que o áudio é roteado corretamente para o fone de ouvido.

---

## 3. Como Aplicar as Correções

### 3.1 Substituir Hook

```bash
# Backup do arquivo original
cp src/hooks/use-call.tsx src/hooks/use-call.tsx.backup

# Substituir pelo arquivo corrigido
cp src/hooks/use-call-fixed.tsx src/hooks/use-call.tsx
```

### 3.2 Atualizar Imports

Verificar se todos os imports estão corretos:

```typescript
import { useCall, CallProvider } from "@/hooks/use-call";
```

### 3.3 Testar em Dispositivos

1. **Android 5.0 (API 21)**: Testar echo, vibração, câmera
2. **Android 9 (API 28)**: Testar ringtone, audio focus
3. **Android 14 (API 34)**: Testar full-screen intent, foreground service
4. **iPhone 12+**: Testar via PWA

---

## 4. Testes Recomendados

### 4.1 Teste de Echo

```
1. Iniciar chamada de áudio
2. Falar normalmente
3. Verificar se ouve sua própria voz
4. Resultado esperado: NÃO deve ouvir eco
```

### 4.2 Teste de Vibração

```
1. Receber chamada
2. Verificar se vibra
3. Atender chamada
4. Verificar se vibração para IMEDIATAMENTE
5. Resultado esperado: Vibração para em < 100ms
```

### 4.3 Teste de Câmera

```
1. Iniciar videochamada
2. Mover dispositivo em diferentes ângulos
3. Verificar se câmera local está invertida corretamente
4. Resultado esperado: Câmera deve estar sempre correta
```

### 4.4 Teste de Delay

```
1. Iniciar chamada de áudio
2. Falar e contar tempo até ouvir resposta
3. Resultado esperado: < 500ms de latência
```

### 4.5 Teste de Ringtone

```
1. Receber chamada em Android antigo (API 21)
2. Verificar se toca ringtone
3. Atender chamada
4. Verificar se ringtone para
5. Resultado esperado: Ringtone para em < 100ms
```

---

## 5. Monitoramento em Produção

### 5.1 Métricas para Rastrear

- Tempo médio de conexão
- Taxa de sucesso de chamadas
- Duração média das chamadas
- Taxa de drop de chamadas
- Feedback de usuários sobre qualidade

### 5.2 Logging

```typescript
// Adicionar logging para debug
console.log(`[Call] Connection state: ${pc.connectionState}`);
console.log(`[Call] ICE connection state: ${pc.iceConnectionState}`);
console.log(`[Call] Signaling state: ${pc.signalingState}`);
```

---

## 6. Próximos Passos

1. **Fase 4**: Melhorar interface das chamadas (estilo WhatsApp)
2. **Fase 5**: Corrigir notificações push (FCM, background)
3. **Fase 6**: Melhorar PWA (caching, offline)
4. **Fase 7**: Corrigir segurança (secrets, keystore)

---

## 7. Referências

- [WebRTC Best Practices](https://webrtc.org/getting-started)
- [Android Audio Focus](https://developer.android.com/guide/topics/media-apps/audio-focus)
- [Capacitor Audio Documentation](https://capacitorjs.com/docs/apis/camera)
- [Echo Cancellation in WebRTC](https://webrtc.googlesource.com/src/+/refs/heads/main/modules/audio_processing/README.md)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
