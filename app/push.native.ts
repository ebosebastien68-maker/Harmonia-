// =====================================================
// push.native.ts
// Chargé par Metro sur iOS et Android UNIQUEMENT.
// Utilise expo-notifications + expo-device.
//
// Metro sélectionne ce fichier automatiquement quand
// platform = ios | android grâce à l'extension .native.ts
// =====================================================

import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import Constants          from 'expo-constants';
import { Platform }       from 'react-native';
import AsyncStorage       from '@react-native-async-storage/async-storage';

const BACKEND_URL     = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const PUSH_MOBILE_KEY = 'harmonia_push_mobile_registered';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export async function initPush(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {

  if (!Device.isDevice) {
    console.log('[Push.native] Simulateur — ignoré');
    return;
  }

  // Canal Android obligatoire
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'Harmonia',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#7C3AED',
    });
  }

  try {
    // ── 1. Cache local ────────────────────────────────────────────────────
    const cached = await AsyncStorage.getItem(PUSH_MOBILE_KEY);
    if (cached === 'true') {
      console.log('[Push.native] Cache local — déjà abonné');
      return;
    }

    // ── 2. Auth ───────────────────────────────────────────────────────────
    const auth = await getAuth();
    if (!auth) return;

    // ── 3. Vérifier en DB ─────────────────────────────────────────────────
    const checkRes = await fetch(`${BACKEND_URL}/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:       'checkSubscription',
        platform:     'mobile',
        user_id:      auth.user_id,
        access_token: auth.access_token,
      }),
    }).catch(() => null);

    if (checkRes?.ok) {
      const d = await checkRes.json();
      if (d.subscribed) {
        await AsyncStorage.setItem(PUSH_MOBILE_KEY, 'true');
        console.log('[Push.native] DB — déjà abonné');
        return;
      }
    }

    // ── 4. Demander la permission système (iOS / Android) ─────────────────
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      // La boîte de dialogue OS apparaît ici
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push.native] Permission refusée');
      return;
    }

    // ── 5. Récupérer le token Expo ────────────────────────────────────────
    // iOS  → APNs via Expo
    // Android → FCM via Expo
    // Dans les deux cas Expo retourne ExponentPushToken[xxx]
    console.log(`[Push.native] Plateforme ${Platform.OS} — récupération token`);
    let expoPushToken: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      expoPushToken = tokenData.data;
      console.log(`[Push.native] Token (${Platform.OS}) :`, expoPushToken);
    } catch (err) {
      console.warn('[Push.native] Impossible de récupérer le token :', err);
      return;
    }

    // ── 6. Enregistrer en DB ──────────────────────────────────────────────
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
      await AsyncStorage.setItem(PUSH_MOBILE_KEY, 'true');
      console.log('[Push.native] ✅ Abonnement enregistré');
    } else {
      console.warn('[Push.native] ❌ Erreur enregistrement');
    }

  } catch (err) {
    console.warn('[Push.native] Erreur inattendue :', err);
  }
}

// Désabonnement (appeler à la déconnexion)
export async function removePush(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {
  try {
    const auth      = await getAuth();
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
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
    await AsyncStorage.removeItem(PUSH_MOBILE_KEY);
    console.log('[Push.native] Abonnement supprimé');
  } catch (err) {
    console.warn('[Push.native] Erreur suppression :', err);
  }
  }
