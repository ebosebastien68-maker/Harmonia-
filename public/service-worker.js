// =====================================================
// service-worker.js
// Service Worker Harmonia — Web Push
//
// Placer ce fichier à la RACINE du build web :
//   /public/service-worker.js  (Expo Web / Vercel)
//
// Il reçoit les push events du serveur et affiche
// la notification même si l'app est fermée.
// =====================================================

const CACHE_NAME = 'harmonia-sw-v1';

// ── Installation ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installé');
  self.skipWaiting();
});

// ── Activation ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activé');
  event.waitUntil(self.clients.claim());
});

// ── Réception d'un push ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push reçu sans données');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Harmonia', body: event.data.text() };
  }

  const title   = payload.title   || 'Harmonia';
  const options = {
    body:    payload.body    || payload.content || '',
    icon:    payload.icon    || '/assets/icon.png',
    badge:   payload.badge   || '/assets/icon.png',
    image:   payload.image   || undefined,
    data:    payload.data    || {},
    tag:     payload.tag     || 'harmonia-notif',
    renotify: true,
    vibrate: [200, 100, 200],
  };

  console.log('[SW] Affichage notification :', title);
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur la notification ──────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || 'https://harmonia-world.vercel.app/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Fenêtre déjà ouverte → focus
      const existing = clients.find(c => c.url.includes('harmonia-world.vercel.app'));
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        // Ouvrir une nouvelle fenêtre
        self.clients.openWindow(url);
      }
    })
  );
});
                                                                              
