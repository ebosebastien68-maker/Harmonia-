// =====================================================
// pushWeb.ts
// Gestion des push notifications sur Web via
// l'API Push du navigateur + VAPID.
//
// Flux :
//   1. Vérifie si le navigateur supporte les push
//   2. Vérifie si déjà abonné (subscription existante) → silence
//   3. Demande la permission
//   4. Crée la subscription VAPID via le service worker
//   5. Enregistre en DB via le backend
// =====================================================

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

// Clé publique VAPID
const VAPID_PUBLIC_KEY = 'BD-yXPlob5T761yCIPiWx6nnQWCis6Yp-r8Rb_SzxYYljYKKoibxs059ze9vsqFimBtmGXPVpw_mqOJCd9cGnUM';

// Convertit la clé VAPID base64url → Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Fonction principale ────────────────────────────────────────────────────────
export async function initPushWeb(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {

  // Vérifier le support navigateur
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[PushWeb] Navigateur non supporté — push ignoré');
    return;
  }

  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────
    const auth = await getAuth();
    if (!auth) {
      console.log('[PushWeb] Non connecté — push ignoré');
      return;
    }

    // ── 2. Enregistrer / récupérer le service worker ───────────────────────
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
      console.log('[PushWeb] Service worker actif');
    } catch (err) {
      console.warn('[PushWeb] Service worker indisponible :', err);
      return;
    }

    // ── 3. Vérifier si déjà abonné via le navigateur ───────────────────────
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log('[PushWeb] Déjà abonné (navigateur) — silence');
      return;
    }

    // ── 4. Vérifier si déjà abonné en DB ──────────────────────────────────
    const checkRes = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:       'checkSubscription',
        platform:     'web',
        user_id:      auth.user_id,
        access_token: auth.access_token,
      }),
    }).catch(() => null);

    if (checkRes?.ok) {
      const checkData = await checkRes.json();
      if (checkData.subscribed) {
        console.log('[PushWeb] DB — déjà abonné, silence');
        return;
      }
    }

    // ── 5. Demander la permission ──────────────────────────────────────────
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[PushWeb] Permission refusée — silence');
      return;
    }

    // ── 6. Créer la subscription VAPID ────────────────────────────────────
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const p256dh   = subJson.keys?.p256dh ?? '';
    const auth_key = subJson.keys?.auth   ?? '';

    console.log('[PushWeb] Subscription créée');

    // ── 7. Enregistrer en DB ───────────────────────────────────────────────
    const res = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:       'subscribe',
        platform:     'web',
        endpoint,
        p256dh,
        auth:         auth_key,
        user_id:      auth.user_id,
        access_token: auth.access_token,
      }),
    });

    if (res.ok) {
      console.log('[PushWeb] ✅ Abonnement enregistré');
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[PushWeb] ❌ Erreur enregistrement :', err);
    }

  } catch (err) {
    console.warn('[PushWeb] Erreur inattendue :', err);
  }
}

// ── Désabonnement ─────────────────────────────────────────────────────────────
export async function removePushWeb(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const auth = await getAuth();
    const reg  = await navigator.serviceWorker.getRegistration('/service-worker.js');
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const endpoint = sub.endpoint;
    await sub.unsubscribe();

    if (auth) {
      await fetch(`${BACKEND_URL}/push`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'unsubscribe',
          platform:     'web',
          endpoint,
          user_id:      auth.user_id,
          access_token: auth.access_token,
        }),
      });
    }
    console.log('[PushWeb] Abonnement supprimé');
  } catch (err) {
    console.warn('[PushWeb] Erreur suppression :', err);
  }
      }
