// sw.js - Service Worker untuk GitHub Pages: gussakah00/notes-app
const CACHE_NAME = "notes-app-v3.0.0";
const APP_SHELL_CACHE = "app-shell-v3";

// ✅ FIX: Base path SESUAI REPO ANDA
const BASE_PATH = "/notes-app";

// ✅ FIX: Essential files dengan path yang benar
const ESSENTIAL_FILES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/main.bundle.js`,
  `${BASE_PATH}/styles.css`,
  `${BASE_PATH}/manifest.json`,
];

// ✅ FIX: Optional files
const OPTIONAL_FILES = [
  `${BASE_PATH}/favicon.png`,
  `${BASE_PATH}/icons/icon-72x72.png`,
  `${BASE_PATH}/icons/icon-96x96.png`,
  `${BASE_PATH}/icons/icon-128x128.png`,
  `${BASE_PATH}/icons/icon-144x144.png`,
  `${BASE_PATH}/icons/icon-152x152.png`,
  `${BASE_PATH}/icons/icon-192x192.png`,
  `${BASE_PATH}/icons/icon-384x384.png`,
  `${BASE_PATH}/icons/icon-512x512.png`,
];

// === INSTALL ===
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Installing for", BASE_PATH);

  // Skip waiting - langsung aktifkan SW baru
  event.waitUntil(self.skipWaiting());

  // Cache App Shell
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(APP_SHELL_CACHE);
        console.log("💾 Opening cache...");

        // Cache essential files
        console.log("📦 Caching essential files...");
        for (const url of ESSENTIAL_FILES) {
          try {
            await cache.add(url);
            console.log(`✅ Cached: ${url}`);
          } catch (err) {
            console.warn(`❌ Failed to cache: ${url}`, err.message);
          }
        }

        console.log("🎉 Caching completed");
      } catch (error) {
        console.error("❌ Cache error:", error);
      }
    })()
  );
});

// === ACTIVATE ===
self.addEventListener("activate", (event) => {
  console.log("🔄 Service Worker: Activating...");

  event.waitUntil(
    (async () => {
      // Claim clients immediately
      await self.clients.claim();

      // Clean old caches
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            if (cacheName !== APP_SHELL_CACHE) {
              console.log(`🗑️ Deleting old cache: ${cacheName}`);
              await caches.delete(cacheName);
            }
          })
        );
      } catch (error) {
        console.warn("⚠️ Error cleaning caches:", error);
      }

      console.log("✅ Service Worker activated!");
    })()
  );
});

// === FETCH ===
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip API calls
  if (url.href.includes("story-api.dicoding.dev")) {
    return;
  }

  // Skip external resources
  if (!url.href.startsWith(self.location.origin)) {
    return;
  }

  // Handle request
  event.respondWith(
    (async () => {
      // Try cache first
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        // Try network
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.status === 200) {
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // Network failed - return fallback
        console.log(`🌐 Network failed: ${url.pathname}`);

        // For HTML requests, return index.html
        if (
          request.destination === "document" ||
          request.headers.get("accept")?.includes("text/html")
        ) {
          const fallback = await caches.match(`${BASE_PATH}/index.html`);
          if (fallback) return fallback;
        }

        // Return offline page
        return new Response(
          `
          <html>
            <head><title>Offline</title></head>
            <body>
              <h1>Anda sedang offline</h1>
              <p>Aplikasi membutuhkan koneksi internet.</p>
            </body>
          </html>
          `,
          { headers: { "Content-Type": "text/html" } }
        );
      }
    })()
  );
});

console.log("🚀 Service Worker loaded for:", BASE_PATH);
