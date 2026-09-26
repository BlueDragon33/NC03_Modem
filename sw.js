const CACHE = "nc03-control-center-v12-har-evidence-lab";
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response?.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }

      return network.then((response) => response || new Response("Offline", { status: 503 }));
    })
  );
});
