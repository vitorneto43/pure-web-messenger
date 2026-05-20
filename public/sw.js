// Minimal service worker — push notifications only, no caching.
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

async function bumpBadge() {
  try {
    if (!self.navigator || !self.navigator.setAppBadge) return;
    const cache = await caches.open("wavechat-badge");
    const res = await cache.match("count");
    const cur = res ? Number(await res.text()) || 0 : 0;
    const next = cur + 1;
    await cache.put("count", new Response(String(next)));
    await self.navigator.setAppBadge(next);
  } catch {}
}

async function clearBadge() {
  try {
    const cache = await caches.open("wavechat-badge");
    await cache.put("count", new Response("0"));
    if (self.navigator && self.navigator.clearAppBadge) {
      await self.navigator.clearAppBadge();
    }
  } catch {}
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Wavechat", body: event.data ? event.data.text() : "" };
  }

  const isMessage = data.type === "message";
  const title = data.title || (isMessage ? "Nova mensagem" : "Chamada recebida");
  const body = data.body || (isMessage ? "" : "Alguém está te ligando");
  const callId = data.callId;
  const conversationId = data.conversationId;
  const kind = data.kind || "audio";

  const options = isMessage
    ? {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: conversationId ? `msg-${conversationId}` : "wavechat-msg",
        renotify: true,
        vibrate: [120, 60, 120],
        data: { conversationId, url: conversationId ? `/chat/${conversationId}` : "/" },
      }
    : {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: callId ? `call-${callId}` : "wavechat-call",
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 200, 400, 200, 400, 200, 400],
        data: { callId, conversationId, kind, url: conversationId ? `/chat/${conversationId}` : "/" },
        actions: [
          { action: "accept", title: "Atender" },
          { action: "decline", title: "Recusar" },
        ],
      };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      if (isMessage) await bumpBadge();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-badge") {
    event.waitUntil(clearBadge());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  const url = data.url || "/";
  const isCall = !!data.callId;
  const targetUrl = isCall
    ? (action === "decline"
        ? `${url}?call=decline&id=${data.callId || ""}`
        : `${url}?call=accept&id=${data.callId || ""}`)
    : url;

  event.waitUntil(
    (async () => {
      if (!isCall) await clearBadge();
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch {}
          }
          if (isCall) {
            client.postMessage({ type: "call-action", action: action || "accept", callId: data.callId });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
