const CACHE = "nc03-control-center-v25-auth-probe-cache-compat";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./report.html",
  "./report.css",
  "./report.js",
  "./src/modem/NC03Adapter.js",
  "./src/modem/MockNC03Adapter.js",
  "./src/modem/CapabilityRegistry.js",
  "./src/modem/NC03Capabilities.js",
  "./src/modem/NC03Auth.js",
  "./src/modem/NC03Api.js",
  "./src/modem/NC03Session.js",
  "./src/modem/NC03Parser.js",
  "./src/modem/ConnectionState.js",
  "./src/modem/HarDiscovery.js",
  "./src/modem/LocalPreferences.js",
  "./src/modem/LoginPolicy.js",
  "./src/modem/LocalBridgePolicy.js",
  "./src/modem/NC03Firmware80042Profile.js",
  "./src/modem/NC03Har2Profile.js",
  "./src/ui/NavigationModel.js",
  "./src/ui/DiagnosticReport.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_local/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, { cache:"no-store" });
      if (response?.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request);
      return cached || new Response("Offline", { status:503 });
    }
  })());
});
