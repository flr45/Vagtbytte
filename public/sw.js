const OPERATIONAL_CACHE = "sbr-operativ-v0.10";
const STATIC_CACHE = "sbr-static-v0.10";
const OFFLINE_FALLBACK = "/offline-operativ.html";
const STATIC_ASSETS = [
  OFFLINE_FALLBACK,
  "/operativ-manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => (name.startsWith("sbr-operativ-") && name !== OPERATIONAL_CACHE) || (name.startsWith("sbr-static-") && name !== STATIC_CACHE))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (type === "CLEAR_OPERATIONAL_CACHE") {
    event.waitUntil(clearOperationalCache(true));
    return;
  }
  if (type === "SYNC_OPERATIONAL_OFFLINE") {
    event.waitUntil(syncOperationalOffline());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/login") {
    event.waitUntil(clearOperationalCache(false));
    return;
  }

  if (request.mode === "navigate" && isOperationalPath(url.pathname)) {
    event.respondWith(networkFirstOperational(request));
    return;
  }

  if (url.pathname.startsWith("/api/admin/operativ-portal/billeder/")) {
    event.respondWith(cacheFirstOperationalAsset(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
  }
});

async function networkFirstOperational(request) {
  const cache = await caches.open(OPERATIONAL_CACHE);
  const key = normalizedCacheRequest(request.url);
  try {
    const response = await fetch(request);
    if (isAuthenticationFailure(response)) {
      await clearOperationalCache(false);
      return response;
    }
    if (response.ok && !response.redirected) {
      await cache.put(key, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(key, { ignoreVary: true })) || (await caches.match(OFFLINE_FALLBACK));
  }
}

async function cacheFirstOperationalAsset(request) {
  const cache = await caches.open(OPERATIONAL_CACHE);
  const key = normalizedCacheRequest(request.url);
  const cached = await cache.match(key, { ignoreVary: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isAuthenticationFailure(response)) {
      await clearOperationalCache(false);
      return response;
    }
    if (response.ok && !response.redirected) await cache.put(key, response.clone());
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function syncOperationalOffline() {
  try {
    const indexResponse = await fetch("/api/admin/operativ-portal/offline-index", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!indexResponse.ok) {
      if (indexResponse.status === 401 || indexResponse.status === 403) await clearOperationalCache(false);
      throw new Error(`Offline-indeks kunne ikke hentes (${indexResponse.status}).`);
    }

    const payload = await indexResponse.json();
    const urls = Array.isArray(payload.urls)
      ? payload.urls.filter((value) => typeof value === "string" && (isOperationalPath(value) || value.startsWith("/api/admin/operativ-portal/billeder/")))
      : [];
    const cache = await caches.open(OPERATIONAL_CACHE);
    let completed = 0;

    await notifyClients({ type: "OPERATIONAL_SYNC_PROGRESS", current: completed, total: urls.length });

    for (const relativeUrl of urls) {
      const absoluteUrl = new URL(relativeUrl, self.location.origin).href;
      try {
        const response = await fetch(absoluteUrl, { credentials: "same-origin", cache: "no-store" });
        if (isAuthenticationFailure(response)) {
          await clearOperationalCache(false);
          throw new Error("Din session er udløbet. Log ind igen før offline-synkronisering.");
        }
        if (response.ok && !response.redirected) {
          await cache.put(normalizedCacheRequest(absoluteUrl), response.clone());
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("session")) throw error;
        // En enkelt manglende ressource må ikke stoppe resten af synkroniseringen.
      }
      completed += 1;
      await notifyClients({ type: "OPERATIONAL_SYNC_PROGRESS", current: completed, total: urls.length });
    }

    await notifyClients({ type: "OPERATIONAL_SYNC_DONE", total: urls.length, counts: payload.counts || null });
  } catch (error) {
    await notifyClients({
      type: "OPERATIONAL_SYNC_ERROR",
      message: error instanceof Error ? error.message : "Offline-synkronisering mislykkedes."
    });
  }
}

async function clearOperationalCache(notify) {
  await caches.delete(OPERATIONAL_CACHE);
  if (notify) await notifyClients({ type: "OPERATIONAL_CACHE_CLEARED" });
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

function normalizedCacheRequest(value) {
  const url = new URL(value, self.location.origin);
  url.searchParams.delete("_rsc");
  return new Request(url.href, { method: "GET", credentials: "same-origin" });
}

function isOperationalPath(pathname) {
  return pathname === "/admin/operativ-portal" || pathname.startsWith("/admin/operativ-portal/");
}

function isAuthenticationFailure(response) {
  if (response.status === 401 || response.status === 403) return true;
  if (!response.redirected) return false;
  try {
    return new URL(response.url).pathname === "/login";
  } catch {
    return false;
  }
}

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
