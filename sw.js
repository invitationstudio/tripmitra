// TripMitra Service Worker
const CACHE_NAME = "tripmithra-v2"; // Naveen version (v2) kela ahe jene naveen logo load hoil
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.json",
  "./manifest.json",
  "./logo.png" 
];

// १. फाईल्स कॅशे (सेव्ह) करणे
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// २. जुनं कॅशे डिलीट करणे (जेव्हा नवीन व्हर्जन येईल)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ३. इंटरनेट नसेल तेव्हा कॅशे मधून फाईल्स देणे
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});