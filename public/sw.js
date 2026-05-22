// Minimal service worker — push notifications only, no caching.
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Keep the PWA installable on Android browsers that still expect a fetch
// handler, without caching pages or serving stale content.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

async function bumpBadge(absolute) {
  try {
    if (!self.navigator || !self.navigator.setAppBadge) return;
    const cache = await caches.open("wavechat-badge");
    let next;
    if (typeof absolute === "number" && absolute >= 0) {
      next = absolute;
    } else {
      const res = await cache.match("count");
      const cur = res ? Number(await res.text()) || 0 : 0;
      next = cur + 1;
    }
    await cache.put("count", new Response(String(next)));
    if (next > 0) await self.navigator.setAppBadge(next);
    else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
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
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: conversationId ? `msg-${conversationId}` : "wavechat-msg",
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: { conversationId, url: conversationId ? `/chat/${conversationId}` : "/" },
      }
    : {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
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

async function setBadge(count) {
  try {
    const cache = await caches.open("wavechat-badge");
    await cache.put("count", new Response(String(count)));
    if (self.navigator && self.navigator.setAppBadge) {
      if (count > 0) await self.navigator.setAppBadge(count);
      else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    }
  } catch {}
}

async function closeCallNotifications(callId) {
  try {
    const notes = await self.registration.getNotifications();
    for (const n of notes) {
      const d = n.data || {};
      if (d.callId && (!callId || d.callId === callId)) {
        n.close();
      } else if (n.tag && n.tag.startsWith("call-")) {
        n.close();
      }
    }
  } catch {}
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear-badge") {
    event.waitUntil(clearBadge());
  } else if (data.type === "set-badge") {
    event.waitUntil(setBadge(Number(data.count) || 0));
  } else if (data.type === "close-call-notifications") {
    event.waitUntil(closeCallNotifications(data.callId));
  } else if (data.type === "skip-waiting") {
    self.skipWaiting();
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
