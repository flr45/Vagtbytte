self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const notificationLink = String(data.link || "");
  const isAlarmNotification =
    notificationLink.startsWith("/brandmand/alarmer") || String(data.tag || "").startsWith("alarm:");
  const title = String(data.title || "SBR Portal");
  const rawBody = String(data.body || "");
  const hasPrimaryAlarmMarker = /(^|\s)\((ISL|[ABSKLR])\)(?=\s|$)/i.test(rawBody);

  // Alarmopfølgninger gemmes i feedet, men må ikke give push. Andre
  // notifikationstyper, herunder VC-hændelser, påvirkes ikke af denne regel.
  if (isAlarmNotification && !hasPrimaryAlarmMarker) {
    return;
  }

  const options = {
    body: isAlarmNotification
      ? "Åbn SBR Portal for at se alarmmeldingen."
      : data.body || "Der er en ny besked i SBR Portal.",
    icon: "/icon.svg",
    badge: "/icon-192.png",
    tag: data.tag || data.notificationId || undefined,
    renotify: data.urgency === "high",
    data: {
      notificationId: data.notificationId || null,
      link: data.link || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationId =
    event.notification.data && event.notification.data.notificationId ? event.notification.data.notificationId : null;
  const link = event.notification.data && event.notification.data.link ? event.notification.data.link : "/";
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(openNotificationTarget(targetUrl, notificationId));
});

async function openNotificationTarget(targetUrl, notificationId) {
  if (notificationId) {
    try {
      await fetch("/api/notifications/open", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId })
      });
    } catch {
      // Navigationen skal stadig gennemføres, selv om markering som åbnet fejler.
    }
  }

  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const exactWindow = windows.find((client) => client.url === targetUrl);
  if (exactWindow && "focus" in exactWindow) {
    return exactWindow.focus();
  }

  const portalWindow = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (portalWindow && "navigate" in portalWindow) {
    try {
      const navigated = await portalWindow.navigate(targetUrl);
      if (navigated && "focus" in navigated) {
        return navigated.focus();
      }
    } catch {
      // Fald videre til openWindow nedenfor.
    }
  }

  return self.clients.openWindow(targetUrl);
}
