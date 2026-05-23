# WaveChat - Análise Completa do Projeto

**Data da Análise**: 23 de maio de 2026  
**Versão Atual**: 1.21 (versionCode: 22)  
**Status**: Pronto para correções e melhorias profissionais

---

## 1. Arquitetura do Projeto

### 1.1 Stack Tecnológico

| Componente | Tecnologia | Versão |
|-----------|-----------|--------|
| Frontend | React | 19.2.0 |
| Framework | TanStack Start | 1.167.50 |
| Build | Vite | 7.3.1 |
| CSS | Tailwind CSS | 4.2.1 |
| UI Components | Radix UI | Múltiplas |
| Roteamento | TanStack Router | 1.168.25 |
| Estado | TanStack Query | 5.83.0 |
| Backend | Supabase | 2.106.0 |
| Autenticação | Supabase Auth | Integrado |
| Banco de Dados | PostgreSQL (Supabase) | Gerenciado |
| Pagamentos | Stripe | 22.0.2 |
| Android | Capacitor | 8.3.4 |
| Notificações | Firebase Cloud Messaging | 23.4.1 |
| Chamadas | WebRTC (nativo) | - |
| Linguagem | TypeScript | 5.8.3 |

### 1.2 Estrutura de Diretórios

```
WaveChat/
├── src/                          # Código-fonte React/TypeScript
│   ├── components/               # Componentes React
│   │   ├── call/                 # Tela de chamada (CallScreen.tsx, IncomingCallDialog.tsx)
│   │   ├── chat/                 # Interface de chat
│   │   ├── status/               # Sistema de status
│   │   ├── profile/              # Perfil do usuário
│   │   ├── ui/                   # Componentes UI (Radix)
│   │   └── public/               # Layout público
│   ├── hooks/                    # Hooks customizados
│   ├── routes/                   # Rotas TanStack Router
│   ├── lib/                      # Utilitários
│   └── server.ts                 # SSR entry point
├── android/                      # Código Android nativo
│   ├── app/
│   │   ├── src/main/java/com/wavechat/app/
│   │   │   ├── MainActivity.java
│   │   │   ├── WaveChatMessagingService.java     # FCM handler
│   │   │   ├── CallAlertUtils.java               # Lógica de chamada
│   │   │   ├── IncomingCallActivity.java
│   │   │   ├── NativeCallForegroundService.java
│   │   │   ├── WaveChatConnectionService.java    # Telecom API
│   │   │   ├── WaveChatTelecomManager.java
│   │   │   └── CallStatusPoller.java
│   │   ├── build.gradle                          # Configuração Gradle
│   │   ├── AndroidManifest.xml                   # Permissões e componentes
│   │   └── google-services.json                  # Firebase config
│   ├── build.gradle
│   └── gradle.properties
├── capacitor-app/                # Build output do Capacitor
├── public/                       # Assets estáticos
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── capacitor.config.ts           # Configuração Capacitor
├── vite.config.ts                # Configuração Vite
├── package.json
├── tsconfig.json
└── .env                          # Variáveis de ambiente (⚠️ EXPOSTO)
```

### 1.3 Fluxo de Arquitetura

```
[Usuário Web/PWA]
        ↓
[React App (TanStack Start)]
        ↓
[Supabase (Auth + DB)]
        ↓
[WebRTC Signaling]
        ↓
[Peer-to-Peer Call]

[Usuário Android]
        ↓
[Capacitor Bridge]
        ↓
[React App (mesma)]
        ↓
[Firebase FCM] ← Push notifications
        ↓
[WaveChatMessagingService] ← Intercepta chamadas
        ↓
[Native Call UI + WebRTC]
```

---

## 2. Análise de Funcionalidades

### 2.1 Funcionalidades Implementadas ✓

| Funcionalidade | Status | Observações |
|---|---|---|
| Cadastro/Login | ✓ | Supabase Auth |
| Mensagens em tempo real | ✓ | Supabase Realtime |
| Chamadas de voz | ✓ | WebRTC + FCM |
| Chamadas de vídeo | ✓ | WebRTC + FCM |
| Status (stories) | ✓ | Com impulsionamento |
| Download de mídia | ✓ | Imagens e vídeos |
| Pix semi-automático | ✓ | Integração Stripe |
| PWA instalável | ✓ | Manifest + SW |
| Notificações push | ⚠️ | Incompletas em background |

