/**
 * sw.js — Waypoint Service Worker
 *
 * Caches the app shell so it loads instantly and works offline.
 * The AI chat and booking links still require an internet connection.
 */

const CACHE_NAME = 'waypoint-v1';

// Files to cache immediately when the app is installed
const SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/data.js',
  '/app.js',
  '/manifest.json',
  // Fonts are cached by the browser separately — no need to list them
];

/* ── Install: cache the app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: serve from cache, fall back to network ── */
self.addEventListener('fetch', event => {
  // Don't cache API calls (Claude, Firebase) — always go to network
  const url = event.request.url;
  if (
    url.includes('api.anthropic.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    event.request.method !== 'GET'
  ) {
    return; // let browser handle normally
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses for app shell files
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // If offline and not cached, show the cached index for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
