# WaveChat - Guia de Melhorias PWA

**Data**: 23 de maio de 2026  
**Versão**: 1.22  
**Status**: Implementado

---

## 1. Visão Geral

PWA (Progressive Web App) permite:
- ✅ Instalação na tela inicial
- ✅ Funcionamento offline
- ✅ Sincronização em background
- ✅ Notificações push
- ✅ Aparência de app nativo

---

## 2. Manifest.json

### 2.1 Estrutura Completa

```json
{
  "name": "WaveChat",
  "short_name": "WaveChat",
  "description": "WaveChat — chat, chamadas de voz e vídeo em tempo real.",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui", "browser"],
  "orientation": "any",
  "background_color": "#0c2340",
  "theme_color": "#0c2340",
  "lang": "pt-BR",
  "dir": "ltr",
  "categories": ["social", "communication", "productivity"],
  "screenshots": [
    {
      "src": "/screenshot-1.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshot-2.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-192-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "shortcuts": [
    {
      "name": "Nova Conversa",
      "short_name": "Conversa",
      "description": "Iniciar uma nova conversa",
      "url": "/new-chat",
      "icons": [
        {
          "src": "/icon-new-chat.png",
          "sizes": "192x192"
        }
      ]
    },
    {
      "name": "Status",
      "short_name": "Status",
      "description": "Ver status",
      "url": "/status",
      "icons": [
        {
          "src": "/icon-status.png",
          "sizes": "192x192"
        }
      ]
    }
  ]
}
```

### 2.2 Campos Importantes

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **name** | Nome completo | WaveChat |
| **short_name** | Nome curto (12 caracteres) | WaveChat |
| **description** | Descrição | Chat com chamadas |
| **start_url** | URL inicial | / |
| **display** | Modo de exibição | standalone |
| **background_color** | Cor de fundo | #0c2340 |
| **theme_color** | Cor do tema | #0c2340 |
| **icons** | Ícones do app | Array de ícones |
| **screenshots** | Screenshots | Array de screenshots |

---

## 3. Service Worker Melhorado

### 3.1 Estratégia de Caching

```javascript
// public/sw.js

const CACHE_NAME = 'wavechat-v1';
const RUNTIME_CACHE = 'wavechat-runtime-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install: Cache assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: Limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Estratégia cache-first para assets, network-first para dados
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // Cache-first para assets estáticos
  if (
    url.pathname.startsWith('/icon-') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // Network-first para dados dinâmicos
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'WaveChat',
      body: event.data ? event.data.text() : 'Nova notificação',
    };
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'wavechat-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'WaveChat', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Badge API para contador de mensagens
async function bumpBadge(absolute) {
  try {
    if (!self.navigator || !self.navigator.setAppBadge) return;
    const cache = await caches.open('wavechat-badge');
    let next;
    if (typeof absolute === 'number' && absolute >= 0) {
      next = absolute;
    } else {
      const res = await cache.match('count');
      const cur = res ? Number(await res.text()) || 0 : 0;
      next = cur + 1;
    }
    await cache.put('count', new Response(String(next)));
    if (next > 0) await self.navigator.setAppBadge(next);
    else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch {}
}

async function clearBadge() {
  try {
    const cache = await caches.open('wavechat-badge');
    await cache.put('count', new Response('0'));
    if (self.navigator && self.navigator.clearAppBadge) {
      await self.navigator.clearAppBadge();
    }
  } catch {}
}
```

### 3.2 Registrar Service Worker

```html
<!-- public/index.html -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('Service Worker registrado:', registration);
    }).catch((error) => {
      console.error('Erro ao registrar Service Worker:', error);
    });
  }
</script>
```

---

## 4. Splash Screen

### 4.1 Criar Splash Screen

```html
<!-- public/index.html -->
<link rel="apple-touch-startup-image" href="/splash-screen.png">
```

**Tamanho recomendado**: 1242x2208px (iPhone 6 Plus)

### 4.2 Splash Screen no Capacitor

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wavechat.app',
  appName: 'WaveChat',
  webDir: 'capacitor-app',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#0c2340',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
```

---

## 5. Instalação na Tela Inicial

### 5.1 Prompt de Instalação

```typescript
// src/components/InstallPrompt.tsx
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('App instalado');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Download className="size-5" />
        <span>Instalar WaveChat na tela inicial</span>
      </div>
      <Button
        onClick={handleInstall}
        className="bg-white text-blue-600 hover:bg-gray-100"
        size="sm"
      >
        Instalar
      </Button>
    </div>
  );
}
```

---

## 6. Offline Mode

### 6.1 Detectar Conexão

```typescript
// src/hooks/use-online.ts
import { useEffect, useState } from 'react';

export function useOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### 6.2 Sincronização em Background

```typescript
// src/hooks/use-background-sync.ts
import { useEffect } from 'react';

export function useBackgroundSync() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('sync-messages');
      });
    }
  }, []);
}
```

---

## 7. Lighthouse Audit

### 7.1 Verificar PWA Score

```bash
# Usar Lighthouse CLI
npm install -g lighthouse
lighthouse https://webconnectchat.com --view

# Ou usar Chrome DevTools
# 1. Abra Chrome DevTools (F12)
# 2. Vá em Lighthouse
# 3. Clique em "Analyze page load"
```

### 7.2 Critérios PWA

- ✅ Manifest válido
- ✅ Service Worker registrado
- ✅ HTTPS ativado
- ✅ Ícones presentes
- ✅ Splash screen
- ✅ Responsivo
- ✅ Fast loading

---

## 8. Testes

### 8.1 Teste de Instalação

1. Abra o app no Chrome
2. Clique no ícone de instalação (canto superior direito)
3. Clique em "Instalar"
4. Verifique se o app foi instalado na tela inicial

### 8.2 Teste Offline

1. Abra o app
2. Desconecte a internet
3. Navegue no app
4. Verifique se funciona offline

### 8.3 Teste de Notificações

1. Abra o app
2. Permita notificações
3. Envie uma notificação push
4. Verifique se aparece

---

## 9. Próximos Passos

1. **Fase 7**: Corrigir segurança (secrets, keystore)
2. **Fase 8**: Preparar Google Play Console
3. **Fase 9**: Documentação final

---

## 10. Referências

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