### 2.2 Problemas Críticos Identificados

#### 🔴 **Chamadas de Voz/Vídeo**

1. **Echo (Eco)**
   - **Causa**: Local stream com áudio incluído sendo reproduzido
   - **Localização**: `src/components/call/CallScreen.tsx` (linhas 25-33)
   - **Solução**: Já parcialmente corrigida (video-only para preview local)
   - **Pendente**: Verificar se há echo em Android antigo

2. **Vibração Contínua Após Atendimento**
   - **Causa**: `CallAlertUtils.startCallVibration()` não é cancelada corretamente
   - **Localização**: `android/app/src/main/java/com/wavechat/app/CallAlertUtils.java` (linha 292)
   - **Problema**: Padrão de vibração `{ 0L, 750L, 450L, 750L, 1400L }` com índice 0 faz repetir infinitamente
   - **Solução**: Chamar `stopVibration()` imediatamente após atender

3. **Câmera Invertida ao Movimentar**
   - **Causa**: `scaleX(-1)` aplicado ao video local, mas pode haver problema com orientação
   - **Localização**: `src/components/call/CallScreen.tsx` (linha 108)
   - **Solução**: Adicionar `transform-gpu` e verificar em Android

4. **Delay nas Chamadas**
   - **Causa**: Possível latência de signaling via Supabase
   - **Solução**: Implementar TURN servers e otimizar ICE candidates

5. **Chamada Continua Chamando Após Atender**
   - **Causa**: Ringtone não é parado corretamente em Android antigo
   - **Localização**: `CallAlertUtils.stopCallRingtone()` (linha 276)
   - **Problema**: Em Android < 9, `setLooping()` pode não funcionar
   - **Solução**: Implementar fallback tone com cancelamento explícito

6. **Câmera/Microfone Não Desligam Corretamente**
   - **Causa**: Tracks não são paradas antes de remover do stream
   - **Solução**: Implementar `track.stop()` antes de remover

#### 🟡 **Notificações Push**

1. **Notificações Não Chegam com App Fechado**
   - **Causa**: Firebase não configurado corretamente
   - **Localização**: `android/app/google-services.json` (placeholder)
   - **Solução**: Usar service account real

2. **Atrasos de Notificações**
   - **Causa**: FCM pode ter latência, especialmente em Android antigo
   - **Solução**: Implementar polling fallback

3. **Chamadas Não Recebidas em Background**
   - **Causa**: `WaveChatMessagingService` pode não ser chamado
   - **Localização**: `AndroidManifest.xml` (linha 89-96)
   - **Solução**: Adicionar `directBootAware` e `foregroundServiceType`

#### 🟡 **Segurança**

1. **Secrets Expostos no `.env`**
   - **Risco**: Supabase publishable key está no repositório
   - **Problema**: Mesmo sendo "public", não deve estar em `.env` versionado
   - **Solução**: Mover para `.env.example` e usar variáveis de build

2. **Keystore com Senhas Hardcoded**
   - **Localização**: `android/app/build.gradle` (linhas 21-24)
   - **Risco**: Senhas visíveis no código
   - **Solução**: Usar variáveis de ambiente

3. **Sem `.gitignore` Adequado**
   - **Problema**: `.env`, `keystore.jks`, `google-services.json` podem ser commitados
   - **Solução**: Atualizar `.gitignore`

#### 🟡 **PWA**

1. **Service Worker Muito Simples**
   - **Problema**: Não faz cache de assets
   - **Localização**: `public/sw.js` (linhas 1-15)
   - **Solução**: Implementar caching estratégico

2. **Manifest Incompleto**
   - **Problema**: Faltam screenshots, categorias adicionais
   - **Solução**: Adicionar mais informações

3. **Splash Screen Não Customizado**
   - **Problema**: Usa cor padrão
   - **Solução**: Adicionar imagem customizada

#### 🟡 **Interface de Chamada**

1. **Não Parece Profissional**
   - **Problema**: Não se parece com WhatsApp/Telegram
   - **Solução**: Redesenhar com animações modernas

