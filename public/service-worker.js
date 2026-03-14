// =====================================================
// service-worker.js — Harmonia Web Push
// Placer dans /public/ à la racine du projet
//
// URL app     : https://harmonia-world.vercel.app
// Icon défaut : /favicon.png
// Badge msg   : /message-badge.png
// =====================================================

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Badges par type (fallback si le backend ne l'envoie pas) ─────────────────
const BADGES = {
  nouveau_message: '/message-badge.png',
};

// ── Actions par type ──────────────────────────────────────────────────────────
function getActions(type) {
  switch (type) {
    case 'nouveau_message':
      return [
        { action: 'open',    title: '💬 Lire le message' },
        { action: 'dismiss', title: 'Ignorer'            },
      ];
    default:
      return [
        { action: 'open',    title: '👁 Voir'  },
        { action: 'dismiss', title: 'Fermer'   },
      ];
  }
}

// ── Réception d'un push ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Harmonia', body: event.data.text() };
  }

  const type  = payload.data?.type || null;
  const title = payload.title      || 'Harmonia';

  const options = {
    body:     payload.body  || '',
    // Icône principale — toujours favicon.png (icône de l'app)
    icon:     '/favicon.png',
    // Badge — /message-badge.png pour nouveau_message
    // sinon fallback favicon
    badge:    payload.badge || BADGES[type] || '/favicon.png',
    // Image optionnelle — null si non fournie
    ...(payload.image ? { image: payload.image } : {}),
    data:     payload.data  || {},
    // tag — évite les doublons du même type
    tag:      `harmonia-${type || 'notif'}`,
    renotify: true,
    vibrate:  [200, 100, 200],
    actions:  getActions(type),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Clic sur la notification ou un bouton d'action ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Bouton "Ignorer" → on ferme, rien de plus
  if (event.action === 'dismiss') return;

  const data    = event.notification.data || {};
  const type    = data.type;
  const baseUrl = 'https://harmonia-world.vercel.app';
  let   target  = `${baseUrl}/home`;

  // Navigation selon le type
  switch (type) {
    case 'nouveau_message':
      target = data.conversation_id
        ? `${baseUrl}/messages?conversation=${data.conversation_id}`
        : `${baseUrl}/messages`;
      break;
    default:
      target = `${baseUrl}/home`;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Fenêtre déjà ouverte → focus + navigation
        const existing = clients.find(c =>
          c.url.startsWith(baseUrl)
        );
        if (existing) {
          existing.focus();
          existing.navigate(target);
        } else {
          // Ouvrir une nouvelle fenêtre
          self.clients.openWindow(target);
        }
      })
  );
});
