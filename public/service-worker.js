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

// ── Badges par type de notification ──────────────────────────────────────────
const BADGES = {
  nouveau_message: '/message-badge.png',
};

// ── Actions par type de notification ─────────────────────────────────────────
function getActions(type) {
  switch (type) {
    case 'nouveau_message':
      return [
        { action: 'open',    title: '💬 Lire le message' },
        { action: 'dismiss', title: 'Ignorer'            },
      ];
    default:
      return [];
  }
}

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

  const type  = payload.data?.type || null;
  const title = payload.title      || 'Harmonia';

  const options = {
    body:     payload.body    || payload.content || '',
    icon:     payload.icon    || '/favicon.png',
    // Badge dynamique selon le type, fallback favicon
    badge:    payload.badge   || BADGES[type]    || '/favicon.png',
    // image uniquement si fournie (nullable)
    ...(payload.image ? { image: payload.image } : {}),
    data:     payload.data    || {},
    tag:      payload.tag     || 'harmonia-notif',
    renotify: true,
    vibrate:  [200, 100, 200],
    // Boutons d'action selon le type
    actions:  getActions(type),
  };

  console.log('[SW] Affichage notification :', title);
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur la notification ou un bouton d'action ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Bouton "Ignorer" → fermer sans ouvrir l'app
  if (event.action === 'dismiss') return;

  const data    = event.notification.data || {};
  const type    = data.type;
  const baseUrl = 'https://harmonia-world.vercel.app';

  // URL selon le type, fallback sur /home
  let url;
  switch (type) {
    case 'nouveau_message':
      url = data.conversation_id
        ? `${baseUrl}/messages?conversation=${data.conversation_id}`
        : `${baseUrl}/messages`;
      break;
    default:
      url = data.url || `${baseUrl}/home`;
  }

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
        
