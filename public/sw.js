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
  const hasPrimaryStationMarker =
    /\((ISL|[ABSKLR])\)/i.test(rawBody) || /(^|[^A-Z0-9])ISL(?=$|[^A-Z0-9])/i.test(rawBody);

  // Backendens visuelle gruppering kan samle en løs opfølgende besked ind under
  // den rigtige alarm, selv om den bagved stadig har sekvensnummer 1. Derfor
  // afgøres push ikke ud fra titel/sekvens, men ud fra om selve SMS-teksten har
  // den stationsmarkør, som kun primærmeldingen indeholder.
  if (isAlarmNotification && !hasPrimaryStationMarker) {
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

  event.waitUntil(
    Promise.all([
      notificationId
        ? fetch("/api/notifications/open", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId })
          }).catch(() => undefined)
        : Promise.resolve(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && "focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
    ])
  );
});
