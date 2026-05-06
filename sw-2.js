// ── VERSIÓN ──────────────────────────────────────────────────────────
// Incrementa este número cada vez que subas cambios a GitHub
const CACHE_VERSION = "esgrima-v21";

// Solo cacheamos assets estáticos (iconos), NUNCA los HTML
const STATIC_ASSETS = [
  "./icon-192.png",
  "./icon-512.png"
];

// ── INSTALL ──────────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  // Activa inmediatamente sin esperar a que se cierren pestañas
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  // Toma control de todos los clientes inmediatamente
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────────────────
self.addEventListener("fetch", e => {
  const url = e.request.url;

  // Google Apps Script → siempre red, nunca caché
  if (url.includes("script.google") || url.includes("googleapis")) {
    e.respondWith(
      fetch(e.request).catch(() => new Response("", { status: 503 }))
    );
    return;
  }

  // Archivos HTML → SIEMPRE red, nunca caché
  // Esto garantiza que siempre se descarga la versión más reciente de GitHub
  if (url.includes(".html") || url.endsWith("/")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .catch(() => new Response("<p>Sin conexión</p>", {
          headers: { "Content-Type": "text/html" }
        }))
    );
    return;
  }

  // Iconos y otros assets estáticos → caché primero
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
