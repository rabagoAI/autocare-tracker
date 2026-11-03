// AutoCare Tracker - Service worker: the app works offline.
// Only caches the app's own files; user data stays in localStorage.
const CACHE = 'autocare-v1.3.1';
const APP_SHELL = [
    './',
    'index.html',
    'styles.css',
    'motion.css',
    'app.js',
    'motion.js',
    'backup.js',
    'manifest.webmanifest',
    'vendor/chart.umd.4.4.7.js',
    'vendor/fonts/inter.css',
    'vendor/fonts/inter-latin-wght-normal.woff2',
    'vendor/fonts/inter-latin-ext-wght-normal.woff2',
    'icons/icon.svg',
    'icons/icon-192.png'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Network first, so a new deploy is seen right away; cache when offline.
// 'no-cache' revalidates with the server instead of trusting the HTTP cache.
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(request, { cache: 'no-cache' })
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request, { ignoreSearch: true })
                .then(cached => cached || caches.match('index.html')))
    );
});