2. **Falta Tela de Chamada Recebida**
   - **Problema**: `IncomingCallDialog.tsx` é muito simples
   - **Solução**: Criar tela full-screen estilo WhatsApp

3. **Botões Pouco Intuitivos**
   - **Problema**: Botões de controle não são claros
   - **Solução**: Adicionar ícones maiores e labels

#### 🟡 **Android Build**

1. **versionCode Pode Não Incrementar**
   - **Localização**: `android/app/build.gradle` (linha 10)
   - **Problema**: Hardcoded em 22
   - **Solução**: Usar script para incrementar automaticamente

2. **Package Name Correto**
   - ✓ `com.wavechat.app` está correto

3. **AAB vs APK**
   - **Problema**: Guia menciona APK, mas Google Play exige AAB
   - **Solução**: Gerar AAB (Android App Bundle)

---

## 3. Problemas de Segurança

### 3.1 Exposição de Secrets

**Arquivo**: `.env`

```
SUPABASE_PUBLISHABLE_KEY="eyJhbGc..." ❌ EXPOSTO
SUPABASE_URL="https://njqywbuc..." ❌ EXPOSTO
```

**Impacto**: Baixo (keys são públicas por design), mas não é prática recomendada.

**Solução**:
- Criar `.env.example` com placeholders
- Adicionar `.env` ao `.gitignore`
- Usar variáveis de build do Vite

### 3.2 Keystore Inseguro

**Arquivo**: `android/app/build.gradle` (linhas 21-24)

```gradle
storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "WaveChat2026" ❌
keyPassword System.getenv("ANDROID_KEY_PASSWORD") ?: "WaveChat2026" ❌
```

**Impacto**: Alto - Qualquer pessoa pode assinar APKs com a mesma chave.

**Solução**:
- Gerar novo keystore com senha forte
- Usar variáveis de ambiente obrigatórias
- Não ter fallback de senha

### 3.3 Firebase Config Exposto

**Arquivo**: `android/app/google-services.json`

```json
{
  "project_info": {
    "project_number": "...",
    "firebase_url": "...",
    "project_id": "..."
  }
}
```

**Impacto**: Médio - Pode ser usado para enviar mensagens FCM não autorizadas.

**Solução**:
- Adicionar ao `.gitignore`
- Usar `.example` file
- Gerar novo projeto Firebase

---

## 4. Análise de Chamadas WebRTC

### 4.1 Fluxo Atual de Chamada

```
[Usuário A] → Inicia chamada → [Supabase] → [FCM]
                                    ↓
                            [Usuário B Android]
                                    ↓
                        [WaveChatMessagingService]
                                    ↓
                        [Notificação + Ringtone]
                                    ↓
                        [Usuário B atende]
                                    ↓
                        [WebRTC P2P Connection]
                                    ↓
                        [Audio/Video Stream]
```

### 4.2 Problemas Identificados

1. **Sem TURN Servers**: Conexões podem falhar atrás de NAT
2. **Sem Reconexão Automática**: Se a conexão cair, não reconecta
3. **Sem Timeout**: Chamada pode ficar pendurada indefinidamente
4. **Sem Fallback**: Se WebRTC falhar, não há alternativa

### 4.3 Soluções Propostas

1. Adicionar TURN servers (Coturn ou serviço gerenciado)
2. Implementar reconexão automática
3. Adicionar timeout de 45 segundos
4. Implementar fallback para áudio-only se vídeo falhar

---

## 5. Análise de Notificações

### 5.1 Fluxo Atual

```
[Backend] → [Firebase FCM] → [Android Device]
                                    ↓
                        [WaveChatMessagingService]
                                    ↓
                        [NativeCallForegroundService]
                                    ↓
                        [Notificação + Ringtone]
```

### 5.2 Problemas

1. **FCM pode não entregar em background**
   - Solução: Usar `foregroundServiceType="remoteMessaging"`

2. **Ringtone pode não tocar em Android antigo**
   - Solução: Implementar fallback com `ToneGenerator`

3. **Vibração pode não parar**
   - Solução: Chamar `stopVibration()` explicitamente

4. **Notificação pode ser descartada**
   - Solução: Usar `setTimeoutAfter()` e `setOngoing(true)`

---

## 6. Análise de PWA

### 6.1 Estado Atual

