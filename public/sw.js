// Minimal service worker — push notifications only, no caching.
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Wavechat", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Chamada recebida";
  const body = data.body || "Alguém está te ligando";
  const callId = data.callId;
  const conversationId = data.conversationId;
  const kind = data.kind || "audio";

  const options = {
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

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  const url = data.url || "/";
  const targetUrl = action === "decline"
    ? `${url}?call=decline&id=${data.callId || ""}`
    : `${url}?call=accept&id=${data.callId || ""}`;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch {}
          }
          client.postMessage({ type: "call-action", action: action || "accept", callId: data.callId });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
