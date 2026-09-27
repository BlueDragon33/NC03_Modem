const CACHE = "nc03-control-center-v38-webui-settings-v0730";
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
  "./src/runtime/RuntimeProtocol.js",
  "./src/modem/MockNC03Adapter.js",
  "./src/modem/CapabilityRegistry.js",
  "./src/modem/NC03Capabilities.js",
  "./src/modem/NC03Auth.js",
  "./src/modem/SecureCredentialVault.js",
  "./src/modem/WriteSourceDiscovery.js",
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const staleKeys = keys.filter((key) => key !== CACHE);
    await Promise.all(staleKeys.map((key) => caches.delete(key)));
    await self.clients.claim();

    // A newly activated worker can be installed while an older app.js is still
    // executing in an already-open tab. If we replaced an older NC03 shell,
    // navigate each open window once so the new network-first worker serves the
    // current UI immediately instead of leaving a stale frontend in memory.
    if (!staleKeys.length) return;
    const windows = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
    await Promise.all(windows.map(async (client) => {
      if (typeof client.navigate !== "function") return;
      try {
        await client.navigate(client.url);
      } catch {
        // The client may close during activation; update recovery must stay non-fatal.
      }
    }));
  })());
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
