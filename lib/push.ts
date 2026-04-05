// =====================================================
// push.ts — fichier UNIQUE (remplace push.native.ts + push.web.ts)
//
// Pourquoi un seul fichier ?
// Expo SDK 50 static export bundle AUSSI les .native.ts pour le
// renderer SSR Node — l'extension seule ne suffit pas.
//
// Solution : require() dynamique à l'intérieur des branches
// conditionnelles → Metro ne traverse pas le code mort.
//
// Mobile : getDevicePushTokenAsync() → token FCM natif Android
//          envoyé au backend → Firebase Admin SDK → FCM → appareil
// Web    : VAPID → navigateur (inchangé)
// =====================================================

import { Platform }  from 'react-native';
import AsyncStorage  from '@react-native-async-storage/async-storage';

const BACKEND_URL  = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const VAPID_PUBLIC = 'BD-yXPlob5T761yCIPiWx6nnQWCis6Yp-r8Rb_SzxYYljYKKoibxs059ze9vsqFimBtmGXPVpw_mqOJCd9cGnUM';
const MOBILE_KEY   = 'harmonia_push_mobile_registered';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Auth helper ────────────────────────────────────────────────────────────────
type GetAuth = () => Promise<{ user_id: string; access_token: string } | null>;

async function checkDB(auth: { user_id: string; access_token: string }, platform: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:       'checkSubscription',
        platform,
        user_id:      auth.user_id,
        access_token: auth.access_token,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.subscribed === true;
    }
  } catch {}
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE UNIQUE
// ══════════════════════════════════════════════════════════════════════════════
export async function initPush(getAuth: GetAuth): Promise<void> {
  if (Platform.OS === 'web') {
    return initPushWeb(getAuth);
  } else {
    return initPushNative(getAuth);
  }
}

export async function removePush(getAuth: GetAuth): Promise<void> {
  if (Platform.OS === 'web') {
    return removePushWeb(getAuth);
  } else {
    return removePushNative(getAuth);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WEB — Browser Push API + VAPID (inchangé)
// ══════════════════════════════════════════════════════════════════════════════
async function initPushWeb(getAuth: GetAuth): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push.web] Navigateur non supporté');
    return;
  }

  try {
    const auth = await getAuth();
    if (!auth) return;

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn('[Push.web] Service worker indisponible :', err);
      return;
    }

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      fetch(`${BACKEND_URL}/push`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'updateLastSeen',
          platform:     'web',
          endpoint:     existing.endpoint,
          user_id:      auth.user_id,
          access_token: auth.access_token,
        }),
      }).catch(() => {});
      console.log('[Push.web] Déjà abonné (navigateur) — last_seen_at mis à jour');
      return;
    }

    const alreadyInDB = await checkDB(auth, 'web');
    const permState = typeof Notification !== 'undefined' ? Notification.permission : 'default';

    if (alreadyInDB && permState === 'denied') {
      console.log('[Push.web] Permission refusée sur ce navigateur');
      return;
    }

    if (permState !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push.web] Permission refusée');
        return;
      }
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });

    const sub      = subscription.toJSON();
    const endpoint = sub.endpoint!;
    const p256dh   = sub.keys?.p256dh ?? '';
    const authKey  = sub.keys?.auth   ?? '';

    let oldEndpoint: string | null = null;
    if (alreadyInDB) {
      const epRes = await fetch(`${BACKEND_URL}/push`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'getEndpoint',
          platform:     'web',
          user_id:      auth.user_id,
          access_token: auth.access_token,
        }),
      }).catch(() => null);
      if (epRes?.ok) {
        const epData = await epRes.json();
        oldEndpoint = epData.endpoint ?? null;
      }
    }

    const action     = alreadyInDB ? 'update' : 'subscribe';
    const bodyExtras = oldEndpoint ? { old_endpoint: oldEndpoint } : {};

    const res = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action,
        platform:     'web',
        endpoint,
        p256dh,
        auth:         authKey,
        user_id:      auth.user_id,
        access_token: auth.access_token,
        ...bodyExtras,
      }),
    });

    if (res.ok) {
      console.log(alreadyInDB
        ? `[Push.web] ✅ Nouveau navigateur enregistré (update${oldEndpoint ? ' + ancien désactivé' : ''})`
        : '[Push.web] ✅ Premier abonnement enregistré'
      );
    } else {
      console.warn('[Push.web] ❌ Erreur enregistrement');
    }
  } catch (err) {
    console.warn('[Push.web] Erreur :', err);
  }
}

