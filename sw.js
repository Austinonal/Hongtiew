/* ห้องติว service worker: keeps the app working offline; never caches API calls. */
var CACHE = 'hongtiew-v2.0.2';
var CORE = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'vendor/marked.min.js', 'vendor/purify.min.js', 'vendor/mathjax/tex-svg.js',
  'vendor/mathjax/input/tex/extensions/mhchem.js', 'vendor/mammoth.browser.min.js', 'vendor/jszip.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.hostname === 'generativelanguage.googleapis.com') return;
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: url.origin === self.location.origin }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () {
        if (hit) return hit;
        if (req.mode === 'navigate') return cache.match('index.html');
        return Response.error();
      });
      return hit || net;
    });
  }));
});
