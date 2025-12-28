// Service Worker für PWA Unterstützung
const CACHE_NAME = 'zeiterfassung-v2'; // Version erhöht um Cache zu invalidieren
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - Cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // Fehler beim Cachen sind OK - App funktioniert auch ohne
      });
    })
  );
  self.skipWaiting();
});

// Fetch event - Network first, fall back to cache
self.addEventListener('fetch', event => {
  // Nur GET Requests und nur http/https URLs
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Filter unsupported schemes (chrome-extension, data, blob, etc.)
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache erfolgreiche Responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache).catch(() => {
            // Ignore cache errors
          });
        });
        return response;
      })
      .catch(() => {
        // Fallback auf Cache
        return caches.match(event.request);
      })
  );
});

// Activate event - Cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push notification handler
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Zeiterfassungs-Benachrichtigung',
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: 'zeiterfassung',
      requireInteraction: false,
    };
    
    event.waitUntil(self.registration.showNotification(data.title || 'Überstunden-Tracker', options));
  } catch (e) {
    console.error('Push notification error:', e);
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Nutze existierendes Fenster falls vorhanden
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Sonst öffne neues Fenster
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
