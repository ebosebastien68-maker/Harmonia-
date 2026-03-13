// =====================================================
// pushMobile.ts
// Gestion des push notifications sur mobile (iOS / Android)
// via Expo Push Notifications.
//
// Flux :
//   1. Vérifie si déjà abonné localement (AsyncStorage) → silence
//   2. Vérifie si déjà abonné en DB → silence
//   3. Demande la permission système
//   4. Récupère l'ExponentPushToken
//   5. Enregistre en DB via le backend
// =====================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants    from 'expo-constants';

const BACKEND_URL     = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';
const PUSH_MOBILE_KEY = 'harmonia_push_mobile_registered';

// Comportement des notifications reçues pendant que l'app est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Fonction principale ────────────────────────────────────────────────────────
export async function initPushMobile(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {

  // Seulement sur un vrai appareil physique
  if (!Device.isDevice) {
    console.log('[PushMobile] Simulateur détecté — push ignoré');
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
    // ── 1. Cache local ─────────────────────────────────────────────────────
    const cached = await AsyncStorage.getItem(PUSH_MOBILE_KEY);
    if (cached === 'true') {
      console.log('[PushMobile] Cache local — déjà abonné, silence');
      return;
    }

    // ── 2. Auth ────────────────────────────────────────────────────────────
    const auth = await getAuth();
    if (!auth) {
      console.log('[PushMobile] Non connecté — push ignoré');
      return;
    }

    // ── 3. Vérifier DB ─────────────────────────────────────────────────────
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
      const checkData = await checkRes.json();
      if (checkData.subscribed) {
        await AsyncStorage.setItem(PUSH_MOBILE_KEY, 'true');
        console.log('[PushMobile] DB — déjà abonné, silence');
        return;
      }
    }

    // ── 4. Demander la permission ──────────────────────────────────────────
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushMobile] Permission refusée — silence');
      return;
    }

    // ── 5. Récupérer le token Expo selon la plateforme ───────────────────
    // iOS  → APNs via Expo (nécessite un device physique + Apple Developer)
    // Android → FCM via Expo
    // Dans les deux cas, Expo retourne un ExponentPushToken[xxx]
    // que l'on stocke de la même façon — c'est Expo qui gère la différence
    // FCM / APNs en interne lors de l'envoi.
    let expoPushToken: string;
    try {
      if (Platform.OS === 'ios') {
        console.log('[PushMobile] Plateforme iOS — récupération token APNs via Expo');
      } else {
        console.log('[PushMobile] Plateforme Android — récupération token FCM via Expo');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        // projectId est requis sur SDK 49+
        // Récupérable dans app.json > expo.extra.eas.projectId
        // ou via Constants.expoConfig.extra.eas.projectId
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      expoPushToken = tokenData.data;
      console.log(`[PushMobile] Token (${Platform.OS}) :`, expoPushToken);
    } catch (tokenErr) {
      console.warn('[PushMobile] Impossible de récupérer le token :', tokenErr);
      return;
    }

    // ── 6. Enregistrer en DB ───────────────────────────────────────────────
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
      console.log('[PushMobile] ✅ Abonnement enregistré');
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[PushMobile] ❌ Erreur enregistrement :', err);
    }

  } catch (err) {
    console.warn('[PushMobile] Erreur inattendue :', err);
  }
}

// ── Désabonnement (à appeler à la déconnexion) ────────────────────────────────
export async function removePushMobile(
  getAuth: () => Promise<{ user_id: string; access_token: string } | null>
): Promise<void> {
  try {
    const auth = await getAuth();
    if (!auth) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    }).catch(() => null);
    if (!tokenData) return;

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

    await AsyncStorage.removeItem(PUSH_MOBILE_KEY);
    console.log('[PushMobile] Abonnement supprimé');
  } catch (err) {
    console.warn('[PushMobile] Erreur suppression :', err);
  }
}