async function removePushWeb(getAuth: GetAuth): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
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
        body:    JSON.stringify({ action: 'unsubscribe', platform: 'web', endpoint, ...auth }),
      });
    }
  } catch (err) {
    console.warn('[Push.web] Erreur suppression :', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// NATIVE — FCM Android via getDevicePushTokenAsync
//
// Différence clé avec l'ancienne version :
//   Avant : getExpoPushTokenAsync({ projectId, accessToken })
//           → token Expo (ExponentPushToken[xxx]) → serveurs Expo → FCM
//   Maintenant : getDevicePushTokenAsync()
//           → token FCM natif → ton backend → Firebase Admin → FCM directement
//
// Plus besoin de projectId ni d'accessToken côté app.
// ══════════════════════════════════════════════════════════════════════════════
async function initPushNative(getAuth: GetAuth): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    // Configurer le handler de notifications reçues
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,  // SDK 52+ — remplace shouldShowAlert
        shouldShowList:   true,  // SDK 52+ — affichage centre de notifs
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });

    // Enregistrer les catégories (boutons d'action par type)
    const { registerNotificationCategories } = require('./notificationCategories');
    await registerNotificationCategories();

    // Canal Android obligatoire
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name:             'Harmonia',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#7C3AED',
      });
    }

    // Cache local — évite les requêtes inutiles au démarrage
    const cached = await AsyncStorage.getItem(MOBILE_KEY);
    if (cached === 'true') {
      console.log('[Push.native] Cache — déjà abonné');
      return;
    }

    const auth = await getAuth();
    if (!auth) return;

    // Vérifier en DB si un token est déjà enregistré pour cet user
    if (await checkDB(auth, 'mobile')) {
      await AsyncStorage.setItem(MOBILE_KEY, 'true');
      console.log('[Push.native] DB — déjà abonné');
      return;
    }

    // Demander la permission à l'OS
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push.native] Permission refusée');
      return;
    }

    // ── Récupérer le token FCM natif ───────────────────────────────────────
    // getDevicePushTokenAsync() retourne le vrai token FCM de l'appareil
    // sans passer par les serveurs Expo — pas de projectId, pas d'accessToken
    console.log(`[Push.native] Plateforme ${Platform.OS} — récupération token FCM`);
    let fcmToken: string;
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      // tokenData = { type: 'android', data: 'fcm-token-xxx' }
      fcmToken = tokenData.data;
      console.log(`[Push.native] Token FCM (${Platform.OS}) :`, fcmToken);
    } catch (err) {
      console.warn('[Push.native] Impossible de récupérer le token FCM :', err);
      return;
    }

    // Enregistrer le token FCM en DB via le backend
    // Le champ s'appelle encore expo_push_token en DB — il stocke maintenant le token FCM
    const res = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:          'subscribe',
        platform:        'mobile',
        expo_push_token: fcmToken,   // champ DB inchangé, contient le token FCM
        user_id:         auth.user_id,
        access_token:    auth.access_token,
      }),
    });

    if (res.ok) {
      await AsyncStorage.setItem(MOBILE_KEY, 'true');
      console.log('[Push.native] ✅ Token FCM enregistré');
    } else {
      console.warn('[Push.native] ❌ Erreur enregistrement');
    }

  } catch (err) {
    console.warn('[Push.native] Erreur :', err);
  }
}

async function removePushNative(getAuth: GetAuth): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    const auth = await getAuth();
    if (!auth) {
      await AsyncStorage.removeItem(MOBILE_KEY);
      return;
    }

    // Récupérer le token FCM natif pour le désabonnement
    const tokenData = await Notifications.getDevicePushTokenAsync().catch(() => null);

    if (tokenData) {
      await fetch(`${BACKEND_URL}/push`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:          'unsubscribe',
          platform:        'mobile',
          expo_push_token: tokenData.data,
          user_id:         auth.user_id,
          access_token:    auth.access_token,
        }),
      });
    }
    await AsyncStorage.removeItem(MOBILE_KEY);
    console.log('[Push.native] Abonnement supprimé');
  } catch (err) {
    console.warn('[Push.native] Erreur suppression :', err);
  }
}
