// =====================================================
// service-worker.js
// Service Worker Harmonia — Web Push + PWA Cache
//
// Placer ce fichier à la RACINE du build web :
//   /public/service-worker.js  (Expo Web / Vercel)
//
// Il reçoit les push events du serveur et affiche
// la notification même si l'app est fermée.
// Il met aussi en cache les ressources essentielles
// pour que le navigateur reconnaisse l'app comme PWA.
// =====================================================

const CACHE_NAME = 'harmonia-sw-v1';

// Ressources à mettre en cache pour le PWA
const PRECACHE_ASSETS = [
  '/',
  '/favicon.png',
  '/message-badge.png',
  '/manifest.json',
];

// ── Badges par type de notification ──────────────────────────────────────────
const BASE_URL = 'https://harmonia-world.vercel.app';

const BADGES = {
  nouveau_message: BASE_URL + '/message-badge.png',
  nouveau_trophee: BASE_URL + '/favicon.png',
  notification:    BASE_URL + '/favicon.png',
  session_ouverte: BASE_URL + '/favicon.png',
};

// ── Actions par type de notification ─────────────────────────────────────────
function getActions(type) {
  switch (type) {
    case 'nouveau_message':
      return [
        { action: 'open',    title: '💬 Lire le message' },
        { action: 'dismiss', title: 'Ignorer'            },
      ];
    case 'nouveau_trophee':
      return [
        { action: 'open',    title: '🏆 Voir mon trophée' },
        { action: 'dismiss', title: 'Fermer'              },
      ];
    case 'session_ouverte':
      return [
        { action: 'open',    title: '🎮 Voir la session' },
        { action: 'dismiss', title: 'Plus tard'          },
      ];
    case 'notification':
      return [
        { action: 'open',    title: '👁 Lire' },
        { action: 'dismiss', title: 'Fermer'  },
      ];
    default:
      return [];
  }
}

// ── Installation — mise en cache des ressources PWA ──────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installé');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activation — nettoyage des anciens caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activé');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — stratégie Network First avec fallback cache ──────────────────────
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les API externes
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/push') ||
      event.request.url.includes('supabase') ||
      event.request.url.includes('onrender.com')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre à jour le cache avec la réponse fraîche
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Réseau indisponible → fallback sur le cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
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

  const type  = payload.data?.type || null;
  const title = payload.title      || 'Harmonia';

  const options = {
    body:     payload.body    || payload.content || '',
    icon:     payload.icon    || BASE_URL + '/favicon.png',
    badge:    payload.badge   || BADGES[type]    || BASE_URL + '/favicon.png',
    ...(payload.image ? { image: payload.image } : {}),
    data:     payload.data    || {},
    tag:      payload.tag     || 'harmonia-notif',
    renotify: true,
    vibrate:  [200, 100, 200],
    actions:  getActions(type),
  };

  console.log('[SW] Affichage notification :', title);
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur la notification ou un bouton d'action ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data    = event.notification.data || {};
  const type    = data.type;
  const baseUrl = 'https://harmonia-world.vercel.app';

  let url;
  switch (type) {
    case 'nouveau_message':
      url = data.conversation_id
        ? `${baseUrl}/messages?conversation=${data.conversation_id}`
        : `${baseUrl}/messages`;
      break;
    case 'nouveau_trophee':
      url = `${baseUrl}/notifications`;
      break;
    case 'session_ouverte':
      url = `${baseUrl}/home`;
      break;
    case 'notification':
      url = `${baseUrl}/notifications`;
      break;
    default:
      url = data.url || `${baseUrl}/home`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => c.url.includes('harmonia-world.vercel.app'));
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
