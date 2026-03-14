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
// expo-device n'est pas dans package.json → remplacé par
// une vérification Platform.OS simple.
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
// WEB — Browser Push API + VAPID
// Appelé depuis handleEnablePush() après un clic utilisateur
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

    // Enregistrer le service worker
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn('[Push.web] Service worker indisponible :', err);
      return;
    }

    // Déjà abonné dans le navigateur ?
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      console.log('[Push.web] Déjà abonné (navigateur)');
      return;
    }

    // Déjà abonné en DB ?
    if (await checkDB(auth, 'web')) {
      console.log('[Push.web] Déjà abonné (DB)');
      return;
    }

    // Demander la permission — DOIT être dans le callstack d'un clic
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push.web] Permission refusée');
      return;
    }

    // Créer la subscription VAPID
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });

    const sub     = subscription.toJSON();
    const endpoint = sub.endpoint!;
    const p256dh   = sub.keys?.p256dh ?? '';
    const authKey  = sub.keys?.auth   ?? '';

    // Enregistrer en DB
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

    console.log(res.ok ? '[Push.web] ✅ Abonnement enregistré' : '[Push.web] ❌ Erreur enregistrement');
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
// NATIVE — Expo Push Notifications (iOS + Android)
// require() dynamique → Metro ne bundle pas ces imports pour le web
// ══════════════════════════════════════════════════════════════════════════════
async function initPushNative(getAuth: GetAuth): Promise<void> {
  try {
    // require() dynamique — invisible pour le bundler web
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;

    // Configurer le handler de notifications reçues
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    });

    // Canal Android obligatoire
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name:             'Harmonia',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#7C3AED',
      });
    }

    // Cache local
    const cached = await AsyncStorage.getItem(MOBILE_KEY);
    if (cached === 'true') {
      console.log('[Push.native] Cache — déjà abonné');
      return;
    }

    const auth = await getAuth();
    if (!auth) return;

    // Vérifier en DB
    if (await checkDB(auth, 'mobile')) {
      await AsyncStorage.setItem(MOBILE_KEY, 'true');
      console.log('[Push.native] DB — déjà abonné');
      return;
    }

    // Demander la permission (iOS / Android — autorisé programmatiquement)
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

    // Récupérer le token Expo
    // iOS → APNs, Android → FCM — Expo gère la différence en interne
    console.log(`[Push.native] Plateforme ${Platform.OS} — récupération token`);
    let expoPushToken: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants?.expoConfig?.extra?.eas?.projectId,
      });
      expoPushToken = tokenData.data;
      console.log(`[Push.native] Token (${Platform.OS}) :`, expoPushToken);
    } catch (err) {
      console.warn('[Push.native] Impossible de récupérer le token :', err);
      return;
    }

    // Enregistrer en DB
    const res = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:          'subscribe',
        platform:        'mobile',
        expo_push_token: expoPushToken,
        user_id:         auth.user_id,
        access_token:    auth.access_token,
      }),
    });

    if (res.ok) {
      await AsyncStorage.setItem(MOBILE_KEY, 'true');
      console.log('[Push.native] ✅ Abonnement enregistré');
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;

    const auth      = await getAuth();
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants?.expoConfig?.extra?.eas?.projectId,
    }).catch(() => null);

    if (auth && tokenData) {
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
