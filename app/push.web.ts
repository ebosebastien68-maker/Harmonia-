// =====================================================
// push.web.ts
// Chargé par Metro sur Web UNIQUEMENT.
// Utilise l'API Push du navigateur + VAPID.
//
// Metro sélectionne ce fichier automatiquement quand
// platform = web grâce à l'extension .web.ts
//
// IMPORTANT : requestPermission() EXIGE un geste utilisateur
// sur le web — ce fichier est appelé depuis handleEnablePush()
// qui est déclenché par un clic sur le bouton clochette.
// =====================================================

const BACKEND_URL    = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const VAPID_PUBLIC   = 'BD-yXPlob5T761yCIPiWx6nnQWCis6Yp-r8Rb_SzxYYljYKKoibxs059ze9vsqFimBtmGXPVpw_mqOJCd9cGnUM';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── initPush — appelée depuis handleEnablePush() après clic utilisateur ───────
export async function initPush(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push.web] Navigateur non supporté');
    return;
  }

  try {
    const auth = await getAuth();
    if (!auth) return;

    // ── 1. Enregistrer le service worker ──────────────────────────────────
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
      console.log('[Push.web] Service worker actif');
    } catch (err) {
      console.warn('[Push.web] Service worker indisponible :', err);
      return;
    }

    // ── 2. Déjà abonné dans le navigateur ? ───────────────────────────────
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      console.log('[Push.web] Déjà abonné (navigateur)');
      return;
    }

    // ── 3. Demander la permission ──────────────────────────────────────────
    // Cette ligne DOIT être dans le callstack d'un événement utilisateur
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push.web] Permission refusée');
      return;
    }

    // ── 4. Créer la subscription VAPID ────────────────────────────────────
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });

    const sub     = subscription.toJSON();
    const endpoint = sub.endpoint!;
    const p256dh   = sub.keys?.p256dh ?? '';
    const authKey  = sub.keys?.auth   ?? '';

    // ── 5. Enregistrer en DB ──────────────────────────────────────────────
    const res = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:       'subscribe',
        platform:     'web',
        endpoint,
        p256dh,
        auth:         authKey,
        user_id:      auth.user_id,
        access_token: auth.access_token,
      }),
    });

    if (res.ok) {
      console.log('[Push.web] ✅ Abonnement enregistré');
    } else {
      console.warn('[Push.web] ❌ Erreur enregistrement');
    }

  } catch (err) {
    console.warn('[Push.web] Erreur inattendue :', err);
  }
}

// Désabonnement
export async function removePush(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/service-worker.js');
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const endpoint = sub.endpoint;
    await sub.unsubscribe();

    const auth = await getAuth();
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
    console.log('[Push.web] Abonnement supprimé');
  } catch (err) {
    console.warn('[Push.web] Erreur suppression :', err);
  }
}