- ✓ Manifest JSON configurado
- ✓ Service Worker registrado
- ✓ Icons definidos (192x512)
- ⚠️ Caching não otimizado
- ⚠️ Splash screen não customizado
- ⚠️ Offline mode limitado

### 6.2 Melhorias Necessárias

1. Implementar cache-first para assets estáticos
2. Implementar network-first para dados dinâmicos
3. Adicionar splash screen customizado
4. Melhorar offline experience
5. Adicionar shortcuts (quick actions)

---

## 7. Análise de Interface

### 7.1 Tela de Chamada Atual

**Localização**: `src/components/call/CallScreen.tsx`

**Problemas**:
- Botões pequenos (size-14, size-16)
- Sem animações de entrada/saída
- Sem indicador de duração
- Sem indicador de qualidade de conexão
- Sem opção de speaker/mute rápido

**Comparação com WhatsApp**:
- ❌ Sem animação de pulsação no botão de atender
- ❌ Sem transição suave
- ❌ Sem indicador de tempo de chamada
- ❌ Sem opção de trocar câmera

### 7.2 Tela de Chamada Recebida

**Localização**: `src/components/call/IncomingCallDialog.tsx`

**Problemas**:
- Muito simples
- Sem animação
- Sem full-screen
- Sem ringtone visual

---

## 8. Checklist de Correções

### Fase 1: Análise ✓
- [x] Identificar framework (TanStack Start)
- [x] Identificar backend (Supabase)
- [x] Identificar Android (Capacitor)
- [x] Identificar PWA (Manifest + SW)
- [x] Listar problemas

### Fase 2: Android/AAB
- [ ] Incrementar versionCode para 23
- [ ] Gerar novo keystore
- [ ] Configurar gradle para AAB
- [ ] Testar build em Android antigo

### Fase 3: Chamadas
- [ ] Corrigir echo
- [ ] Corrigir vibração
- [ ] Corrigir câmera
- [ ] Adicionar TURN servers
- [ ] Adicionar reconexão

### Fase 4: Interface
- [ ] Redesenhar tela de chamada
- [ ] Adicionar animações
- [ ] Melhorar botões
- [ ] Adicionar indicadores

### Fase 5: Notificações
- [ ] Configurar FCM corretamente
- [ ] Implementar foreground service
- [ ] Testar em background
- [ ] Testar em Android antigo

### Fase 6: PWA
- [ ] Melhorar service worker
- [ ] Adicionar caching
- [ ] Adicionar splash screen
- [ ] Testar offline

### Fase 7: Segurança
- [ ] Mover secrets para .env.example
- [ ] Gerar novo keystore
- [ ] Atualizar .gitignore
- [ ] Remover google-services.json

### Fase 8: Google Play
- [ ] Preparar assets
- [ ] Revisar permissões
- [ ] Revisar políticas
- [ ] Preparar para closed testing

### Fase 9: Documentação
- [ ] Criar guia de build
- [ ] Criar guia de publicação
- [ ] Documentar versionCode
- [ ] Documentar secrets

---

## 9. Próximos Passos

1. **Fase 2**: Corrigir Android/AAB (versionCode, keystore, build)
2. **Fase 3**: Corrigir bugs de chamada (echo, vibração, câmera)
3. **Fase 4**: Melhorar interface (estilo WhatsApp)
4. **Fase 5**: Corrigir notificações (FCM, background)
5. **Fase 6**: Melhorar PWA (caching, offline)
6. **Fase 7**: Corrigir segurança (secrets, keystore)
7. **Fase 8**: Preparar Google Play (assets, políticas)
8. **Fase 9**: Documentar tudo

---

## 10. Estimativa de Tempo

| Fase | Tempo |
|------|-------|
| 1. Análise | ✓ Concluída |
| 2. Android/AAB | 2-3 horas |
| 3. Chamadas | 4-6 horas |
| 4. Interface | 3-4 horas |
| 5. Notificações | 2-3 horas |
| 6. PWA | 2-3 horas |
| 7. Segurança | 1-2 horas |
| 8. Google Play | 1-2 horas |
| 9. Documentação | 1-2 horas |
| **Total** | **~19-28 horas** |

---

**Análise concluída em 23 de maio de 2026.**
